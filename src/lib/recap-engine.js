import Anthropic from '@anthropic-ai/sdk';
import { getDb } from './database.js';
import { getCache, refreshTasks, refreshDossiers } from './notion-cache.js';
import { notionHeaders, NOTION_DOSSIERS_DB_ID } from './notion-config.js';
import { getRecentEmails, isGmailConfigured } from './gmail-client.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ==================== DATA GATHERING ====================

/**
 * Get unanswered WhatsApp messages from the last N hours
 * Messages where we haven't responded (no from_me=1 after)
 */
function getUnansweredWhatsAppMessages(hoursBack = 6) {
  const db = getDb();
  const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);

  // Get messages received (not from me) with no subsequent reply
  const query = `
    SELECT
      m.id,
      m.conversation_jid,
      m.text,
      m.timestamp,
      m.message_type,
      c.whatsapp_name,
      c.custom_name,
      c.notion_contact_name,
      c.notion_dossier_name
    FROM messages m
    JOIN conversations c ON m.conversation_jid = c.jid
    WHERE m.from_me = 0
      AND m.timestamp > ?
      AND m.text IS NOT NULL
      AND m.text != ''
      AND c.status != 'hsva'
      AND NOT EXISTS (
        SELECT 1 FROM messages m2
        WHERE m2.conversation_jid = m.conversation_jid
          AND m2.from_me = 1
          AND m2.timestamp > m.timestamp
      )
    ORDER BY m.timestamp DESC
    LIMIT 50
  `;

  try {
    const messages = db.prepare(query).all(cutoffTime);

    // Group by conversation
    const grouped = {};
    messages.forEach(m => {
      const key = m.conversation_jid;
      if (!grouped[key]) {
        grouped[key] = {
          jid: m.conversation_jid,
          name: m.custom_name || m.notion_contact_name || m.notion_dossier_name || m.whatsapp_name || 'Inconnu',
          dossier: m.notion_dossier_name,
          messages: []
        };
      }
      grouped[key].messages.push({
        text: m.text,
        timestamp: m.timestamp,
        type: m.message_type
      });
    });

    return Object.values(grouped);
  } catch (error) {
    console.error('[RECAP] Error fetching unanswered messages:', error.message);
    return [];
  }
}

/**
 * Get recent unread emails
 */
async function getUnreadEmails() {
  if (!isGmailConfigured()) {
    console.log('[RECAP] Gmail not configured, skipping emails');
    return [];
  }

  try {
    const emails = await getRecentEmails(10, 24); // Last 24h, max 10
    console.log(`[RECAP] Found ${emails.length} unread emails`);
    return emails.map(e => ({
      from: e.fromName,
      subject: e.subject,
      date: e.date,
      snippet: e.snippet
    }));
  } catch (error) {
    console.error('[RECAP] Error fetching emails:', error.message);
    return [];
  }
}

/**
 * Get pending tasks from Notion cache
 */
async function getPendingTasks() {
  try {
    // Try to get from cache first
    let tasksCache = getCache('tasks');

    // If cache is empty, refresh it
    if (!tasksCache?.data) {
      console.log('[RECAP] Tasks cache empty, refreshing...');
      await refreshTasks();
      tasksCache = getCache('tasks');
    }

    if (!tasksCache?.data) {
      console.log('[RECAP] No tasks data available');
      return [];
    }

    // Filter for pending tasks (not completed)
    const pendingTasks = tasksCache.data
      .filter(t => !t.completed)
      .slice(0, 30)
      .map(t => ({
        id: t.id,
        name: t.name || 'Sans titre',
        dueDate: t.date || null,
        priority: t.priority || null,
        dossier: t.dossierId ? 'Lié' : null,
        project: t.projectId ? 'Lié' : null
      }));

    console.log(`[RECAP] Found ${pendingTasks.length} pending tasks`);
    return pendingTasks;
  } catch (error) {
    console.error('[RECAP] Error fetching tasks:', error.message);
    return [];
  }
}

/**
 * Get dossiers with no recent activity (last contact > 24h)
 */
async function getInactiveDossiers() {
  if (!NOTION_DOSSIERS_DB_ID) {
    console.log('[RECAP] No DOSSIERS_DB_ID configured');
    return [];
  }

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Use fetch with notionHeaders instead of SDK
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DOSSIERS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: {
          and: [
            {
              property: 'dernier contact',
              date: { before: oneDayAgo }
            }
          ]
        },
        sorts: [
          { property: 'dernier contact', direction: 'ascending' }
        ],
        page_size: 20
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[RECAP] Notion API error:', errorText);
      return [];
    }

    const data = await response.json();

    return data.results.map(page => {
      const props = page.properties;
      return {
        id: page.id,
        name: props['Nom du dossier']?.title?.[0]?.plain_text || 'Sans nom',
        lastContact: props['dernier contact']?.date?.start || null,
        statut: props['Statut']?.select?.name || null
      };
    });
  } catch (error) {
    console.error('[RECAP] Error fetching inactive dossiers:', error.message);
    return [];
  }
}

// ==================== RECAP GENERATION ====================

/**
 * Get current recap slot (8h, 11h, 15h, 18h)
 */
function getRecapSlot() {
  const hour = new Date().getHours();
  if (hour < 10) return '8h00';
  if (hour < 13) return '11h00';
  if (hour < 16) return '15h00';
  return '18h00';
}

/**
 * Format duration since timestamp
 */
function formatDuration(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h${minutes % 60 > 0 ? (minutes % 60) + 'min' : ''}`;
  }
  return `${minutes}min`;
}

/**
 * Generate the recap using Claude
 */
async function generateRecapContent(unanswered, tasks, emails = []) {
  const slot = getRecapSlot();

  // Build context for Claude
  let context = `Tu es l'assistant de Jeremy, courtier en assurances. Génère un recap.\n\n`;

  // WhatsApp unanswered
  context += `## CONVERSATIONS WHATSAPP EN ATTENTE (${unanswered.length})\n`;
  if (unanswered.length === 0) {
    context += `Aucune conversation en attente.\n`;
  } else {
    unanswered.forEach(conv => {
      const lastMsg = conv.messages[0];
      const duration = formatDuration(lastMsg.timestamp);
      context += `- ${conv.name}: "${lastMsg.text.substring(0, 150)}${lastMsg.text.length > 150 ? '...' : ''}" — depuis ${duration}\n`;
    });
  }

  // Emails
  context += `\n## EMAILS NON LUS (${emails.length})\n`;
  if (emails.length === 0) {
    context += `Aucun email non lu (ou Gmail non configuré).\n`;
  } else {
    emails.slice(0, 10).forEach(e => {
      const timeAgo = formatDuration(new Date(e.date).getTime());
      context += `- ${e.from}: "${e.subject}" — ${timeAgo}\n`;
    });
  }

  // Tasks
  context += `\n## TÂCHES À EXÉCUTER (${tasks.length})\n`;
  if (tasks.length === 0) {
    context += `Aucune tâche en attente.\n`;
  } else {
    tasks.slice(0, 15).forEach(t => {
      const due = t.dueDate ? ` — ${t.dueDate}` : '';
      const priority = t.priority ? ` [${t.priority}]` : '';
      context += `- ${t.name}${priority}${due}\n`;
    });
  }

  // Ask Claude to format
  const prompt = `${context}

Génère un recap WhatsApp CONCIS et ACTIONNABLE :

━━━━━━━━━━━━━━━━━━━━
🔔 RECAP ${slot}
━━━━━━━━━━━━━━━━━━━━

📱 WHATSAPP (N)
• [Nom] — [action requise] — [durée]

📧 EMAILS (N)
• [Expéditeur] — [sujet court] — [durée]

✅ À FAIRE (N)
• [tâche courte]

━━━━━━━━━━━━━━━━━━━━

Règles STRICTES :
- Maximum 5 items par section
- 1 ligne par item, max 50 caractères
- Résume l'ACTION REQUISE
- Si section vide ou non configuré, écris "RAS"
- Pas de blabla, que des actions`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }]
    });

    return response.content[0]?.text || 'Erreur génération recap';
  } catch (error) {
    console.error('[RECAP] Claude API error:', error.message);

    // Fallback: generate basic recap without Claude
    return generateBasicRecap(slot, unanswered, tasks, emails);
  }
}

/**
 * Fallback recap without Claude
 */
function generateBasicRecap(slot, unanswered, tasks, emails = []) {
  let recap = `━━━━━━━━━━━━━━━━━━━━\n🔔 RECAP ${slot}\n━━━━━━━━━━━━━━━━━━━━\n\n`;

  recap += `📱 WHATSAPP (${unanswered.length})\n`;
  if (unanswered.length === 0) {
    recap += `RAS\n`;
  } else {
    unanswered.slice(0, 5).forEach(conv => {
      const lastMsg = conv.messages[0];
      const duration = formatDuration(lastMsg.timestamp);
      recap += `• ${conv.name} — ${duration}\n`;
    });
  }

  recap += `\n📧 EMAILS (${emails.length})\n`;
  if (emails.length === 0) {
    recap += `RAS\n`;
  } else {
    emails.slice(0, 5).forEach(e => {
      const timeAgo = formatDuration(new Date(e.date).getTime());
      recap += `• ${e.from.substring(0, 20)} — ${e.subject.substring(0, 25)} — ${timeAgo}\n`;
    });
  }

  recap += `\n✅ À FAIRE (${tasks.length})\n`;
  if (tasks.length === 0) {
    recap += `RAS\n`;
  } else {
    tasks.slice(0, 5).forEach(t => {
      recap += `• ${t.name.substring(0, 50)}\n`;
    });
  }

  recap += `━━━━━━━━━━━━━━━━━━━━`;

  return recap;
}

// ==================== MAIN FUNCTION ====================

// Store reference to WhatsApp send function in globalThis for persistence across modules
if (!globalThis.__recapState) {
  globalThis.__recapState = { sendWhatsAppMessage: null };
}

export function setWhatsAppSender(sendFn) {
  globalThis.__recapState.sendWhatsAppMessage = sendFn;
  console.log('[RECAP] WhatsApp sender configured');
}

/**
 * Generate and send the recap
 */
export async function generateRecap() {
  console.log('[RECAP] Starting recap generation...');

  try {
    // 1. Gather data
    const [unanswered, tasks, emails] = await Promise.all([
      Promise.resolve(getUnansweredWhatsAppMessages(6)),
      getPendingTasks(),
      getUnreadEmails()
    ]);

    console.log(`[RECAP] Data gathered: ${unanswered.length} unanswered, ${tasks.length} tasks, ${emails.length} emails`);

    // 2. Generate recap content
    const recapText = await generateRecapContent(unanswered, tasks, emails);
    console.log('[RECAP] Recap generated');

    // 3. Send via WhatsApp
    const jeremyPhone = process.env.JEREMY_PHONE || process.env.OWNER_PHONE;
    if (!jeremyPhone) {
      console.error('[RECAP] No JEREMY_PHONE or OWNER_PHONE configured');
      return { success: false, error: 'No phone configured', recap: recapText };
    }

    const jid = jeremyPhone.includes('@') ? jeremyPhone : `${jeremyPhone}@s.whatsapp.net`;

    const sender = globalThis.__recapState?.sendWhatsAppMessage;
    if (sender) {
      await sender(jid, recapText);
      console.log('[RECAP] Recap sent to', jid);
    } else {
      console.warn('[RECAP] WhatsApp sender not configured, recap not sent');
      return { success: false, error: 'WhatsApp sender not configured', recap: recapText };
    }

    // 4. Log recap (using correct schema from database.js)
    const db = getDb();
    try {
      db.prepare(`
        INSERT INTO agent_log (timestamp, action_type, description)
        VALUES (?, 'RECAP', ?)
      `).run(Date.now(), recapText);
    } catch (e) {
      console.warn('[RECAP] Could not log to agent_log:', e.message);
    }

    return { success: true, recap: recapText };

  } catch (error) {
    console.error('[RECAP] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get next scheduled recap time
 */
export function getNextRecapTime() {
  const now = new Date();
  const hours = [8, 11, 15, 18];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Find next slot
  for (const hour of hours) {
    if (hour > currentHour || (hour === currentHour && currentMinute < 0)) {
      const next = new Date(now);
      next.setHours(hour, 0, 0, 0);
      return next;
    }
  }

  // Next day 8h
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  // Skip Sunday
  if (tomorrow.getDay() === 0) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }

  return tomorrow;
}

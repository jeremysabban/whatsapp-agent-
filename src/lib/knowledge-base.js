import { insertKnowledge, searchKnowledge, getAllKnowledge, getDocuments, getConversation, getMessages, getDb } from './database.js';
import { Client } from '@notionhq/client';
import { searchEmailsByContact, isGmailConfigured } from './gmail-client.js';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// ==================== KNOWLEDGE MANAGEMENT ====================

/**
 * Add a document to the knowledge base
 * @param {string} type - CGV | FICHE_PRODUIT | DEVIS | CONTRAT | PROCEDURE
 * @param {string} titre - Document title
 * @param {string} contenu - Document content
 * @param {string} assureur - Insurance company name (optional)
 * @param {string} produit - Product name (optional)
 */
export async function addDocument(type, titre, contenu, assureur = null, produit = null) {
  const validTypes = ['CGV', 'FICHE_PRODUIT', 'DEVIS', 'CONTRAT', 'PROCEDURE'];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
  }
  return insertKnowledge(type, titre, contenu, assureur, produit);
}

/**
 * Search for relevant knowledge based on query
 * @param {string} query - Search query
 * @param {string} type - Optional type filter
 * @returns {Array} Matching knowledge entries
 */
export async function searchRelevantKnowledge(query, type = null) {
  if (!query || query.length < 2) {
    return [];
  }
  return searchKnowledge(query, type, 10);
}

/**
 * Get all knowledge for a specific assureur/produit
 * @param {string} assureur - Insurance company name
 * @param {string} produit - Product name (optional)
 */
export async function getKnowledgeByAssureur(assureur, produit = null) {
  const all = getAllKnowledge(null, 500);
  return all.filter(k => {
    if (k.assureur?.toLowerCase() !== assureur?.toLowerCase()) return false;
    if (produit && k.produit?.toLowerCase() !== produit?.toLowerCase()) return false;
    return true;
  });
}

// ==================== CLIENT CONTEXT 360 ====================

/**
 * Build a comprehensive 360 context for a dossier
 * Aggregates: Notion data, recent documents, WhatsApp messages
 * @param {string} dossierId - Notion dossier ID
 */
export async function buildClientContext360(dossierId) {
  if (!dossierId) return null;

  const context = {
    dossier: null,
    contacts: [],
    projets: [],
    contrats: [],
    sinistres: [],
    recentDocs: [],
    recentMessages: [],
    recentEmails: [],
    lastUpdate: Date.now()
  };

  try {
    // 1. Get dossier info from Notion
    const dossierPage = await notion.pages.retrieve({ page_id: dossierId });
    const props = dossierPage.properties;

    // Extract all dossier properties
    context.dossier = {
      id: dossierId,
      name: props['Nom du dossier']?.title?.[0]?.plain_text || '',
      url: dossierPage.url,
      email: props['E-mail (BDD)']?.email || props['Email']?.email || '',
      telephone: props['telephone']?.rollup?.array?.[0]?.phone_number ||
                 props['Téléphone']?.phone_number || '',
      dernierContact: props['dernier contact']?.date?.start ||
                      props['Dernier contact']?.date?.start || null,
      commentaires: props['Commentaires sinistre et gestion']?.rich_text?.[0]?.plain_text ||
                    props['Commentaires']?.rich_text?.[0]?.plain_text || '',
      statut: props['Statut']?.select?.name || ''
    };

    console.log('[KB] Dossier loaded:', context.dossier.name, '| Email:', context.dossier.email, '| Tel:', context.dossier.telephone);

    // 2. Get related contacts
    const contactsRelation = props['👤 Contacts']?.relation || props['Contacts']?.relation || [];
    for (const rel of contactsRelation.slice(0, 5)) {
      try {
        const contactPage = await notion.pages.retrieve({ page_id: rel.id });
        const cProps = contactPage.properties;
        context.contacts.push({
          id: rel.id,
          name: cProps['Nom_Prénom']?.title?.[0]?.plain_text ||
                cProps['Name']?.title?.[0]?.plain_text || '',
          phone: cProps['*Téléphone']?.phone_number ||
                 cProps['Téléphone']?.phone_number || '',
          email: cProps['*E-mail']?.email ||
                 cProps['Email']?.email || ''
        });
      } catch (e) {
        console.error('[KB] Error fetching contact:', e.message);
      }
    }

    // 3. Get related projects
    const projetsRelation = props['📋 Projets']?.relation || props['Projets']?.relation || [];
    for (const rel of projetsRelation.slice(0, 10)) {
      try {
        const projetPage = await notion.pages.retrieve({ page_id: rel.id });
        const pProps = projetPage.properties;
        context.projets.push({
          id: rel.id,
          name: pProps['Name']?.title?.[0]?.plain_text || '',
          type: pProps['Type']?.select?.name || '',
          completed: pProps['Terminé']?.checkbox || false
        });
      } catch (e) {
        console.error('[KB] Error fetching project:', e.message);
      }
    }

    // 4. Get related contracts
    const contratsRelation = props['⭐ Contrats']?.relation || props['Contrats']?.relation || [];
    for (const rel of contratsRelation.slice(0, 10)) {
      try {
        const contratPage = await notion.pages.retrieve({ page_id: rel.id });
        const ctProps = contratPage.properties;
        context.contrats.push({
          id: rel.id,
          name: ctProps['Name']?.title?.[0]?.plain_text || '',
          assureur: ctProps['Assureur']?.select?.name || '',
          type: ctProps['Type']?.select?.name || ''
        });
      } catch (e) {
        console.error('[KB] Error fetching contract:', e.message);
      }
    }

    // 5. Get sinistres en cours
    const sinistresRelation = props['Sinistres en cours']?.relation || props['Sinsitres en cours']?.relation || [];
    for (const rel of sinistresRelation.slice(0, 5)) {
      try {
        const sinistrePage = await notion.pages.retrieve({ page_id: rel.id });
        const sProps = sinistrePage.properties;
        context.sinistres.push({
          id: rel.id,
          name: sProps['Name']?.title?.[0]?.plain_text || '',
          statut: sProps['Statut']?.select?.name || ''
        });
      } catch (e) {
        console.error('[KB] Error fetching sinistre:', e.message);
      }
    }

  } catch (error) {
    console.error('[KB] Error fetching Notion context:', error.message);
  }

  // 5. Get conversations linked to this dossier
  let linkedConversations = [];
  try {
    const db = getDb();
    linkedConversations = db.prepare(
      'SELECT jid, whatsapp_name, custom_name, notion_contact_name FROM conversations WHERE notion_dossier_id = ?'
    ).all(dossierId);
  } catch (e) {
    console.error('[KB] Error fetching linked conversations:', e.message);
  }

  // 6. Get recent WhatsApp messages from linked conversations
  try {
    for (const conv of linkedConversations.slice(0, 3)) {
      const messages = getMessages(conv.jid, 30, 0); // Last 30 messages
      const contactName = conv.custom_name || conv.notion_contact_name || conv.whatsapp_name || 'Contact';

      context.recentMessages.push({
        contact: contactName,
        jid: conv.jid,
        messages: messages.map(m => ({
          fromMe: m.from_me === 1,
          text: m.text || '[media]',
          timestamp: m.timestamp,
          type: m.message_type
        }))
      });
    }
  } catch (e) {
    console.error('[KB] Error fetching WhatsApp messages:', e.message);
  }

  // 7. Get recent documents from WhatsApp (for conversations linked to this dossier)
  try {
    const docs = getDocuments(null, null, false);
    // Filter docs for conversations linked to this dossier
    context.recentDocs = docs
      .filter(d => {
        const conv = getConversation(d.conversation_jid);
        return conv?.notion_dossier_id === dossierId;
      })
      .slice(0, 10)
      .map(d => ({
        filename: d.filename,
        mimetype: d.mimetype,
        status: d.status,
        createdAt: d.created_at
      }));
  } catch (e) { /* ignore */ }

  // 8. Get recent emails from/to contacts in this dossier
  if (isGmailConfigured()) {
    try {
      // Build search queries from dossier name and contact emails
      const searchTerms = [];

      // Add dossier name (extract main name without emojis)
      if (context.dossier?.name) {
        const cleanName = context.dossier.name.replace(/[^\w\s]/g, '').trim().split(' ').slice(0, 2).join(' ');
        if (cleanName.length > 2) searchTerms.push(cleanName);
      }

      // Add contact emails
      for (const contact of context.contacts) {
        if (contact.email) searchTerms.push(contact.email);
        if (contact.name) {
          const cleanName = contact.name.replace(/[^\w\s]/g, '').trim();
          if (cleanName.length > 2) searchTerms.push(cleanName);
        }
      }

      // Fetch emails for each search term (limit to first 2 to avoid too many API calls)
      for (const term of searchTerms.slice(0, 2)) {
        const emails = await searchEmailsByContact(term, 5, 72); // Last 72h, max 5 per term
        for (const email of emails) {
          // Avoid duplicates
          if (!context.recentEmails.some(e => e.id === email.id)) {
            context.recentEmails.push(email);
          }
        }
      }

      // Sort by date, most recent first
      context.recentEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
      // Limit to 10 emails max
      context.recentEmails = context.recentEmails.slice(0, 10);

      console.log(`[KB] Found ${context.recentEmails.length} emails for dossier`);
    } catch (e) {
      console.error('[KB] Error fetching emails:', e.message);
    }
  }

  return context;
}

/**
 * Format context 360 for Claude system prompt
 * @param {object} context360 - Context from buildClientContext360
 */
export function formatContext360ForPrompt(context360) {
  if (!context360) return '';

  let text = '\n═══════════════════════════════════════\n';
  text += '📊 CONTEXTE CLIENT 360°\n';
  text += '═══════════════════════════════════════\n';

  if (context360.dossier) {
    const d = context360.dossier;
    text += `\n📁 DOSSIER: ${d.name}\n`;
    if (d.email) text += `   Email: ${d.email}\n`;
    if (d.telephone) text += `   Téléphone: ${d.telephone}\n`;
    if (d.dernierContact) text += `   Dernier contact: ${new Date(d.dernierContact).toLocaleDateString('fr-FR')}\n`;
    if (d.statut) text += `   Statut: ${d.statut}\n`;
    if (d.commentaires) text += `   Commentaires: ${d.commentaires}\n`;
  }

  if (context360.contacts?.length > 0) {
    text += `\n👤 CONTACTS (${context360.contacts.length}):\n`;
    context360.contacts.forEach(c => {
      text += `   • ${c.name} | ${c.phone || 'N/A'} | ${c.email || 'N/A'}\n`;
    });
  }

  if (context360.contrats?.length > 0) {
    text += `\n⭐ CONTRATS ACTIFS (${context360.contrats.length}):\n`;
    context360.contrats.forEach(c => {
      text += `   • ${c.name} — ${c.assureur} (${c.type})\n`;
    });
  }

  if (context360.sinistres?.length > 0) {
    text += `\n🚨 SINISTRES EN COURS (${context360.sinistres.length}):\n`;
    context360.sinistres.forEach(s => {
      text += `   • ${s.name} — ${s.statut || 'En cours'}\n`;
    });
  }

  if (context360.projets?.length > 0) {
    const projetsEnCours = context360.projets.filter(p => !p.completed);
    if (projetsEnCours.length > 0) {
      text += `\n📋 PROJETS EN COURS (${projetsEnCours.length}):\n`;
      projetsEnCours.forEach(p => {
        text += `   • ${p.name} (${p.type})\n`;
      });
    }
  }

  if (context360.recentDocs?.length > 0) {
    text += `\n📎 DOCUMENTS RÉCENTS (${context360.recentDocs.length}):\n`;
    context360.recentDocs.slice(0, 5).forEach(d => {
      text += `   • ${d.filename} (${d.status})\n`;
    });
  }

  if (context360.recentMessages?.length > 0) {
    text += `\n💬 MESSAGES WHATSAPP RÉCENTS:\n`;
    context360.recentMessages.forEach(conv => {
      text += `\n   --- ${conv.contact} ---\n`;
      conv.messages.slice(-10).forEach(m => {
        const direction = m.fromMe ? '→' : '←';
        const time = new Date(m.timestamp).toLocaleString('fr-FR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        const msgText = m.text?.substring(0, 150) || '[media]';
        text += `   ${direction} [${time}] ${msgText}\n`;
      });
    });
  }

  if (context360.recentEmails?.length > 0) {
    text += `\n📧 EMAILS RÉCENTS (${context360.recentEmails.length}):\n`;
    context360.recentEmails.forEach(email => {
      const date = new Date(email.date).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      const direction = email.from.includes(context360.dossier?.email || '') ? '←' : '→';
      text += `\n   --- ${email.fromName} [${date}] ---\n`;
      text += `   Sujet: ${email.subject}\n`;
      text += `   ${email.body?.substring(0, 500) || email.snippet || ''}\n`;
    });
  }

  text += '\n═══════════════════════════════════════\n';

  return text;
}

/**
 * Format knowledge base entries for Claude system prompt
 * @param {Array} entries - Knowledge entries
 */
export function formatKnowledgeForPrompt(entries) {
  if (!entries || entries.length === 0) return '';

  let text = '\n📚 BASE DE CONNAISSANCES PERTINENTE:\n';
  entries.forEach(k => {
    text += `\n[${k.type}] ${k.titre}`;
    if (k.assureur) text += ` | ${k.assureur}`;
    if (k.produit) text += ` - ${k.produit}`;
    text += `\n${k.contenu.substring(0, 500)}${k.contenu.length > 500 ? '...' : ''}\n`;
  });

  return text;
}

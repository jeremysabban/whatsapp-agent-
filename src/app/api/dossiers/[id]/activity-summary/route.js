import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { searchDossierEmails } from '@/lib/gmail-client';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoISO = new Date(thirtyDaysAgo).toISOString().slice(0, 10);

    const dossier = db.prepare('SELECT id, name, url, drive_url FROM dossiers WHERE id = ?').get(id);
    if (!dossier) return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });

    const contacts = db.prepare('SELECT name, email, phone, company FROM contacts WHERE dossier_id = ?').all(id);

    const contracts = db.prepare(
      `SELECT name, type_assurance, date_effet, date_resiliation, desactive, cie_details
       FROM contracts WHERE dossier_id = ? ORDER BY date_effet DESC`
    ).all(id);

    const tasks = db.prepare(
      `SELECT name, completed, date FROM tasks WHERE dossier_id = ? AND completed = 0 ORDER BY date ASC LIMIT 5`
    ).all(id);

    const convJids = db.prepare('SELECT jid, name, whatsapp_name FROM conversations WHERE notion_dossier_id = ?').all(id);
    const convJid = convJids[0]?.jid || null;

    let recentMessages = [];
    for (const conv of convJids) {
      const msgs = db.prepare(
        `SELECT text, timestamp, from_me FROM messages
         WHERE conversation_jid = ? AND timestamp > ? AND text IS NOT NULL AND text != ''
         ORDER BY timestamp DESC LIMIT 10`
      ).all(conv.jid, thirtyDaysAgo / 1000);
      msgs.forEach(m => { m._contactName = conv.whatsapp_name || conv.name || conv.jid; });
      recentMessages.push(...msgs);
    }
    recentMessages.sort((a, b) => b.timestamp - a.timestamp);
    recentMessages = recentMessages.slice(0, 15);

    let recentLogs = [];
    for (const conv of convJids) {
      const logs = db.prepare(
        `SELECT action_type, description, timestamp FROM agent_log
         WHERE conversation_jid = ? AND timestamp > ? ORDER BY timestamp DESC LIMIT 5`
      ).all(conv.jid, thirtyDaysAgo);
      recentLogs.push(...logs);
    }
    recentLogs.sort((a, b) => b.timestamp - a.timestamp);
    recentLogs = recentLogs.slice(0, 8);

    const recentContracts = contracts.filter(c => {
      if (c.date_resiliation && c.date_resiliation >= thirtyDaysAgoISO) return true;
      if (c.date_effet && c.date_effet >= thirtyDaysAgoISO) return true;
      return false;
    });

    // --- Build Gmail search queries from dossier data ---
    // Logique : email (from/to), nom exact (guillemets), n° contrat seul,
    //           compagnie+contrat combiné (jamais compagnie seule), société client (guillemets)
    const gmailQueries = [];
    const searchLabels = [];

    // 1) Tous les contacts : email (from/to) + nom exact
    contacts.forEach(c => {
      if (c.email) {
        gmailQueries.push(`from:${c.email} OR to:${c.email}`);
        searchLabels.push(c.email);
      }
      if (c.name && c.name.trim().length > 2) {
        gmailQueries.push(`"${c.name.trim()}"`);
        searchLabels.push(`"${c.name.trim()}"`);
      }
      if (c.company && c.company.trim().length > 2) {
        gmailQueries.push(`"${c.company.trim()}"`);
        searchLabels.push(`"${c.company.trim()}"`);
      }
    });

    // 2) Numéros de contrat seuls + combo compagnie+contrat
    contracts.forEach(c => {
      if (c.name && c.name.trim().length > 3) {
        gmailQueries.push(c.name.trim());
        searchLabels.push(c.name.trim());
      }
      // Compagnie + contrat combiné (jamais compagnie seule)
      if (c.cie_details && c.name) {
        gmailQueries.push(`${c.cie_details} ${c.name}`);
      }
    });

    // Search Gmail (non-blocking — returns [] if Gmail not configured)
    let emailContext = [];
    try {
      emailContext = await searchDossierEmails(gmailQueries, 20, 180);
    } catch (e) {
      console.error('[ACTIVITY-SUMMARY] Gmail search failed:', e.message);
    }

    // --- Build summary lines ---
    const lines = [];
    recentMessages.forEach(m => {
      const d = new Date(m.timestamp * 1000).toLocaleDateString('fr-FR');
      const who = m.from_me ? 'Moi' : (m._contactName || 'Client');
      const txt = (m.text || '').slice(0, 80).replace(/\n/g, ' ');
      lines.push(`WA ${d} (${who}) : ${txt}`);
    });
    tasks.forEach(t => {
      lines.push(`Tache ouverte : ${t.name}${t.date ? ' (echeance ' + t.date + ')' : ''}`);
    });
    recentContracts.forEach(c => {
      if (c.date_resiliation) lines.push(`Resiliation : ${c.name} le ${c.date_resiliation}`);
      else lines.push(`Nouveau contrat : ${c.name} (${c.type_assurance || '?'}) effet ${c.date_effet}`);
    });
    recentLogs.forEach(l => {
      const d = new Date(l.timestamp).toLocaleDateString('fr-FR');
      lines.push(`${d} : ${l.description?.slice(0, 80) || l.action_type}`);
    });

    // Format email context as compact lines
    const emailLines = emailContext.map(e =>
      `${e.dateStr} ${e.direction} ${e.peer} | ${e.subject}`
    );

    return NextResponse.json({
      dossier,
      contacts,
      contracts,
      tasks,
      convJid,
      recentSummary: lines.slice(0, 8).join('\n') || 'Aucune activite recente.',
      emailContext: emailLines,
      emailSearchTerms: searchLabels,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

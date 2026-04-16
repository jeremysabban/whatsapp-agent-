import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoISO = new Date(thirtyDaysAgo).toISOString().slice(0, 10);

    const dossier = db.prepare('SELECT id, name, url, drive_url FROM dossiers WHERE id = ?').get(id);
    if (!dossier) return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });

    const contacts = db.prepare('SELECT name, email, phone FROM contacts WHERE dossier_id = ?').all(id);

    const contracts = db.prepare(
      `SELECT name, type_assurance, date_effet, date_resiliation, desactive, cie_details
       FROM contracts WHERE dossier_id = ? ORDER BY date_effet DESC`
    ).all(id);

    const tasks = db.prepare(
      `SELECT name, completed, date FROM tasks WHERE dossier_id = ? AND completed = 0 ORDER BY date ASC LIMIT 5`
    ).all(id);

    const convJid = db.prepare('SELECT jid FROM conversations WHERE notion_dossier_id = ? LIMIT 1').get(id)?.jid;

    let recentMessages = [];
    if (convJid) {
      recentMessages = db.prepare(
        `SELECT text, timestamp, from_me FROM messages
         WHERE conversation_jid = ? AND timestamp > ? AND text IS NOT NULL AND text != ''
         ORDER BY timestamp DESC LIMIT 5`
      ).all(convJid, thirtyDaysAgo / 1000);
    }

    const recentLogs = db.prepare(
      `SELECT action_type, description, timestamp FROM agent_log
       WHERE conversation_jid = ? AND timestamp > ? ORDER BY timestamp DESC LIMIT 5`
    ).all(convJid || '', thirtyDaysAgo);

    const recentContracts = contracts.filter(c => {
      if (c.date_resiliation && c.date_resiliation >= thirtyDaysAgoISO) return true;
      if (c.date_effet && c.date_effet >= thirtyDaysAgoISO) return true;
      return false;
    });

    const lines = [];
    recentMessages.forEach(m => {
      const d = new Date(m.timestamp * 1000).toLocaleDateString('fr-FR');
      const who = m.from_me ? 'Moi' : 'Client';
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

    return NextResponse.json({
      dossier,
      contacts,
      contracts,
      tasks,
      convJid,
      recentSummary: lines.slice(0, 8).join('\n') || 'Aucune activite recente.',
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

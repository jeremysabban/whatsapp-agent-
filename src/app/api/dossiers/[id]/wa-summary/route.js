import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const db = getDb();

    const dossier = db.prepare('SELECT name FROM dossiers WHERE id = ?').get(id);
    if (!dossier) return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });

    const cutoff = Math.floor((Date.now() - days * 86400000) / 1000);
    const convs = db.prepare('SELECT jid, name, whatsapp_name FROM conversations WHERE notion_dossier_id = ?').all(id);

    const allMsgs = [];
    for (const conv of convs) {
      const msgs = db.prepare(
        `SELECT text, timestamp, from_me, message_type FROM messages
         WHERE conversation_jid = ? AND timestamp > ? AND (text IS NOT NULL AND text != '' OR message_type != 'text')
         ORDER BY timestamp ASC`
      ).all(conv.jid, cutoff);
      const contactName = conv.whatsapp_name || conv.name || conv.jid;
      msgs.forEach(m => { m._contact = contactName; });
      allMsgs.push(...msgs);
    }
    allMsgs.sort((a, b) => a.timestamp - b.timestamp);

    if (!allMsgs.length) {
      return NextResponse.json({ summary: `Aucun message WhatsApp sur les ${days} derniers jours.`, count: 0 });
    }

    const lines = allMsgs.map(m => {
      const d = new Date(m.timestamp * 1000);
      const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const who = m.from_me ? 'Moi' : m._contact;
      let content = (m.text || '').replace(/\n/g, ' ').slice(0, 200);
      if (!content && m.message_type) content = `[${m.message_type}]`;
      return `${dateStr} ${timeStr} | ${who} : ${content}`;
    });

    const header = `RESUME WHATSAPP — ${dossier.name} — ${days} derniers jours (${allMsgs.length} messages)`;
    const summary = `${header}\n${'─'.repeat(60)}\n${lines.join('\n')}`;

    return NextResponse.json({ summary, count: allMsgs.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

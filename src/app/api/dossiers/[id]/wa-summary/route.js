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

    const docsById = {};
    try {
      db.prepare('SELECT id, filename, file_size FROM documents').all()
        .forEach(d => { docsById[d.id] = d; });
    } catch {}

    const allMsgs = [];
    for (const conv of convs) {
      const msgs = db.prepare(
        `SELECT text, timestamp, from_me, message_type, document_id FROM messages
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

    const fmtSize = (b) => {
      if (!b) return '';
      if (b < 1024) return ` ${b}o`;
      if (b < 1048576) return ` ${(b/1024).toFixed(0)}Ko`;
      return ` ${(b/1048576).toFixed(1)}Mo`;
    };

    const lines = allMsgs.map(m => {
      const d = new Date(m.timestamp * 1000);
      const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const who = m.from_me ? 'Moi' : m._contact;
      let content = '';
      const type = m.message_type || 'text';
      if (type === 'document' || type === 'application') {
        const doc = m.document_id ? docsById[m.document_id] : null;
        const fname = doc?.filename || (m.text || '').replace(/^📎\s*/, '');
        content = `[document: ${fname}${fmtSize(doc?.file_size)}]`;
        const caption = (m.text || '').replace(/^📎\s*/, '').replace(fname, '').trim();
        if (caption && caption !== fname) content += ` ${caption}`;
      } else if (type === 'image') {
        const caption = (m.text || '').replace(/^📷\s*/, '').trim();
        content = caption ? `[image] ${caption}` : '[image]';
      } else if (type === 'ptt' || type === 'audio') {
        content = `[vocal]`;
      } else if (type === 'video') {
        const caption = (m.text || '').replace(/^🎥\s*/, '').trim();
        content = caption ? `[video] ${caption}` : '[video]';
      } else if (type === 'sticker') {
        content = '[sticker]';
      } else {
        content = (m.text || '').replace(/\n/g, ' ').slice(0, 200);
      }
      if (!content) content = `[${type}]`;
      return `${dateStr} ${timeStr} | ${who} : ${content}`;
    });

    const header = `RESUME WHATSAPP — ${dossier.name} — ${days} derniers jours (${allMsgs.length} messages)`;
    const summary = `${header}\n${'─'.repeat(60)}\n${lines.join('\n')}`;

    return NextResponse.json({ summary, count: allMsgs.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

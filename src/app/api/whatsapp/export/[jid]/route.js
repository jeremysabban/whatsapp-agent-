import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request, { params }) {
  try {
    const jid = decodeURIComponent(params.jid);
    const db = getDb();

    // Get conversation info
    const conv = db.prepare(`
      SELECT name, phone, display_name, notion_dossier_name
      FROM conversations WHERE jid = ?
    `).get(jid);

    if (!conv) {
      return NextResponse.json({ error: 'Conversation non trouvée' }, { status: 404 });
    }

    // Get all messages
    const messages = db.prepare(`
      SELECT sender_name, text, timestamp, from_me, message_type
      FROM messages
      WHERE conversation_jid = ?
      ORDER BY timestamp ASC
    `).all(jid);

    // Build text content
    const contactName = conv.display_name || conv.name || conv.phone;
    const dossierInfo = conv.notion_dossier_name ? `Dossier Notion: ${conv.notion_dossier_name}` : '';

    let content = `═══════════════════════════════════════════════════════════
CONVERSATION WHATSAPP
═══════════════════════════════════════════════════════════
Contact: ${contactName}
Téléphone: ${conv.phone}
${dossierInfo ? dossierInfo + '\n' : ''}Nombre de messages: ${messages.length}
Export: ${new Date().toLocaleString('fr-FR')}
═══════════════════════════════════════════════════════════

`;

    let currentDate = null;
    for (const msg of messages) {
      const date = new Date(msg.timestamp);
      const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      // Add date separator
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        content += `\n─── ${dateStr} ───\n\n`;
      }

      const sender = msg.from_me ? 'Moi' : (msg.sender_name || contactName);
      const typeIndicator = msg.message_type !== 'text' ? ` [${msg.message_type}]` : '';

      content += `[${timeStr}] ${sender}${typeIndicator}:\n${msg.text || '(média)'}\n\n`;
    }

    content += `\n═══════════════════════════════════════════════════════════
FIN DE L'EXPORT
═══════════════════════════════════════════════════════════`;

    // Return as downloadable text file
    const filename = `conversation_${contactName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[EXPORT] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

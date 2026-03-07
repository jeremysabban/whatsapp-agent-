import { NextResponse } from 'next/server';
import { linkNotionContact, getConversation, insertAgentLog } from '@/lib/database';

export async function POST(request) {
  try {
    const { jid, notionContactId, notionContactName, notionContactUrl } = await request.json();

    if (!jid || !notionContactId) {
      return NextResponse.json({ error: 'jid and notionContactId required' }, { status: 400 });
    }

    const conv = getConversation(jid);
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Link contact — promotes inbox→prospect, keeps other statuses intact
    linkNotionContact(jid, notionContactId, notionContactName || '', notionContactUrl || '');

    insertAgentLog(
      'contact_linked',
      `Contact Notion "${notionContactName || notionContactId}" lié à la conversation ${conv.display_name || conv.name || jid}`,
      jid,
      conv.display_name || conv.name || null,
      { notionContactId, notionContactName, notionContactUrl }
    );

    return NextResponse.json({
      success: true,
      conversation: getConversation(jid),
    });
  } catch (err) {
    console.error('Link notion contact error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

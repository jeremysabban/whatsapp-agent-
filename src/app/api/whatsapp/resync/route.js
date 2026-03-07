import { NextResponse } from 'next/server';
import { resyncConversationMedia } from '@/lib/whatsapp-client';

export async function POST(request) {
  try {
    const { jid } = await request.json();

    if (!jid) {
      return NextResponse.json({ error: 'JID requis' }, { status: 400 });
    }

    const result = await resyncConversationMedia(jid);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API] Resync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

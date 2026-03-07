import { NextResponse } from 'next/server';
import { resyncMessages } from '@/lib/whatsapp-client';

export async function POST(request) {
  try {
    const { jid, count } = await request.json();
    if (!jid) {
      return NextResponse.json({ error: 'JID requis' }, { status: 400 });
    }
    const result = await resyncMessages(jid, count || 50);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

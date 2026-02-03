import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/whatsapp-client';

export async function POST(request) {
  try {
    const { jid, text } = await request.json();
    if (!jid || !text) return NextResponse.json({ error: 'jid and text required' }, { status: 400 });
    const result = await sendMessage(jid, text);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

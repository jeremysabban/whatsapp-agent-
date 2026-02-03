import { NextResponse } from 'next/server';
import { getMessages, getDocuments, getConversation, resetUnread } from '@/lib/database';

export async function GET(request, { params }) {
  try {
    const { jid } = params;
    const decodedJid = decodeURIComponent(jid);
    const messages = getMessages(decodedJid);
    const documents = getDocuments(decodedJid);
    const conversation = getConversation(decodedJid);
    resetUnread(decodedJid);
    return NextResponse.json({ messages, documents, conversation });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

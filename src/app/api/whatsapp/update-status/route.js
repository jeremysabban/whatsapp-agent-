import { NextResponse } from 'next/server';
import { updateConversationStatus, updateConversationCategory, updateConversationTags, updateConversationPriority, updateConversationNotes, getConversation, setCustomName, setEmail, setPhone } from '@/lib/database';

export async function POST(request) {
  try {
    const { jid, status, category, tags, priority, notes, custom_name, email, phone } = await request.json();
    if (!jid) return NextResponse.json({ error: 'jid required' }, { status: 400 });
    if (status) updateConversationStatus(jid, status);
    if (category) updateConversationCategory(jid, category);
    if (tags !== undefined) updateConversationTags(jid, tags);
    if (priority) updateConversationPriority(jid, priority);
    if (notes !== undefined) updateConversationNotes(jid, notes);
    if (custom_name) setCustomName(jid, custom_name);
    if (email !== undefined) setEmail(jid, email);
    if (phone !== undefined) setPhone(jid, phone);
    return NextResponse.json({ conversation: getConversation(jid) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

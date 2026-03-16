import { NextResponse } from 'next/server';
import { updateConversationStatus, updateConversationCategory, updateConversationTags, updateConversationPriority, updateConversationNotes, getConversation, setCustomName, setEmail, setPhone, updateStarred, updateTagProjects, setNameSource, linkNotionContact, unlinkNotionContact, setReminder, clearReminder } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { jid, status, category, tags, priority, notes, custom_name, email, phone, starred, tag_projects, name_source, notion_contact_id, notion_contact_name, notion_contact_url, reminder_at, reminder_note } = await request.json();
    if (!jid) return NextResponse.json({ error: 'jid required' }, { status: 400 });
    if (status) updateConversationStatus(jid, status);
    if (category) updateConversationCategory(jid, category);
    if (tags !== undefined) updateConversationTags(jid, tags);
    if (priority) updateConversationPriority(jid, priority);
    if (notes !== undefined) updateConversationNotes(jid, notes);
    if (custom_name) setCustomName(jid, custom_name, name_source === 'manual');
    if (email !== undefined) setEmail(jid, email);
    if (phone !== undefined) setPhone(jid, phone);
    if (starred !== undefined) updateStarred(jid, starred);
    if (tag_projects !== undefined) updateTagProjects(jid, tag_projects);
    // Handle reminder
    if (reminder_at !== undefined) {
      if (reminder_at) {
        setReminder(jid, reminder_at, reminder_note || null);
      } else {
        clearReminder(jid);
      }
    }
    // Handle name source updates
    if (notion_contact_id !== undefined) {
      if (notion_contact_id) {
        linkNotionContact(jid, notion_contact_id, notion_contact_name, notion_contact_url);
      } else {
        unlinkNotionContact(jid);
      }
    } else if (name_source) {
      setNameSource(jid, name_source);
    }
    return NextResponse.json({ conversation: getConversation(jid) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { searchDossierEmails } from '@/lib/gmail-client';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const jid = request.nextUrl.searchParams.get('jid');
    if (!jid) return NextResponse.json({ error: 'jid required' }, { status: 400 });

    const db = getDb();
    const conv = db.prepare(
      'SELECT name, whatsapp_name, custom_name, phone, email FROM conversations WHERE jid = ?'
    ).get(jid);
    if (!conv) return NextResponse.json({ emailContext: [], emailSearchTerms: [] });

    const gmailQueries = [];
    const searchLabels = [];

    if (conv.email) {
      gmailQueries.push(`from:${conv.email} OR to:${conv.email}`);
      searchLabels.push(conv.email);
    }

    const name = conv.custom_name || conv.whatsapp_name || conv.name;
    if (name && name.trim().length > 2) {
      gmailQueries.push(`"${name.trim()}"`);
      searchLabels.push(`"${name.trim()}"`);
    }

    if (conv.phone && conv.phone.length > 5) {
      const phone = conv.phone.replace(/\D/g, '');
      if (phone.length >= 9) {
        gmailQueries.push(phone.slice(-9));
        searchLabels.push(phone.slice(-9));
      }
    }

    if (!gmailQueries.length) return NextResponse.json({ emailContext: [], emailSearchTerms: [] });

    let emailContext = [];
    try {
      emailContext = await searchDossierEmails(gmailQueries, 15, 180);
    } catch (e) {
      console.error('[GMAIL-CONTEXT] Error:', e.message);
    }

    const emailLines = emailContext.map(e =>
      `${e.dateStr} ${e.direction} ${e.peer} | ${e.subject}`
    );

    return NextResponse.json({ emailContext: emailLines, emailSearchTerms: searchLabels });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

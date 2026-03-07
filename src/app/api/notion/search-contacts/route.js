import { NextResponse } from 'next/server';
import { NOTION_CONTACTS_DB_ID, notionHeaders } from '@/lib/notion-config';

export async function POST(request) {
  try {
    const { query } = await request.json();

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const q = query.trim();
    const isPhone = /^\+?\d{4,}$/.test(q.replace(/\s/g, ''));

    // Search by name or phone depending on query format
    const filter = isPhone
      ? { property: '*Téléphone', phone_number: { contains: q.replace(/\D/g, '').slice(-9) } }
      : { property: 'Nom_Prénom', title: { contains: q } };

    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONTACTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter,
        page_size: 15,
        sorts: [{ property: 'Nom_Prénom', direction: 'ascending' }],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Notion API ${res.status}`);
    }

    const data = await res.json();

    const results = data.results.map(page => ({
      id: page.id,
      name: page.properties['Nom_Prénom']?.title?.[0]?.plain_text || 'Sans nom',
      phone: page.properties['*Téléphone']?.phone_number || '',
      email: page.properties['*E-mail']?.email || '',
      statut: (page.properties['Statut contact']?.multi_select || []).map(s => s.name),
      url: page.url,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Search contacts error:', err.message);
    return NextResponse.json({ results: [], error: err.message });
  }
}

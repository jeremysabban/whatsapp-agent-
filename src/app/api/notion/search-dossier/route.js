import { NextResponse } from 'next/server';
import { NOTION_DOSSIERS_DB_ID, notionHeaders } from '@/lib/notion-config';

export async function POST(request) {
  try {
    const { query } = await request.json();

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DOSSIERS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: {
          property: 'Nom du dossier',
          title: { contains: query },
        },
        page_size: 15,
        sorts: [{ property: 'Nom du dossier', direction: 'ascending' }],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Notion ${res.status}`);
    }

    const data = await res.json();
    const results = data.results.map(page => ({
      id: page.id,
      name: page.properties['Nom du dossier']?.title?.[0]?.plain_text || 'Sans nom',
      url: page.url,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Search dossier error:', err.message);
    return NextResponse.json({ results: [], error: err.message });
  }
}

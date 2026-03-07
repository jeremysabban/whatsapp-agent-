import { NextResponse } from 'next/server';
import { NOTION_DOSSIERS_DB_ID, notionHeaders } from '@/lib/notion-config';

async function notionSearch(query) {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DOSSIERS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: query ? {
        property: 'Nom du dossier',
        title: { contains: query }
      } : undefined,
      page_size: 20,
      sorts: [{ property: 'Nom du dossier', direction: 'ascending' }]
    }),
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Notion API error: ${err.message || res.status}`);
  }
  
  const data = await res.json();
  
  return data.results.map(page => {
    let title = page.properties['Nom du dossier']?.title?.[0]?.plain_text || '';

    // Si le nom est vide ou juste un emoji, extraire depuis l'URL
    if (!title || title.length <= 3 || /^[\p{Emoji}\s]+$/u.test(title)) {
      const urlMatch = page.url?.match(/notion\.so\/([^-]+-[^-]+(?:-[^-]+)*)-[a-f0-9]{32}/i);
      if (urlMatch) {
        title = urlMatch[1].replace(/-/g, ' ');
      } else {
        title = 'Sans nom';
      }
    }

    const driveUrl = page.properties['Google drive']?.url || null;
    const phone = page.properties['telephone']?.rollup?.results?.[0]?.phone_number || null;

    return {
      id: page.id,
      name: title,
      url: page.url,
      driveUrl,
      phone,
    };
  });
}

export async function POST(request) {
  try {
    const { query } = await request.json();
    const results = await notionSearch(query || '');
    return NextResponse.json({ results });
  } catch (err) {
    console.error('Notion search error:', err.message);
    return NextResponse.json({ results: [], error: err.message });
  }
}

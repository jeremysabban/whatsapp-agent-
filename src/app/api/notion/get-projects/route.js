import { NextResponse } from 'next/server';
import { NOTION_PROJECTS_DB_ID, notionHeaders } from '@/lib/notion-config';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dossierId = searchParams.get('dossierId');

    if (!dossierId) {
      return NextResponse.json({ projects: [] });
    }

    if (!NOTION_PROJECTS_DB_ID) {
      return NextResponse.json({ projects: [], error: 'Notion not configured' });
    }

    // Query Projets database filtering by dossier relation and not terminated
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: {
          and: [
            {
              property: '💬 Dossiers',
              relation: {
                contains: dossierId,
              },
            },
            {
              property: 'Terminé',
              checkbox: {
                equals: false,
              },
            },
          ],
        },
        sorts: [
          { property: 'Date', direction: 'descending' },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Notion API error:', err);
      return NextResponse.json({ projects: [], error: 'Notion API error' });
    }

    const data = await response.json();

    const projects = (data.results || []).map(page => {
      const props = page.properties;

      // Extract title
      const name = props['Nom']?.title?.[0]?.plain_text
        || props['Name']?.title?.[0]?.plain_text
        || 'Sans nom';

      // Extract type (select)
      const type = props['Type']?.select?.name || '';

      // Extract niveau (select or status)
      const niveau = props['Niveau']?.select?.name
        || props['Niveau']?.status?.name
        || '';

      // Extract priority
      const priority = props['Priorité']?.select?.name || '';

      return {
        id: page.id,
        name,
        type,
        niveau,
        priority,
        url: page.url,
      };
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    return NextResponse.json({ projects: [], error: error.message });
  }
}

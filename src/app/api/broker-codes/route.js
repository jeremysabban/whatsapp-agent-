import { NextResponse } from 'next/server';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_BROKER_CODES_DB_ID = process.env.NOTION_BROKER_CODES_DB_ID;
const NOTION_VERSION = '2022-06-28';

function notionHeaders() {
  return {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

// GET - Retrieve all codes from Notion
export async function GET() {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_BROKER_CODES_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        sorts: [{ property: 'Nom', direction: 'ascending' }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || `Notion API error: ${response.status}`);
    }

    const data = await response.json();

    const codes = data.results.map(page => {
      const props = page.properties;
      return {
        id: page.id,
        compagnie: props['Nom']?.title?.[0]?.plain_text || '',
        type: props['Type']?.select?.name || '',
        identifiant: props['Identifiant']?.rich_text?.[0]?.plain_text || '',
        mot_de_passe: props['Mot de passe']?.rich_text?.[0]?.plain_text || '',
        url: props['URL']?.url || '',
        commentaires: props['Commentaires']?.rich_text?.[0]?.plain_text || '',
        notion_url: page.url,
      };
    });

    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Broker codes fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Add or update a code in Notion
export async function POST(request) {
  try {
    const body = await request.json();
    const { id, compagnie, type, identifiant, mot_de_passe, url, commentaires } = body;

    const properties = {
      'Nom': { title: [{ text: { content: compagnie || '' } }] },
      'Identifiant': { rich_text: [{ text: { content: identifiant || '' } }] },
      'Mot de passe': { rich_text: [{ text: { content: mot_de_passe || '' } }] },
      'Commentaires': { rich_text: [{ text: { content: commentaires || '' } }] },
    };

    // Only set URL if provided (Notion doesn't accept empty string for URL)
    if (url) {
      properties['URL'] = { url };
    }

    // Only set Type if provided
    if (type) {
      properties['Type'] = { select: { name: type } };
    }

    let response;
    if (id) {
      // Update existing page
      response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: notionHeaders(),
        body: JSON.stringify({ properties }),
      });
    } else {
      // Create new page
      response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders(),
        body: JSON.stringify({
          parent: { database_id: NOTION_BROKER_CODES_DB_ID },
          properties,
        }),
      });
    }

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || `Notion API error: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Broker code save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Archive a code in Notion
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    // Archive the page (Notion doesn't truly delete)
    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: notionHeaders(),
      body: JSON.stringify({ archived: true }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || `Notion API error: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Broker code delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

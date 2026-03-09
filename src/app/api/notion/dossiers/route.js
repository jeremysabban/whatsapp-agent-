import { NextResponse } from 'next/server';
import { NOTION_DOSSIERS_DB_ID, NOTION_API_KEY, notionHeaders } from '@/lib/notion-config';
import { getCache, startScheduler } from '@/lib/notion-cache';

// Ensure scheduler is started
let initialized = false;
function ensureInit() {
  if (!initialized) {
    startScheduler();
    initialized = true;
  }
}

export async function GET(request) {
  try {
    ensureInit();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // Try cache first
    const cached = getCache('dossiers');
    if (cached?.data && !search) {
      console.log('[DOSSIERS] Using cached data');
      return NextResponse.json({
        dossiers: cached.data,
        fromCache: true,
        lastUpdate: cached.lastUpdate
      });
    }

    // Fallback to fresh fetch (or when search is provided)
    console.log('[DOSSIERS] Fetching fresh data');

    // Build filter
    let filter = undefined;
    if (search) {
      filter = {
        property: 'Nom du dossier',
        title: { contains: search }
      };
    }

    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DOSSIERS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter,
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        page_size: 100
      })
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const data = await res.json();

    const dossiers = data.results.map(page => {
      const props = page.properties;
      // telephone is a rollup returning array of rich_text
      const phoneRollup = props['telephone']?.rollup?.array?.[0];
      const phone = phoneRollup?.phone_number || phoneRollup?.rich_text?.[0]?.plain_text || '';
      // 🫅 Email is a rollup returning array of email
      const emailRollup = props['🫅 Email']?.rollup?.array?.[0];
      const email = emailRollup?.email || props['E-mail (BDD)']?.email || '';

      return {
        id: page.id,
        name: props['Nom du dossier']?.title?.[0]?.text?.content || 'Sans nom',
        phone,
        email,
        status: props['Service Lead']?.select?.name || '',
        projectsCount: props['⭐ Contrats']?.relation?.length || 0,
        contactId: props['👤 Contact principal du dossier']?.relation?.[0]?.id || null,
        driveUrl: props['Google drive']?.url || null,
        lastEdited: page.last_edited_time,
        url: page.url
      };
    });

    return NextResponse.json({ dossiers, fromCache: false });

  } catch (error) {
    console.error('Erreur GET dossiers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

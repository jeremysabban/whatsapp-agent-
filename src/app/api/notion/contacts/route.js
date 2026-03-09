import { NextResponse } from 'next/server';
import { NOTION_CONTACTS_DB_ID, NOTION_TASKS_DB_ID, notionHeaders } from '@/lib/notion-config';
import { getCache, startScheduler } from '@/lib/notion-cache';

// Ensure scheduler is started
let initialized = false;
function ensureInit() {
  if (!initialized) {
    startScheduler();
    initialized = true;
  }
}

async function fetchAllContacts() {
  // Try cache first
  ensureInit();
  const cached = getCache('contacts');
  if (cached?.data) {
    console.log('[CONTACTS] Using cached data');
    return { fromCache: true, data: cached.data, lastUpdate: cached.lastUpdate };
  }

  // Fallback to fresh fetch
  console.log('[CONTACTS] Cache miss, fetching fresh data');
  let allContacts = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONTACTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        start_cursor: startCursor,
        page_size: 100,
        sorts: [{ property: 'Nom_Prénom', direction: 'ascending' }],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Notion API ${res.status}`);
    }

    const data = await res.json();
    allContacts = allContacts.concat(data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return { fromCache: false, data: allContacts, lastUpdate: null };
}

async function fetchTasksForContacts(contactIds) {
  if (!contactIds.length) return {};

  // Fetch tasks that have a relation to these contacts (via project -> dossier -> contact)
  // For now, we'll fetch tasks with upcoming dates
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        and: [
          { property: 'Statut', status: { does_not_equal: 'Done' } },
          { property: 'Date', date: { is_not_empty: true } },
        ],
      },
      sorts: [{ property: 'Date', direction: 'ascending' }],
      page_size: 100,
    }),
  });

  if (!res.ok) return {};
  const data = await res.json();

  // Group tasks by contact (we'll need to resolve this via project -> dossier -> contact)
  return data.results;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const result = await fetchAllContacts();
    const { fromCache, data: allPages, lastUpdate } = result;

    // If from cache, data is already formatted
    let contacts;
    if (fromCache) {
      contacts = allPages;
    } else {
      contacts = allPages.map(page => {
        const props = page.properties;
        const phone = props['*Téléphone']?.phone_number || '';
        const cleanPhone = phone.replace(/\D/g, '');

        return {
          id: page.id,
          name: props['Nom_Prénom']?.title?.[0]?.plain_text || 'Sans nom',
          phone,
          cleanPhone,
          email: props['*E-mail']?.email || '',
          statut: (props['Statut contact']?.multi_select || []).map(s => s.name),
          dossierId: props['💬 Dossier']?.relation?.[0]?.id || null,
          companyId: props['🏢 Société']?.relation?.[0]?.id || null,
          createdAt: page.created_time,
          updatedAt: page.last_edited_time,
          url: page.url,
        };
      });
    }

    // Filter by search if provided
    let filtered = contacts;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = contacts.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      contacts: filtered,
      total: contacts.length,
      filtered: filtered.length,
      fromCache,
      lastUpdate,
    });
  } catch (error) {
    console.error('Contacts API error:', error);
    return NextResponse.json({ error: error.message, contacts: [] }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { NOTION_TASKS_DB_ID, NOTION_PROJECTS_DB_ID, NOTION_DOSSIERS_DB_ID, notionHeaders } from '@/lib/notion-config';
import { getConversations } from '@/lib/database';

async function fetchAllOpenTasks() {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        and: [
          { property: 'Statut', status: { does_not_equal: 'Terminé' } },
          { property: 'Statut', status: { does_not_equal: 'Done' } },
          { property: 'Statut', status: { does_not_equal: 'Fait' } },
        ]
      },
      sorts: [{ property: 'Date', direction: 'ascending' }],
      page_size: 100,
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results;
}

async function fetchPageTitle(pageId) {
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers: notionHeaders() });
    if (!res.ok) return null;
    const page = await res.json();
    // Try different title property names
    const props = page.properties;
    const title = props['Name']?.title?.[0]?.plain_text
      || props['Nom']?.title?.[0]?.plain_text
      || props['Nom du dossier']?.title?.[0]?.plain_text
      || props['Tâche']?.title?.[0]?.plain_text
      || 'Sans nom';
    return { id: pageId, name: title, url: page.url };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const tasksRaw = await fetchAllOpenTasks();

    // Get all conversations to match dossier IDs with contacts
    const conversations = getConversations({});
    const dossierToConversation = {};
    for (const conv of conversations) {
      if (conv.notion_dossier_id) {
        dossierToConversation[conv.notion_dossier_id] = {
          jid: conv.jid,
          name: conv.name,
          avatar_initials: conv.avatar_initials,
          avatar_color: conv.avatar_color,
        };
      }
    }

    // Collect unique project and dossier IDs to fetch
    const projectIds = new Set();
    const dossierIds = new Set();

    for (const task of tasksRaw) {
      const projectId = task.properties['Projet']?.relation?.[0]?.id;
      const dossierId = task.properties['💬 Dossiers']?.relation?.[0]?.id;
      if (projectId) projectIds.add(projectId);
      if (dossierId) dossierIds.add(dossierId);
    }

    // Fetch project and dossier names in parallel
    const [projectsMap, dossiersMap] = await Promise.all([
      Promise.all([...projectIds].map(async id => [id, await fetchPageTitle(id)])).then(arr => Object.fromEntries(arr)),
      Promise.all([...dossierIds].map(async id => [id, await fetchPageTitle(id)])).then(arr => Object.fromEntries(arr)),
    ]);

    // Build tasks with enriched data
    const tasks = tasksRaw.map(t => {
      const projectId = t.properties['Projet']?.relation?.[0]?.id;
      const dossierId = t.properties['💬 Dossiers']?.relation?.[0]?.id;
      const dueDate = t.properties['Date']?.date?.start || null;

      // Determine if overdue or due today
      let dateStatus = null;
      if (dueDate) {
        const today = new Date().toISOString().split('T')[0];
        if (dueDate < today) dateStatus = 'overdue';
        else if (dueDate === today) dateStatus = 'today';
      }

      return {
        id: t.id,
        name: t.properties['Tâche']?.title?.[0]?.plain_text || 'Sans nom',
        status: t.properties['Statut']?.status?.name || t.properties['Statut']?.select?.name || '',
        priority: t.properties['Priorité']?.select?.name || '',
        date: dueDate,
        dateStatus,
        url: t.url,
        project: projectId ? projectsMap[projectId] : null,
        dossier: dossierId ? dossiersMap[dossierId] : null,
        contact: dossierId ? dossierToConversation[dossierId] || null : null,
      };
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('All tasks error:', error);
    return NextResponse.json({ error: error.message, tasks: [] }, { status: 500 });
  }
}

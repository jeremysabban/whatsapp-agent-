import { NextResponse } from 'next/server';
import { NOTION_TASKS_DB_ID, notionHeaders } from '@/lib/notion-config';
import { getConversations, getDisplayName } from '@/lib/database';

async function fetchTasks(completed = false) {
  const filter = completed
    ? { property: 'Statut', checkbox: { equals: true } }
    : { property: 'Statut', checkbox: { equals: false } };

  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter,
      sorts: [{ property: 'Date', direction: 'ascending' }],
      page_size: 100,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    console.error('[Notion] Fetch tasks error:', error);
    return [];
  }

  const data = await res.json();
  return data.results;
}

async function fetchPageTitle(pageId) {
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers: notionHeaders() });
    if (!res.ok) return null;
    const page = await res.json();
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

function getEisenhowerQuadrant(priority) {
  // Map priority status to Eisenhower quadrant
  switch (priority) {
    case 'Urg & Imp': return 'faire';      // 🔴 Urgent + Important
    case 'Important': return 'planifier';   // 🟡 Important, not urgent
    case 'Urgent': return 'deleguer';       // 🟠 Urgent, not important
    case 'Secondaire': return 'eliminer';   // ⚪ Neither
    case 'En attente': return 'attente';
    case 'À prioriser': return 'aprioriser';
    default: return 'aprioriser';
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('completed') === 'true';

    // Fetch open tasks, and optionally completed tasks
    const [openTasks, completedTasks] = await Promise.all([
      fetchTasks(false),
      includeCompleted ? fetchTasks(true) : Promise.resolve([]),
    ]);

    const tasksRaw = [...openTasks, ...completedTasks];

    // Get all conversations to match dossier IDs with contacts
    const conversations = getConversations({});
    const dossierToConversation = {};
    for (const conv of conversations) {
      if (conv.notion_dossier_id) {
        dossierToConversation[conv.notion_dossier_id] = {
          jid: conv.jid,
          name: getDisplayName(conv), // Use display name hierarchy
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
      const completed = t.properties['Statut']?.checkbox || false;
      const priority = t.properties['Priorité']?.status?.name || 'À prioriser';
      const quadrant = getEisenhowerQuadrant(priority);

      // Determine if overdue or due today
      let dateStatus = null;
      if (dueDate && !completed) {
        const today = new Date().toISOString().split('T')[0];
        if (dueDate < today) dateStatus = 'overdue';
        else if (dueDate === today) dateStatus = 'today';
      }

      // Get last edited time for completed tasks
      const completedAt = completed ? t.last_edited_time : null;

      return {
        id: t.id,
        name: t.properties['Tâche']?.title?.[0]?.plain_text || 'Sans nom',
        completed,
        priority,
        quadrant,
        date: dueDate,
        dateStatus,
        completedAt,
        url: t.url,
        project: projectId ? projectsMap[projectId] : null,
        dossier: dossierId ? dossiersMap[dossierId] : null,
        dossierId,
        contact: dossierId ? dossierToConversation[dossierId] || null : null,
      };
    });

    // Filter completed tasks to last 7 days only
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    const filteredTasks = tasks.filter(t => {
      if (!t.completed) return true;
      return t.completedAt && t.completedAt >= sevenDaysAgoStr;
    });

    // Sort: open tasks by date, completed by completedAt desc
    filteredTasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.completed) {
        return (b.completedAt || '').localeCompare(a.completedAt || '');
      }
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });

    return NextResponse.json({ tasks: filteredTasks });
  } catch (error) {
    console.error('All tasks error:', error);
    return NextResponse.json({ error: error.message, tasks: [] }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { NOTION_TASKS_DB_ID, NOTION_PROJECTS_DB_ID, notionHeaders } from '@/lib/notion-config';

async function fetchPage(pageId) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers: notionHeaders() });
  if (!res.ok) return null;
  return res.json();
}

async function fetchProjectsByDossier(dossierId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: { property: '💬 Dossiers', relation: { contains: dossierId } },
      sorts: [{ property: 'Dates', direction: 'descending' }],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return data.results.map(p => ({
    id: p.id,
    name: p.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
    type: p.properties['Type']?.select?.name || '',
    productType: p.properties['Type de projet']?.select?.name || '',
    niveau: p.properties['Niveau du Projet']?.status?.name || p.properties['Niveau du Projet']?.select?.name || '',
    priority: p.properties['Priorité']?.select?.name || '',
    done: p.properties['Terminé']?.checkbox || false,
    createdAt: p.created_time,
    url: p.url,
  }));
}

async function fetchProjectsByContact(contactId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: { property: '👤 Contacts', relation: { contains: contactId } },
      sorts: [{ property: 'Dates', direction: 'descending' }],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return data.results.map(p => ({
    id: p.id,
    name: p.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
    type: p.properties['Type']?.select?.name || '',
    productType: p.properties['Type de projet']?.select?.name || '',
    niveau: p.properties['Niveau du Projet']?.status?.name || p.properties['Niveau du Projet']?.select?.name || '',
    priority: p.properties['Priorité']?.select?.name || '',
    done: p.properties['Terminé']?.checkbox || false,
    createdAt: p.created_time,
    url: p.url,
  }));
}

async function fetchTasksByProject(projectIds) {
  if (!projectIds.length) return [];
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        or: projectIds.map(id => ({ property: 'Projet', relation: { contains: id } })),
      },
      sorts: [{ property: 'Date', direction: 'ascending' }],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return data.results.map(t => ({
    id: t.id,
    name: t.properties['Tâche']?.title?.[0]?.plain_text || 'Sans nom',
    status: t.properties['Statut']?.status?.name || t.properties['Statut']?.select?.name || '',
    priority: t.properties['Priorité']?.select?.name || '',
    date: t.properties['Date']?.date?.start || null,
    projectId: t.properties['Projet']?.relation?.[0]?.id || null,
    url: t.url,
  }));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ error: 'contactId required' }, { status: 400 });
    }

    const contact = await fetchPage(contactId);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const props = contact.properties;
    const contactInfo = {
      id: contact.id,
      name: props['Nom_Prénom']?.title?.[0]?.plain_text || 'Sans nom',
      phone: props['*Téléphone']?.phone_number || '',
      email: props['*E-mail']?.email || '',
      url: contact.url,
    };

    // Try to resolve projects via dossier first (dossier-scoped), fallback to contact-scoped
    const dossierId = props['💬 Dossier']?.relation?.[0]?.id;
    const projects = dossierId
      ? await fetchProjectsByDossier(dossierId)
      : await fetchProjectsByContact(contactId);
    const activeProjects = projects.filter(p => !p.done);
    const doneProjects = projects.filter(p => p.done);

    const tasks = await fetchTasksByProject(activeProjects.map(p => p.id));

    const tasksByProject = {};
    for (const task of tasks) {
      if (task.projectId) {
        if (!tasksByProject[task.projectId]) tasksByProject[task.projectId] = [];
        tasksByProject[task.projectId].push(task);
      }
    }

    const projectsWithTasks = activeProjects.map(p => ({
      ...p,
      tasks: tasksByProject[p.id] || [],
    }));

    return NextResponse.json({
      contact: contactInfo,
      projects: projectsWithTasks,
      doneProjects,
      stats: {
        activeProjects: activeProjects.length,
        doneProjects: doneProjects.length,
        pendingTasks: tasks.filter(t => !['Terminé', 'Done', 'Fait'].includes(t.status)).length,
      },
    });
  } catch (error) {
    console.error('Contact details error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { NOTION_API_KEY, NOTION_DOSSIERS_DB_ID, NOTION_TASKS_DB_ID, NOTION_PROJECTS_DB_ID, notionHeaders } from '@/lib/notion-config';

const CONTACTS_DB_ID = 'c812f778-cd65-413f-8feb-5cbc4fbb5dd8';

async function fetchPage(pageId) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: notionHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchProjects(dossierId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        property: '💬 Dossiers',
        relation: { contains: dossierId },
      },
      sorts: [{ property: 'Dates', direction: 'descending' }],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return data.results.map(p => ({
    id: p.id,
    name: p.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
    type: p.properties['Type']?.select?.name || '',
    niveau: p.properties['Niveau du Projet']?.status?.name || p.properties['Niveau du Projet']?.select?.name || '',
    priority: p.properties['Priorité']?.select?.name || '',
    done: p.properties['Terminé']?.checkbox || false,
    createdAt: p.created_time,
    url: p.url,
  }));
}

async function fetchTasks(dossierId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        property: '💬 Dossiers',
        relation: { contains: dossierId },
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

async function fetchContacts(dossierId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${CONTACTS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        property: '💬 Dossier',
        relation: { contains: dossierId },
      },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return data.results.map(c => ({
    id: c.id,
    name: c.properties['Nom_Prénom']?.title?.[0]?.plain_text || 'Sans nom',
    phone: c.properties['*Téléphone']?.phone_number || '',
    email: c.properties['*E-mail']?.email || '',
    statut: (c.properties['Statut contact']?.multi_select || []).map(s => s.name),
    url: c.url,
  }));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dossierId = searchParams.get('dossierId');

    if (!dossierId) {
      return NextResponse.json({ error: 'dossierId required' }, { status: 400 });
    }

    // Fetch dossier page
    const dossier = await fetchPage(dossierId);
    if (!dossier) {
      return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });
    }

    const props = dossier.properties;
    const dossierInfo = {
      id: dossier.id,
      name: props['Nom du dossier']?.title?.[0]?.plain_text || 'Sans nom',
      driveUrl: props['Google drive']?.url || null,
      category: props['Cat Client']?.select?.name || '',
      createdAt: props['Date de création']?.created_time || dossier.created_time,
      lastContact: props['dernier contact']?.date?.start || null,
      email: props['🫅 Email ']?.rollup?.results?.[0]?.email || props['E-mail (BDD)']?.email || '',
      phone: props['telephone']?.rollup?.results?.[0]?.phone_number || '',
      url: dossier.url,
    };

    // Fetch related data in parallel
    const [projects, tasks, contacts] = await Promise.all([
      fetchProjects(dossierId),
      fetchTasks(dossierId),
      fetchContacts(dossierId),
    ]);

    // Separate active and done projects
    const activeProjects = projects.filter(p => !p.done);
    const doneProjects = projects.filter(p => p.done);

    // Separate tasks by status
    const pendingTasks = tasks.filter(t => !['Terminé', 'Done', 'Fait'].includes(t.status));
    const doneTasks = tasks.filter(t => ['Terminé', 'Done', 'Fait'].includes(t.status));

    return NextResponse.json({
      dossier: dossierInfo,
      projects: { active: activeProjects, done: doneProjects },
      tasks: { pending: pendingTasks, done: doneTasks },
      contacts,
    });
  } catch (error) {
    console.error('Dossier overview error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

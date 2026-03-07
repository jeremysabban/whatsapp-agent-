import { NextResponse } from 'next/server';
import { NOTION_PROJECTS_DB_ID, NOTION_TASKS_DB_ID, notionHeaders } from '@/lib/notion-config';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    // 1. Get dossier details
    const dossierRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      headers: notionHeaders()
    });

    if (!dossierRes.ok) {
      const err = await dossierRes.json();
      return NextResponse.json({ error: err.message }, { status: 404 });
    }

    const dossierPage = await dossierRes.json();
    const props = dossierPage.properties;

    // telephone is a rollup returning array of rich_text
    const phoneRollup = props['telephone']?.rollup?.array?.[0];
    const phone = phoneRollup?.phone_number || phoneRollup?.rich_text?.[0]?.plain_text || '';
    // 🫅 Email is a rollup returning array of email
    const emailRollup = props['🫅 Email']?.rollup?.array?.[0];
    const email = emailRollup?.email || props['E-mail (BDD)']?.email || '';

    const dossier = {
      id: dossierPage.id,
      name: props['Nom du dossier']?.title?.[0]?.text?.content || 'Sans nom',
      phone,
      email,
      status: props['Service Lead']?.select?.name || '',
      contactId: props['👤 Contact principal du dossier']?.relation?.[0]?.id || null,
      driveUrl: props['Google drive']?.url || null,
      geminiUrl: props['Gemini GPT']?.url || null,
      url: dossierPage.url
    };

    // 2. Get projects linked to this dossier
    const projectsRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: {
          property: '💬 Dossiers',
          relation: { contains: id }
        },
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
      })
    });

    let projects = [];
    if (projectsRes.ok) {
      const projectsData = await projectsRes.json();
      projects = projectsData.results.map(p => ({
        id: p.id,
        name: p.properties['Name']?.title?.[0]?.text?.content || 'Sans nom',
        type: p.properties['Type']?.select?.name || '',
        priority: p.properties['Priorité']?.select?.name || '',
        completed: p.properties['Terminé']?.checkbox || false,
        url: p.url
      }));
    }

    // 3. Get tasks linked to this dossier
    const tasksRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: {
          property: '💬 Dossiers',
          relation: { contains: id }
        },
        sorts: [
          { property: 'Statut', direction: 'ascending' },
          { timestamp: 'last_edited_time', direction: 'descending' }
        ]
      })
    });

    let tasks = [];
    if (tasksRes.ok) {
      const tasksData = await tasksRes.json();
      tasks = tasksData.results.map(t => ({
        id: t.id,
        name: t.properties['Tâche']?.title?.[0]?.text?.content || 'Sans titre',
        completed: t.properties['Statut']?.checkbox || false,
        priority: t.properties['Priorité']?.select?.name || '',
        date: t.properties['Date']?.date?.start || null,
        projectId: t.properties['Projet']?.relation?.[0]?.id || null,
        url: t.url
      }));
    }

    // 4. Match tasks to their projects
    const projectsWithTasks = projects.map(project => ({
      ...project,
      tasks: tasks.filter(t => t.projectId === project.id)
    }));

    // 5. Orphan tasks (not linked to any project)
    const orphanTasks = tasks.filter(t => !t.projectId);

    return NextResponse.json({
      dossier,
      projects: projectsWithTasks,
      orphanTasks
    });

  } catch (error) {
    console.error('Erreur GET dossier detail:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

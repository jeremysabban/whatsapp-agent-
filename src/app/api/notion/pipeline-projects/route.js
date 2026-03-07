import { NextResponse } from 'next/server';
import { NOTION_PROJECTS_DB_ID, NOTION_TASKS_DB_ID, notionHeaders } from '@/lib/notion-config';

export async function GET() {
  try {
    // Fetch active projects (not done)
    const projRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: { property: 'Terminé', checkbox: { equals: false } },
        sorts: [{ property: 'Dates', direction: 'descending' }],
      }),
    });
    if (!projRes.ok) {
      const err = await projRes.json();
      throw new Error(err.message || `Notion ${projRes.status}`);
    }
    const projData = await projRes.json();

    const projects = projData.results.map(p => {
      const dossierId = p.properties['💬 Dossiers']?.relation?.[0]?.id || null;
      const dossierName = null; // resolved below if needed
      return {
        id: p.id,
        name: p.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
        type: p.properties['Type']?.select?.name || '',
        niveau: p.properties['Niveau du Projet']?.status?.name || p.properties['Niveau du Projet']?.select?.name || '',
        priority: p.properties['Priorité']?.select?.name || '',
        createdAt: p.created_time,
        url: p.url,
        dossierId,
        dossierName,
        tasks: [],
      };
    });

    // Batch-fetch dossier names for projects that have one
    const dossierIds = [...new Set(projects.map(p => p.dossierId).filter(Boolean))];
    const dossierNames = {};
    await Promise.all(dossierIds.map(async (id) => {
      try {
        const res = await fetch(`https://api.notion.com/v1/pages/${id}`, { headers: notionHeaders() });
        if (res.ok) {
          const page = await res.json();
          const props = page.properties;
          for (const key of Object.keys(props)) {
            if (props[key]?.type === 'title' && props[key]?.title?.[0]?.plain_text) {
              dossierNames[id] = props[key].title[0].plain_text;
              break;
            }
          }
        }
      } catch {}
    }));

    for (const p of projects) {
      if (p.dossierId && dossierNames[p.dossierId]) {
        p.dossierName = dossierNames[p.dossierId];
      }
    }

    // Fetch active tasks (not done)
    const taskRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: {
          property: 'Statut',
          status: { does_not_equal: 'Done' },
        },
        sorts: [{ property: 'Date', direction: 'ascending' }],
        page_size: 100,
      }),
    });

    if (taskRes.ok) {
      const taskData = await taskRes.json();
      const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

      for (const t of taskData.results) {
        const projectId = t.properties['Projet']?.relation?.[0]?.id;
        if (projectId && projectMap[projectId]) {
          projectMap[projectId].tasks.push({
            id: t.id,
            name: t.properties['Tâche']?.title?.[0]?.plain_text || 'Sans nom',
            status: t.properties['Statut']?.status?.name || t.properties['Statut']?.select?.name || '',
            date: t.properties['Date']?.date?.start || null,
            url: t.url,
          });
        }
      }
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Pipeline projects error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { NOTION_TASKS_DB_ID, notionHeaders } from '@/lib/notion-config';

function extractPhone(prop) {
  if (!prop?.rollup?.array?.[0]) return null;
  const item = prop.rollup.array[0];
  return item.phone_number || item.rich_text?.[0]?.plain_text || item.title?.[0]?.plain_text || item.number?.toString() || null;
}

// Batch retrieve pages in parallel chunks of 10
async function batchRetrieve(ids) {
  const results = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const batchResults = await Promise.all(
      batch.map(id =>
        fetch(`https://api.notion.com/v1/pages/${id}`, { headers: notionHeaders() })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );
    results.push(...batchResults);
  }
  return results.filter(Boolean);
}

export async function GET(request) {
  const start = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const showCompleted = searchParams.get('completed') === 'true';

    // 1. ONE query for all tasks
    const tasksRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: { property: 'Statut', checkbox: { equals: showCompleted } },
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        page_size: 100
      })
    });

    if (!tasksRes.ok) {
      const err = await tasksRes.json();
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const tasksData = await tasksRes.json();
    const tasksFetchTime = Date.now() - start;

    // 2. Collect UNIQUE project and dossier IDs
    const projectIds = [...new Set(
      tasksData.results.flatMap(t => t.properties['Projet']?.relation?.map(r => r.id) || [])
    )];
    const dossierIds = [...new Set(
      tasksData.results.flatMap(t => t.properties['💬 Dossiers']?.relation?.map(r => r.id) || [])
    )];

    // 3. Fetch projects and dossiers IN PARALLEL with batching
    const relationsStart = Date.now();
    const [projects, dossiers] = await Promise.all([
      batchRetrieve(projectIds),
      batchRetrieve(dossierIds)
    ]);
    const relationsFetchTime = Date.now() - relationsStart;

    // 4. Build lookup maps
    const projectMap = {};
    projects.forEach(p => {
      projectMap[p.id] = {
        name: p.properties['Nom']?.title?.[0]?.plain_text || p.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
        type: p.properties['Type']?.select?.name || null
      };
    });

    const dossierMap = {};
    dossiers.forEach(d => {
      dossierMap[d.id] = {
        id: d.id,
        name: d.properties['Nom du dossier']?.title?.[0]?.plain_text || 'Sans nom',
        geminiUrl: d.properties['Gemini GPT']?.url || null,
        phone: extractPhone(d.properties['telephone']),
        notionUrl: `https://notion.so/${d.id.replace(/-/g, '')}`
      };
    });

    // 5. Assemble final result
    const tasks = tasksData.results.map(t => {
      const projectId = t.properties['Projet']?.relation?.[0]?.id;
      const dossierId = t.properties['💬 Dossiers']?.relation?.[0]?.id;

      return {
        id: t.id,
        name: t.properties['Tâche']?.title?.[0]?.plain_text || t.properties['Nom']?.title?.[0]?.plain_text || 'Sans titre',
        completed: t.properties['Statut']?.checkbox || false,
        priority: t.properties['Priorité']?.select?.name || '',
        date: t.properties['Date']?.date?.start || null,
        createdAt: t.created_time,
        url: t.url,
        project: projectId ? projectMap[projectId] : null,
        dossier: dossierId ? dossierMap[dossierId] : null
      };
    });

    // 6. Group by dossier
    const groupedByDossier = {};
    const tasksWithoutDossier = [];

    tasks.forEach(task => {
      if (task.dossier) {
        const dossierId = task.dossier.id;
        if (!groupedByDossier[dossierId]) {
          groupedByDossier[dossierId] = {
            dossier: task.dossier,
            tasks: []
          };
        }
        groupedByDossier[dossierId].tasks.push(task);
      } else {
        tasksWithoutDossier.push(task);
      }
    });

    const totalTime = Date.now() - start;
    console.log(`[TASKS API] ${totalTime}ms total (tasks: ${tasksFetchTime}ms, relations: ${relationsFetchTime}ms) — ${tasksData.results.length} tâches, ${projectIds.length} projets, ${dossierIds.length} dossiers`);

    return NextResponse.json({
      tasks,
      groupedByDossier: Object.values(groupedByDossier),
      tasksWithoutDossier,
      total: tasks.length
    });

  } catch (error) {
    console.error('Erreur GET tasks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

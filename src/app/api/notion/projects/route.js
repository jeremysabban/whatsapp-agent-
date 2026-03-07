import { NextResponse } from 'next/server';
import { NOTION_PROJECTS_DB_ID, NOTION_TASKS_DB_ID, notionHeaders } from '@/lib/notion-config';

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
    const typeFilter = searchParams.get('type'); // 'Gestion', 'Lead', 'Sinistre' or null for all

    // 1. Query all open projects (Terminé = false)
    const filterConditions = [
      { property: 'Terminé', checkbox: { equals: showCompleted } }
    ];

    if (typeFilter) {
      filterConditions.push({ property: 'Type', select: { equals: typeFilter } });
    }

    const projectsRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: filterConditions.length > 1
          ? { and: filterConditions }
          : filterConditions[0],
        sorts: [
          { property: 'Priorité', direction: 'ascending' },
          { timestamp: 'last_edited_time', direction: 'descending' }
        ],
        page_size: 100
      })
    });

    if (!projectsRes.ok) {
      const err = await projectsRes.json();
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const projectsData = await projectsRes.json();
    const projectsFetchTime = Date.now() - start;

    // 2. Collect unique dossier IDs from projects
    const dossierIds = [...new Set(
      projectsData.results.flatMap(p => p.properties['💬 Dossiers']?.relation?.map(r => r.id) || [])
    )];

    // 3. Fetch dossiers and tasks in parallel
    const tasksStart = Date.now();

    // Get all tasks for these projects
    const projectIds = projectsData.results.map(p => p.id);

    const [dossiers, tasksRes] = await Promise.all([
      batchRetrieve(dossierIds),
      // Fetch open tasks + recently completed tasks
      fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
        method: 'POST',
        headers: notionHeaders(),
        body: JSON.stringify({
          filter: {
            or: [
              // Open tasks
              { property: 'Statut', checkbox: { equals: false } },
              // Recently completed (for showing last completed)
              { property: 'Statut', checkbox: { equals: true } }
            ]
          },
          sorts: [
            { property: 'Statut', direction: 'ascending' },
            { timestamp: 'last_edited_time', direction: 'descending' }
          ],
          page_size: 100
        })
      }).then(r => r.ok ? r.json() : { results: [] })
    ]);

    const tasksFetchTime = Date.now() - tasksStart;

    // 4. Build dossier lookup map
    const dossierMap = {};
    dossiers.forEach(d => {
      dossierMap[d.id] = {
        id: d.id,
        name: d.properties['Nom du dossier']?.title?.[0]?.plain_text || 'Sans nom',
        url: `https://notion.so/${d.id.replace(/-/g, '')}`
      };
    });

    // 5. Group tasks by project
    const tasksByProject = {};
    const completedTasksByProject = {};

    (tasksRes.results || []).forEach(t => {
      const projectId = t.properties['Projet']?.relation?.[0]?.id;
      if (!projectId) return;

      const task = {
        id: t.id,
        name: t.properties['Tâche']?.title?.[0]?.plain_text || t.properties['Nom']?.title?.[0]?.plain_text || 'Sans titre',
        completed: t.properties['Statut']?.checkbox || false,
        priority: t.properties['Priorité']?.select?.name || '',
        date: t.properties['Date']?.date?.start || null,
        url: t.url,
        lastEdited: t.last_edited_time
      };

      if (task.completed) {
        if (!completedTasksByProject[projectId]) completedTasksByProject[projectId] = [];
        completedTasksByProject[projectId].push(task);
      } else {
        if (!tasksByProject[projectId]) tasksByProject[projectId] = [];
        tasksByProject[projectId].push(task);
      }
    });

    // 6. Assemble projects with their data
    const projects = projectsData.results.map(p => {
      const dossierId = p.properties['💬 Dossiers']?.relation?.[0]?.id;
      const openTasks = tasksByProject[p.id] || [];
      const completedTasks = (completedTasksByProject[p.id] || []).slice(0, 3); // Last 3 completed

      // Calculate sorting dates
      const lastTaskAdded = openTasks.length > 0
        ? Math.max(...openTasks.map(t => new Date(t.lastEdited).getTime()))
        : 0;
      const lastTaskCompleted = completedTasks.length > 0
        ? Math.max(...completedTasks.map(t => new Date(t.lastEdited).getTime()))
        : 0;
      const nextTaskDue = openTasks.filter(t => t.date).length > 0
        ? Math.min(...openTasks.filter(t => t.date).map(t => new Date(t.date).getTime()))
        : null;

      return {
        id: p.id,
        name: p.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
        type: p.properties['Type']?.select?.name || 'Lead',
        priority: p.properties['Priorité']?.status?.name || p.properties['Priorité']?.select?.name || '',
        niveau: p.properties['Niveau du Projet']?.select?.name || '',
        completed: p.properties['Terminé']?.checkbox || false,
        url: p.url,
        lastEdited: p.last_edited_time,
        lastEditedTs: new Date(p.last_edited_time).getTime(),
        lastTaskAddedTs: lastTaskAdded,
        lastTaskCompletedTs: lastTaskCompleted,
        nextTaskDueTs: nextTaskDue,
        dossier: dossierId ? dossierMap[dossierId] : null,
        openTasks,
        completedTasks,
        openTasksCount: openTasks.length,
        completedTasksCount: (completedTasksByProject[p.id] || []).length
      };
    });

    // 7. Group by type for stats
    const byType = {
      Gestion: projects.filter(p => p.type === 'Gestion'),
      Lead: projects.filter(p => p.type === 'Lead'),
      Sinistre: projects.filter(p => p.type === 'Sinistre')
    };

    const totalTime = Date.now() - start;
    console.log(`[PROJECTS API] ${totalTime}ms total (projects: ${projectsFetchTime}ms, tasks: ${tasksFetchTime}ms) — ${projects.length} projets`);

    return NextResponse.json({
      projects,
      byType,
      stats: {
        total: projects.length,
        gestion: byType.Gestion.length,
        lead: byType.Lead.length,
        sinistre: byType.Sinistre.length,
        totalOpenTasks: projects.reduce((sum, p) => sum + p.openTasksCount, 0)
      }
    });

  } catch (error) {
    console.error('Erreur GET projects:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

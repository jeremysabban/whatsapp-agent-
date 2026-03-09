import { NextResponse } from 'next/server';
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
  const start = Date.now();

  try {
    ensureInit();
    const { searchParams } = new URL(request.url);
    const showCompleted = searchParams.get('completed') === 'true';

    // Get cached data
    const cachedTasks = getCache('tasks');
    const cachedProjects = getCache('projects');
    const cachedDossiers = getCache('dossiers');

    if (!cachedTasks?.data) {
      return NextResponse.json({ error: 'Cache not ready, please refresh' }, { status: 503 });
    }

    console.log('[TASKS] Using cached data');

    // Filter tasks by completion status
    let tasks = cachedTasks.data.filter(t => t.completed === showCompleted);

    // Build lookup maps from cache
    const projectMap = {};
    (cachedProjects?.data || []).forEach(p => {
      projectMap[p.id] = {
        name: p.name,
        type: p.type
      };
    });

    const dossierMap = {};
    (cachedDossiers?.data || []).forEach(d => {
      dossierMap[d.id] = {
        id: d.id,
        name: d.name,
        geminiUrl: d.geminiUrl,
        phone: d.phone,
        notionUrl: `https://notion.so/${d.id.replace(/-/g, '')}`
      };
    });

    // Enrich tasks with project and dossier info
    tasks = tasks.map(t => ({
      ...t,
      project: t.projectId ? projectMap[t.projectId] : null,
      dossier: t.dossierId ? dossierMap[t.dossierId] : null
    }));

    // Group by dossier
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
    console.log(`[TASKS API] ${totalTime}ms (from cache) — ${tasks.length} tâches`);

    return NextResponse.json({
      tasks,
      groupedByDossier: Object.values(groupedByDossier),
      tasksWithoutDossier,
      total: tasks.length,
      fromCache: true,
      lastUpdate: cachedTasks.lastUpdate
    });

  } catch (error) {
    console.error('Erreur GET tasks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

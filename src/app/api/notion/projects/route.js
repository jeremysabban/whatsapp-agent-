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
    const typeFilter = searchParams.get('type');

    // Get cached data
    const cachedProjects = getCache('projects');
    const cachedTasks = getCache('tasks');
    const cachedDossiers = getCache('dossiers');

    if (!cachedProjects?.data) {
      return NextResponse.json({ error: 'Cache not ready, please refresh' }, { status: 503 });
    }

    console.log('[PROJECTS] Using cached data');

    // Build dossier lookup map
    const dossierMap = {};
    (cachedDossiers?.data || []).forEach(d => {
      dossierMap[d.id] = {
        id: d.id,
        name: d.name,
        url: `https://notion.so/${d.id.replace(/-/g, '')}`
      };
    });

    // Group tasks by project
    const tasksByProject = {};
    const completedTasksByProject = {};

    (cachedTasks?.data || []).forEach(t => {
      if (!t.projectId) return;

      const task = {
        id: t.id,
        name: t.name,
        completed: t.completed,
        priority: t.priority,
        date: t.date,
        url: t.url
      };

      if (task.completed) {
        if (!completedTasksByProject[t.projectId]) completedTasksByProject[t.projectId] = [];
        completedTasksByProject[t.projectId].push(task);
      } else {
        if (!tasksByProject[t.projectId]) tasksByProject[t.projectId] = [];
        tasksByProject[t.projectId].push(task);
      }
    });

    // Filter projects
    let projectsFiltered = cachedProjects.data.filter(p => p.completed === showCompleted);
    if (typeFilter) {
      projectsFiltered = projectsFiltered.filter(p => p.type === typeFilter);
    }

    // Assemble projects with their data
    const projects = projectsFiltered.map(p => {
      const openTasks = tasksByProject[p.id] || [];
      const completedTasks = (completedTasksByProject[p.id] || []).slice(0, 3);

      return {
        id: p.id,
        name: p.name,
        type: p.type || 'Lead',
        priority: p.priority,
        niveau: p.level,
        completed: p.completed,
        url: p.url,
        dossier: p.dossierId ? dossierMap[p.dossierId] : null,
        openTasks,
        completedTasks,
        openTasksCount: openTasks.length,
        completedTasksCount: (completedTasksByProject[p.id] || []).length
      };
    });

    // Group by type for stats
    const byType = {
      Gestion: projects.filter(p => p.type === 'Gestion'),
      Lead: projects.filter(p => p.type === 'Lead'),
      Sinistre: projects.filter(p => p.type === 'Sinistre')
    };

    const totalTime = Date.now() - start;
    console.log(`[PROJECTS API] ${totalTime}ms (from cache) — ${projects.length} projets`);

    return NextResponse.json({
      projects,
      byType,
      stats: {
        total: projects.length,
        gestion: byType.Gestion.length,
        lead: byType.Lead.length,
        sinistre: byType.Sinistre.length,
        totalOpenTasks: projects.reduce((sum, p) => sum + p.openTasksCount, 0)
      },
      fromCache: true,
      lastUpdate: cachedProjects.lastUpdate
    });

  } catch (error) {
    console.error('Erreur GET projects:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

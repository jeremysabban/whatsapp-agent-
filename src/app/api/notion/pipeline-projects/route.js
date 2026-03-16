import { NextResponse } from 'next/server';
import { getCache, ensureCachePopulated, getDossierById } from '@/lib/notion-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Ensure cache is populated
    await ensureCachePopulated();

    // Get data from cache
    const cachedProjects = getCache('projects');
    const cachedTasks = getCache('tasks');

    if (!cachedProjects?.data) {
      return NextResponse.json({ projects: [], message: 'Cache loading...' });
    }

    // Filter active projects (not completed)
    const activeProjects = cachedProjects.data
      .filter(p => !p.completed)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const projects = activeProjects.map(p => {
      // Get dossier name from cache
      let dossierName = null;
      if (p.dossierId) {
        const dossier = getDossierById(p.dossierId);
        if (dossier) {
          dossierName = dossier.name;
        }
      }

      return {
        id: p.id,
        name: p.name || 'Sans nom',
        type: p.type || '',
        niveau: p.level || '',
        priority: p.priority || '',
        createdAt: p.createdAt,
        url: p.url,
        dossierId: p.dossierId,
        dossierName,
        tasks: [],
      };
    });

    // Build project map for task assignment
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

    // Get active tasks from cache and assign to projects
    if (cachedTasks?.data) {
      const activeTasks = cachedTasks.data
        .filter(t => !t.completed)
        .sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.localeCompare(b.date);
        });

      for (const t of activeTasks) {
        if (t.projectId && projectMap[t.projectId]) {
          projectMap[t.projectId].tasks.push({
            id: t.id,
            name: t.name || 'Sans nom',
            status: t.completed ? 'Done' : '',
            date: t.date || null,
            url: t.url,
          });
        }
      }
    }

    return NextResponse.json({
      projects,
      fromCache: true,
      lastUpdate: cachedProjects.lastUpdate
    });
  } catch (error) {
    console.error('Pipeline projects error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

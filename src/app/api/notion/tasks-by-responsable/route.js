import { NextResponse } from 'next/server';
import { getCache, ensureCachePopulated, getDossierById, getProjectById } from '@/lib/notion-cache';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const responsable = searchParams.get('responsable'); // 'Jeremy', 'Perrine', or null for all

    // Ensure cache is populated
    await ensureCachePopulated();

    // Get tasks from cache
    const tasksCache = getCache('tasks');
    if (!tasksCache?.data) {
      return NextResponse.json({ error: 'Cache not ready' }, { status: 503 });
    }

    // Filter tasks: open tasks only (completed === false)
    let tasks = tasksCache.data.filter(t => !t.completed);

    // Filter by responsable if specified
    if (responsable) {
      tasks = tasks.filter(t => t.assignee === responsable);
    }

    // Sort by created date descending
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Group tasks by project
    const tasksByProject = {};
    const orphanTasks = [];

    for (const task of tasks) {
      // Lookup dossier from cache
      let dossierName = null;
      let dossierUrl = null;
      if (task.dossierId) {
        const dossier = getDossierById(task.dossierId);
        if (dossier) {
          dossierName = dossier.name;
          dossierUrl = dossier.url;
        }
      }

      const taskData = {
        id: task.id,
        name: task.name || 'Sans nom',
        responsable: task.assignee || '',
        priority: task.priority || '',
        date: task.date || null,
        createdAt: task.createdAt,
        url: task.url,
        projectId: task.projectId || null,
        dossierId: task.dossierId,
        dossierName,
        dossierUrl
      };

      // Get project info from cache
      if (taskData.projectId) {
        if (!tasksByProject[taskData.projectId]) {
          const project = getProjectById(taskData.projectId);
          if (project) {
            tasksByProject[taskData.projectId] = {
              id: taskData.projectId,
              name: project.name || 'Sans nom',
              type: project.type || '',
              url: project.url,
              tasks: []
            };
          } else {
            tasksByProject[taskData.projectId] = {
              id: taskData.projectId,
              name: 'Projet inconnu',
              type: '',
              url: '',
              tasks: []
            };
          }
        }
        tasksByProject[taskData.projectId].tasks.push(taskData);
      } else {
        orphanTasks.push(taskData);
      }
    }

    // Convert to array and sort by number of tasks
    const projects = Object.values(tasksByProject).sort((a, b) => b.tasks.length - a.tasks.length);

    // Build flat list of all tasks for date view
    const allTasks = [];
    for (const project of projects) {
      for (const task of project.tasks) {
        allTasks.push({ ...task, projectName: project.name, projectType: project.type });
      }
    }
    for (const task of orphanTasks) {
      allTasks.push({ ...task, projectName: null, projectType: null });
    }

    return NextResponse.json({
      success: true,
      projects,
      orphanTasks,
      allTasks,
      totalTasks: tasks.length,
      cacheLastUpdate: tasksCache.lastUpdate
    });

  } catch (error) {
    console.error('[TASKS-BY-RESPONSABLE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getCache, startScheduler } from '@/lib/notion-cache';
import { getConversations, getDisplayName } from '@/lib/database';

// Ensure scheduler is started
let initialized = false;
function ensureInit() {
  if (!initialized) {
    startScheduler();
    initialized = true;
  }
}

function getEisenhowerQuadrant(priority) {
  switch (priority) {
    case 'Urg & Imp': return 'faire';
    case 'Important': return 'planifier';
    case 'Urgent': return 'deleguer';
    case 'Secondaire': return 'eliminer';
    case 'En attente': return 'attente';
    case 'À prioriser': return 'aprioriser';
    default: return 'aprioriser';
  }
}

export async function GET(request) {
  try {
    ensureInit();
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('completed') === 'true';

    // Get cached data
    const cachedTasks = getCache('tasks');
    const cachedProjects = getCache('projects');
    const cachedDossiers = getCache('dossiers');

    if (!cachedTasks?.data) {
      return NextResponse.json({ tasks: [], message: 'Cache loading...' });
    }

    console.log('[ALL-TASKS] Using cached data');

    // Get all conversations to match dossier IDs with contacts
    const conversations = getConversations({});
    const dossierToConversation = {};
    for (const conv of conversations) {
      if (conv.notion_dossier_id) {
        dossierToConversation[conv.notion_dossier_id] = {
          jid: conv.jid,
          name: getDisplayName(conv),
          avatar_initials: conv.avatar_initials,
          avatar_color: conv.avatar_color,
        };
      }
    }

    // Build project and dossier maps from cache
    const projectsMap = {};
    (cachedProjects?.data || []).forEach(p => {
      projectsMap[p.id] = { id: p.id, name: p.name, url: p.url };
    });

    const dossiersMap = {};
    (cachedDossiers?.data || []).forEach(d => {
      dossiersMap[d.id] = { id: d.id, name: d.name, url: d.url };
    });

    // Build tasks with enriched data
    const tasks = cachedTasks.data.map(t => {
      const priority = t.priority || 'À prioriser';
      const quadrant = getEisenhowerQuadrant(priority);

      // Determine if overdue or due today
      let dateStatus = null;
      if (t.date && !t.completed) {
        const today = new Date().toISOString().split('T')[0];
        if (t.date < today) dateStatus = 'overdue';
        else if (t.date === today) dateStatus = 'today';
      }

      return {
        id: t.id,
        name: t.name || 'Sans nom',
        completed: t.completed,
        priority,
        quadrant,
        date: t.date,
        dateStatus,
        completedAt: t.completed ? t.createdAt : null,
        createdAt: t.createdAt,
        note: t.note,
        url: t.url,
        project: t.projectId ? projectsMap[t.projectId] : null,
        dossier: t.dossierId ? dossiersMap[t.dossierId] : null,
        dossierId: t.dossierId,
        contact: t.dossierId ? dossierToConversation[t.dossierId] || null : null,
      };
    });

    // Filter by completion status
    let filteredTasks = includeCompleted
      ? tasks
      : tasks.filter(t => !t.completed);

    // Sort: open tasks by date, completed by createdAt desc
    filteredTasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.completed) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });

    return NextResponse.json({
      tasks: filteredTasks,
      fromCache: true,
      lastUpdate: cachedTasks.lastUpdate
    });
  } catch (error) {
    console.error('All tasks error:', error);
    return NextResponse.json({ error: error.message, tasks: [] }, { status: 500 });
  }
}

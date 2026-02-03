import { NextResponse } from 'next/server';
import { NOTION_TASKS_DB_ID, NOTION_PROJECTS_DB_ID, notionHeaders } from '@/lib/notion-config';
import { getConversations } from '@/lib/database';

async function fetchAllTasks() {
  const results = [];
  let hasMore = true;
  let startCursor;

  while (hasMore) {
    const body = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) break;
    const data = await res.json();
    results.push(...data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return results;
}

async function fetchAllProjects() {
  const results = [];
  let hasMore = true;
  let startCursor;

  while (hasMore) {
    const body = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) break;
    const data = await res.json();
    results.push(...data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return results;
}

function getDateRanges() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();

  return { todayStart, weekStart, monthStart, twentyDaysAgo };
}

export async function GET() {
  try {
    const [tasksRaw, projectsRaw] = await Promise.all([
      fetchAllTasks(),
      fetchAllProjects(),
    ]);

    const { todayStart, weekStart, monthStart, twentyDaysAgo } = getDateRanges();

    // Parse tasks
    const tasks = tasksRaw.map(t => ({
      id: t.id,
      name: t.properties['Tâche']?.title?.[0]?.plain_text || 'Sans nom',
      completed: t.properties['Statut']?.checkbox || false,
      priority: t.properties['Priorité']?.status?.name || 'À prioriser',
      createdAt: t.created_time,
      completedAt: t.properties['Statut']?.checkbox ? t.last_edited_time : null,
      dossierId: t.properties['💬 Dossiers']?.relation?.[0]?.id,
    }));

    // Parse projects
    const projects = projectsRaw.map(p => ({
      id: p.id,
      name: p.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
      type: p.properties['Type']?.select?.name || 'Autre',
      completed: p.properties['Terminé']?.checkbox || false,
      priority: p.properties['Priorité']?.status?.name || 'À prioriser',
      createdAt: p.created_time,
      url: p.url,
      dossierId: p.properties['💬 Dossiers']?.relation?.[0]?.id,
    }));

    // Get conversations for contact mapping
    const conversations = getConversations({});
    const dossierToConversation = {};
    for (const conv of conversations) {
      if (conv.notion_dossier_id) {
        dossierToConversation[conv.notion_dossier_id] = {
          jid: conv.jid,
          name: conv.name,
        };
      }
    }

    // Task metrics
    const taskMetrics = {
      today: {
        created: tasks.filter(t => t.createdAt >= todayStart).length,
        completed: tasks.filter(t => t.completed && t.completedAt >= todayStart).length,
      },
      week: {
        created: tasks.filter(t => t.createdAt >= weekStart).length,
        completed: tasks.filter(t => t.completed && t.completedAt >= weekStart).length,
      },
      month: {
        created: tasks.filter(t => t.createdAt >= monthStart).length,
        completed: tasks.filter(t => t.completed && t.completedAt >= monthStart).length,
      },
      total: tasks.length,
      openTotal: tasks.filter(t => !t.completed).length,
    };

    // Project metrics by type
    const projectTypes = ['Lead', 'Gestion', 'Sinistre'];
    const projectMetrics = {};
    for (const type of projectTypes) {
      const typeProjects = projects.filter(p => p.type === type);
      projectMetrics[type] = {
        today: {
          created: typeProjects.filter(p => p.createdAt >= todayStart).length,
          completed: typeProjects.filter(p => p.completed && p.createdAt >= todayStart).length,
        },
        week: {
          created: typeProjects.filter(p => p.createdAt >= weekStart).length,
          completed: typeProjects.filter(p => p.completed && p.createdAt >= weekStart).length,
        },
        month: {
          created: typeProjects.filter(p => p.createdAt >= monthStart).length,
          completed: typeProjects.filter(p => p.completed && p.createdAt >= monthStart).length,
        },
        total: typeProjects.length,
        openTotal: typeProjects.filter(p => !p.completed).length,
      };
    }

    // Alerts: projects older than 20 days and not completed
    const oldProjects = projects
      .filter(p => !p.completed && p.createdAt < twentyDaysAgo)
      .map(p => {
        const ageInDays = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        const contact = p.dossierId ? dossierToConversation[p.dossierId] : null;
        return {
          ...p,
          ageInDays,
          contact,
        };
      })
      .sort((a, b) => b.ageInDays - a.ageInDays);

    // Completion rate
    const completionRate = tasks.length > 0
      ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
      : 0;

    return NextResponse.json({
      taskMetrics,
      projectMetrics,
      completionRate,
      alerts: {
        oldProjects,
        count: oldProjects.length,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

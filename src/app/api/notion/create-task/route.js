import { NextResponse } from 'next/server';
import { NOTION_TASKS_DB_ID, notionHeaders } from '@/lib/notion-config';
import { refreshTasks, refreshProjects } from '@/lib/notion-cache';

export async function POST(request) {
  try {
    const { name, dossierId, projectId, assignee, priority, date, taskType } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Task name required' }, { status: 400 });
    }

    // Build properties
    const properties = {
      'Tâche': {
        title: [{ text: { content: name } }]
      },
      'Statut': {
        checkbox: false
      }
    };

    // Link to dossier if provided
    if (dossierId) {
      properties['💬 Dossiers'] = {
        relation: [{ id: dossierId }]
      };
    }

    // Link to project if provided
    if (projectId) {
      properties['Projet'] = {
        relation: [{ id: projectId }]
      };
    }

    // Set assignee if provided (select type)
    if (assignee) {
      properties['Responsable'] = {
        select: { name: assignee }
      };
    }

    // Set priority if provided (status type)
    if (priority) {
      properties['Priorité'] = {
        status: { name: priority }
      };
    }

    // Set date if provided
    if (date) {
      properties['Date'] = {
        date: { start: date }
      };
    }

    // Set task type if provided (select type: Appel, Email, Autre)
    if (taskType) {
      properties['Type de tâche'] = {
        select: { name: taskType }
      };
    }

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: NOTION_TASKS_DB_ID },
        properties
      })
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Notion create task error:', err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const page = await res.json();

    // Refresh tasks and projects cache so new task appears immediately
    refreshTasks().catch(err => console.error('Cache refresh error:', err));
    refreshProjects().catch(err => console.error('Projects cache refresh error:', err));

    return NextResponse.json({
      success: true,
      task: {
        id: page.id,
        name,
        url: page.url,
        projectId
      }
    });

  } catch (error) {
    console.error('Erreur create-task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

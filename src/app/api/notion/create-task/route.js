import { NextResponse } from 'next/server';
import { NOTION_TASKS_DB_ID, notionHeaders } from '@/lib/notion-config';

export async function POST(request) {
  try {
    const { name, dossierId, projectId } = await request.json();

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

    return NextResponse.json({
      success: true,
      task: {
        id: page.id,
        name,
        url: page.url
      }
    });

  } catch (error) {
    console.error('Erreur create-task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

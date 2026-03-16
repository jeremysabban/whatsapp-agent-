import { NextResponse } from 'next/server';
import { refreshTasks } from '@/lib/notion-cache';

const NOTION_API_KEY = process.env.NOTION_API_KEY;

export async function POST(request) {
  try {
    const { taskId, completed } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId requis' }, { status: 400 });
    }

    // Mettre à jour le statut de la tâche
    const updateRes = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          'Statut': { checkbox: completed }
        }
      })
    });

    if (!updateRes.ok) {
      const err = await updateRes.json();
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const taskPage = await updateRes.json();
    const taskName = taskPage.properties['Tâche']?.title?.[0]?.text?.content || 'Tâche';

    // Refresh tasks cache
    refreshTasks().catch(err => console.error('Cache refresh error:', err));

    return NextResponse.json({
      success: true,
      taskName
    });

  } catch (error) {
    console.error('Erreur update-task-status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

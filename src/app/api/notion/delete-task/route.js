import { NextResponse } from 'next/server';
import { refreshTasks } from '@/lib/notion-cache';

const NOTION_API_KEY = process.env.NOTION_API_KEY;

export async function POST(request) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId requis' }, { status: 400 });
    }

    // Archive the task (Notion doesn't delete, it archives)
    const res = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        archived: true
      })
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Notion delete task error:', err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    // Refresh tasks cache
    refreshTasks().catch(err => console.error('Cache refresh error:', err));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erreur delete-task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

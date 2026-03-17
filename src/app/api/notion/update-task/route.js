import { NextResponse } from 'next/server';
import { notionHeaders } from '@/lib/notion-config';
import { insertAgentLog, invalidateNotionCache } from '@/lib/database';

export async function POST(req) {
  try {
    const { taskId, updates, dossierId, taskName, conversationJid, conversationName } = await req.json();

    if (!taskId) return NextResponse.json({ error: 'taskId requis' }, { status: 400 });

    const properties = {};

    // Handle status (checkbox)
    if (updates.completed !== undefined) {
      properties['Statut'] = { checkbox: updates.completed };
    }

    // Handle priority (status field with Eisenhower values)
    if (updates.priority) {
      properties['Priorité'] = { status: { name: updates.priority } };
    }

    // Handle date
    if (updates.date !== undefined) {
      properties['Date échéance'] = updates.date ? { date: { start: updates.date } } : { date: null };
    }

    // Handle name
    if (updates.name) {
      properties['Tâche'] = { title: [{ text: { content: updates.name } }] };
    }

    // Handle task type (select)
    if (updates.taskType) {
      properties['Type de tâche'] = { select: { name: updates.taskType } };
    }

    // Handle assignee (select) - can be 'Jeremy', 'Perrine', 'Jeremy, Perrine', or null
    if (updates.assignee !== undefined) {
      if (updates.assignee) {
        properties['Responsable'] = { select: { name: updates.assignee } };
      } else {
        properties['Responsable'] = { select: null };
      }
    }

    const res = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
      method: 'PATCH',
      headers: notionHeaders(),
      body: JSON.stringify({ properties }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[Notion] Update task error:', data);
      return NextResponse.json({ error: data.message || 'Erreur Notion' }, { status: res.status });
    }

    // Invalidate cache for this dossier
    if (dossierId) {
      invalidateNotionCache(dossierId);
    }

    // Log the action
    const updateDetails = [];
    if (updates.completed !== undefined) updateDetails.push(updates.completed ? 'terminée' : 'réouverte');
    if (updates.priority) updateDetails.push(`priorité → ${updates.priority}`);
    if (updates.date) updateDetails.push(`échéance → ${updates.date}`);

    if (updateDetails.length > 0) {
      insertAgentLog(
        'task_updated',
        `Mise à jour tâche "${taskName || 'Sans nom'}" — ${updateDetails.join(', ')}`,
        conversationJid || null,
        conversationName || null,
        { taskId, updates, dossierId }
      );
    }

    return NextResponse.json({
      success: true,
      task: data,
    });
  } catch (err) {
    console.error('[Notion] Update task error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

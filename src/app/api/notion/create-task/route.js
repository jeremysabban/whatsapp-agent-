import { NextResponse } from 'next/server';
import { NOTION_TASKS_DB_ID, notionHeaders } from '@/lib/notion-config';
import { insertAgentLog, invalidateNotionCache } from '@/lib/database';

export async function POST(req) {
  try {
    const { name, priority, date, dossierId, dossierName, conversationJid, conversationName, projectId } = await req.json();

    if (!name) return NextResponse.json({ error: 'Nom de tâche requis' }, { status: 400 });

    const properties = {
      'Tâche': { title: [{ text: { content: name } }] },
      'Statut': { status: { name: 'À faire' } },
      'Priorité': { select: { name: priority || 'À prioriser' } },
    };

    if (date) {
      properties['Date'] = { date: { start: date } };
    }

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

    const res = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: NOTION_TASKS_DB_ID },
        properties,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[Notion] Create task error:', data);
      return NextResponse.json({ error: data.message || 'Erreur Notion' }, { status: res.status });
    }

    // Invalidate cache for this dossier
    if (dossierId) {
      invalidateNotionCache(dossierId);
    }

    // Log the action
    const dossierInfo = dossierName ? ` — Dossier ${dossierName}` : '';
    insertAgentLog(
      'task_created',
      `Création tâche "${name}" — Priorité ${priority || 'À prioriser'}${dossierInfo}`,
      conversationJid || null,
      conversationName || null,
      { taskName: name, priority, date, dossierId, dossierName, projectId, notionPageId: data.id }
    );

    return NextResponse.json({
      success: true,
      taskId: data.id,
      url: data.url,
    });
  } catch (err) {
    console.error('[Notion] Create task error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

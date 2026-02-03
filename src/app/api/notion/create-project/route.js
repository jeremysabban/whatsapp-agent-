import { NextResponse } from 'next/server';
import { NOTION_PROJECTS_DB_ID, notionHeaders } from '@/lib/notion-config';
import { insertAgentLog, invalidateNotionCache } from '@/lib/database';

export async function POST(req) {
  try {
    const { name, type, priority, niveau, dossierId, dossierName, conversationJid, conversationName } = await req.json();

    if (!name) return NextResponse.json({ error: 'Nom de projet requis' }, { status: 400 });

    const properties = {
      'Name': { title: [{ text: { content: name } }] },
      'Terminé': { checkbox: false },
      'Type': { select: { name: type || 'Lead' } },
      'Priorité': { status: { name: priority || 'À prioriser' } }, // status, not select
    };

    if (niveau) {
      properties['Niveau du Projet'] = { select: { name: niveau } }; // select, not status
    }

    if (dossierId) {
      properties['💬 Dossiers'] = {
        relation: [{ id: dossierId }]
      };
    }

    const res = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: NOTION_PROJECTS_DB_ID },
        properties,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[Notion] Create project error:', data);
      return NextResponse.json({ error: data.message || 'Erreur Notion' }, { status: res.status });
    }

    // Invalidate cache for this dossier
    if (dossierId) {
      invalidateNotionCache(dossierId);
    }

    const dossierInfo = dossierName ? ` — Dossier ${dossierName}` : '';
    insertAgentLog(
      'project_created',
      `Création projet "${name}" — Type ${type || 'Lead'} — Priorité ${priority || 'À prioriser'}${dossierInfo}`,
      conversationJid || null,
      conversationName || null,
      { projectName: name, type, priority, niveau, dossierId, dossierName, notionPageId: data.id }
    );

    return NextResponse.json({
      success: true,
      projectId: data.id,
      url: data.url,
    });
  } catch (err) {
    console.error('[Notion] Create project error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

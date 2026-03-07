import { NextResponse } from 'next/server';
import { NOTION_PROJECTS_DB_ID, notionHeaders } from '@/lib/notion-config';
import { insertAgentLog, invalidateNotionCache } from '@/lib/database';

export async function POST(req) {
  try {
    const { name, type, typeProjet, priority, niveau, dossierId, dossierName, contactId, contratId, conversationJid, conversationName } = await req.json();

    if (!name) return NextResponse.json({ error: 'Nom de projet requis' }, { status: 400 });

    // Resolve dossier from contact if not provided directly
    let resolvedDossierId = dossierId;
    if (!resolvedDossierId && contactId) {
      try {
        const contactRes = await fetch(`https://api.notion.com/v1/pages/${contactId}`, { headers: notionHeaders() });
        if (contactRes.ok) {
          const contactPage = await contactRes.json();
          resolvedDossierId = contactPage.properties['💬 Dossier']?.relation?.[0]?.id || null;
        }
      } catch {}
    }

    const properties = {
      'Name': { title: [{ text: { content: name } }] },
      'Terminé': { checkbox: false },
      'Type': { select: { name: type || 'Lead' } },
      'Priorité': { status: { name: priority || 'À prioriser' } }, // status, not select
    };

    if (niveau) {
      properties['Niveau du Projet'] = { select: { name: niveau } }; // select, not status
    }

    if (resolvedDossierId) {
      properties['💬 Dossiers'] = {
        relation: [{ id: resolvedDossierId }]
      };
    }

    if (contactId) {
      properties['👤 Contacts'] = {
        relation: [{ id: contactId }]
      };
    }

    if (contratId) {
      properties['⭐ Contrats'] = {
        relation: [{ id: contratId }]
      };
    }

    if (typeProjet) {
      properties['Type de projet'] = { select: { name: typeProjet } };
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
    if (resolvedDossierId) {
      invalidateNotionCache(resolvedDossierId);
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

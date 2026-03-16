import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function GET() {
  try {
    const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID;
    const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;

    // 1. Fetch 4 projects per type (Lead, Gestion, Sinistre) - balanced view
    const types = ['Lead', 'Gestion', 'Sinistre'];
    const allResults = [];

    for (const type of types) {
      const res = await notion.databases.query({
        database_id: PROJECTS_DB_ID,
        filter: {
          and: [
            { property: 'Terminé', checkbox: { equals: false } },
            { property: 'Type', select: { equals: type } }
          ]
        },
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        page_size: 4
      });
      allResults.push(...res.results);
    }

    // Sort all by last_edited_time and take top 12
    allResults.sort((a, b) => new Date(b.last_edited_time) - new Date(a.last_edited_time));

    const projects = [];

    for (const page of allResults.slice(0, 12)) {
      const props = page.properties;
      const projectName = props['Name']?.title?.[0]?.plain_text || 'Sans nom';
      const projectType = props['Type']?.select?.name || 'Lead';
      const projectId = page.id;
      const projectUrl = page.url;
      const lastEdited = page.last_edited_time;

      // Get dossier name if linked
      let dossierName = '';
      let dossierId = null;
      const dossierRel = props['📁 Dossiers']?.relation?.[0] || props['Dossier']?.relation?.[0];
      if (dossierRel) {
        dossierId = dossierRel.id;
        try {
          const dossierPage = await notion.pages.retrieve({ page_id: dossierRel.id });
          dossierName = dossierPage.properties['Nom du dossier']?.title?.[0]?.plain_text || '';
        } catch (e) {}
      }

      // Get open tasks for this project
      const tasksRes = await notion.databases.query({
        database_id: TASKS_DB_ID,
        filter: {
          and: [
            { property: 'Projet', relation: { contains: projectId } },
            { property: 'Statut', checkbox: { equals: false } }
          ]
        },
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        page_size: 5
      });

      const tasks = tasksRes.results.map(t => ({
        id: t.id,
        name: t.properties['Tâche']?.title?.[0]?.plain_text || t.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
        responsable: t.properties['Responsable']?.select?.name || '',
        url: t.url
      }));

      projects.push({
        id: projectId,
        name: projectName,
        type: projectType,
        dossier: dossierName,
        dossierId,
        url: projectUrl,
        lastEdited: new Date(lastEdited).toISOString(),
        tasks
      });
    }

    return NextResponse.json({ success: true, projects });

  } catch (error) {
    console.error('[RECENT-PROJECTS] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

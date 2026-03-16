import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function GET() {
  try {
    const CONTRACTS_DB_ID = process.env.NOTION_CONTRACTS_DB_ID;
    const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;
    const DOSSIERS_DB_ID = process.env.NOTION_DOSSIERS_DB_ID;

    // 1. Fetch recent active contracts (not desactivé), sorted by last edited
    const contractsRes = await notion.databases.query({
      database_id: CONTRACTS_DB_ID,
      filter: {
        property: 'Desactivé',
        checkbox: { equals: false }
      },
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      page_size: 20
    });

    const contracts = [];

    for (const page of contractsRes.results) {
      const props = page.properties;
      const contractNumber = props['🏆 Numero du contrat']?.title?.[0]?.plain_text || 'Sans numéro';
      const typeAssurance = props['Type Assurance']?.select?.name || '';
      const dateEffet = props['Date d\'effet']?.date?.start || null;
      const dateSignature = props['# Date de signature']?.date?.start || null;

      // Get status from formula
      const statutFormula = props['Statut']?.formula;
      let status = '';
      if (statutFormula) {
        status = statutFormula.string || statutFormula.number?.toString() || '';
      }

      // Get dossier relation
      const dossierRel = props['Dossiers']?.relation?.[0];
      let dossierName = '';
      let dossierId = null;

      if (dossierRel) {
        dossierId = dossierRel.id;
        try {
          const dossierPage = await notion.pages.retrieve({ page_id: dossierRel.id });
          dossierName = dossierPage.properties['Nom du dossier']?.title?.[0]?.plain_text || '';
        } catch (e) {}
      }

      // Get open tasks linked to this dossier
      let tasks = [];
      if (dossierId) {
        try {
          const tasksRes = await notion.databases.query({
            database_id: TASKS_DB_ID,
            filter: {
              and: [
                { property: '💬 Dossiers', relation: { contains: dossierId } },
                { property: 'Statut', checkbox: { equals: false } }
              ]
            },
            sorts: [{ timestamp: 'created_time', direction: 'descending' }],
            page_size: 5
          });

          tasks = tasksRes.results.map(t => ({
            id: t.id,
            name: t.properties['Tâche']?.title?.[0]?.plain_text || t.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
            responsable: t.properties['Responsable']?.select?.name || '',
            date: t.properties['Date']?.date?.start || null,
            url: t.url
          }));
        } catch (e) {
          console.error('Error fetching tasks for contract:', e);
        }
      }

      contracts.push({
        id: page.id,
        number: contractNumber,
        type: typeAssurance,
        status,
        dateEffet,
        dateSignature,
        dossier: dossierName,
        dossierId,
        url: page.url,
        lastEdited: new Date(page.last_edited_time).toISOString(),
        tasks
      });
    }

    return NextResponse.json({ success: true, contracts });

  } catch (error) {
    console.error('[RECENT-CONTRACTS] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

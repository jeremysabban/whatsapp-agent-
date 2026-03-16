#!/usr/bin/env node
/**
 * Update the Notion dashboard with embedded projects view
 */

import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DASHBOARD_ID = '321ac98446f581f0a2efc5ad384b1ebe';
const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID;
const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;

async function updateDashboard() {
  console.log('Fetching projects by type (Lead, Gestion, Sinistre)...\n');

  // 1. Fetch 4 projects per type (not completed) - balanced view
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
    console.log(`${type}: ${res.results.length} projets`);
  }

  // Sort all by last_edited_time
  allResults.sort((a, b) => new Date(b.last_edited_time) - new Date(a.last_edited_time));

  const projects = [];

  for (const page of allResults.slice(0, 12)) {
    const props = page.properties;
    const projectName = props['Name']?.title?.[0]?.plain_text || 'Sans nom';
    const projectType = props['Type']?.select?.name || '';
    const projectId = page.id;
    const projectUrl = page.url;
    const lastEdited = page.last_edited_time;

    // Get dossier name if linked
    let dossierName = '';
    const dossierRel = props['📁 Dossiers']?.relation?.[0] || props['Dossier']?.relation?.[0];
    if (dossierRel) {
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
      name: t.properties['Tâche']?.title?.[0]?.plain_text || t.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
      responsable: t.properties['Responsable']?.select?.name || '',
      url: t.url
    }));

    projects.push({
      name: projectName,
      type: projectType,
      dossier: dossierName,
      url: projectUrl,
      lastEdited: new Date(lastEdited).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      tasks
    });

    console.log(`✓ ${projectName} (${tasks.length} tâches)`);
  }

  console.log('\nUpdating dashboard page...');

  // 2. Get ALL existing blocks and delete everything after "Astuces" section
  const blocks = await notion.blocks.children.list({ block_id: DASHBOARD_ID, page_size: 100 });

  let foundAstuces = false;
  const blocksToDelete = [];

  for (const block of blocks.results) {
    // Check if this is the Astuces heading
    if (block.type === 'heading_2') {
      const text = block.heading_2?.rich_text?.[0]?.plain_text || '';
      if (text.includes('Astuces')) {
        foundAstuces = true;
        continue; // Keep the Astuces heading
      }
    }

    // Delete everything after Astuces (old project sections)
    if (foundAstuces) {
      blocksToDelete.push(block.id);
    }
  }

  // Delete old blocks
  console.log(`Deleting ${blocksToDelete.length} old blocks...`);
  for (const blockId of blocksToDelete) {
    try {
      await notion.blocks.delete({ block_id: blockId });
    } catch (e) {
      // Ignore errors for already deleted blocks
    }
  }

  // 3. Create project blocks
  const projectBlocks = [];

  // Section header - full width
  projectBlocks.push({
    type: 'heading_1',
    heading_1: {
      rich_text: [{ text: { content: '📋 10 Derniers Projets Modifiés' } }]
    }
  });

  projectBlocks.push({
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        text: { content: `Mis à jour le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` },
        annotations: { italic: true, color: 'gray' }
      }]
    }
  });

  projectBlocks.push({ type: 'divider', divider: {} });

  // Add each project as a toggle block with tasks inside
  for (const project of projects) {
    const typeEmoji = project.type === 'Lead' ? '🟣' : project.type === 'Sinistre' ? '🔴' : '🟢';
    const taskCount = project.tasks.length;

    // Project as a callout
    projectBlocks.push({
      type: 'callout',
      callout: {
        icon: { emoji: typeEmoji },
        color: project.type === 'Lead' ? 'purple_background' : project.type === 'Sinistre' ? 'red_background' : 'green_background',
        rich_text: [
          {
            text: {
              content: project.name,
              link: { url: project.url }
            },
            annotations: { bold: true }
          },
          {
            text: { content: `  •  ${project.type}` },
            annotations: { color: 'gray' }
          },
          {
            text: { content: project.dossier ? `  •  ${project.dossier}` : '' },
            annotations: { color: 'gray' }
          },
          {
            text: { content: `  •  ${taskCount} tâche${taskCount > 1 ? 's' : ''}` },
            annotations: { color: taskCount > 0 ? 'orange' : 'gray' }
          }
        ],
        children: project.tasks.length > 0 ? project.tasks.map(task => ({
          type: 'to_do',
          to_do: {
            checked: false,
            rich_text: [
              {
                text: {
                  content: task.name,
                  link: { url: task.url }
                }
              },
              {
                text: { content: task.responsable ? ` (${task.responsable})` : '' },
                annotations: { color: 'gray' }
              }
            ]
          }
        })) : [{
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: 'Aucune tâche ouverte' }, annotations: { italic: true, color: 'gray' } }]
          }
        }]
      }
    });
  }

  // Add divider at the end
  projectBlocks.push({ type: 'divider', divider: {} });

  // 4. Append to dashboard
  await notion.blocks.children.append({
    block_id: DASHBOARD_ID,
    children: projectBlocks
  });

  console.log('\n✅ Dashboard mis à jour avec les 10 derniers projets!');
  console.log('📊 URL:', `https://www.notion.so/${DASHBOARD_ID.replace(/-/g, '')}`);
}

updateDashboard().catch(console.error);

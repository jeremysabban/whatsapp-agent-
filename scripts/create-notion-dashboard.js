#!/usr/bin/env node
/**
 * Script to create a Notion dashboard with linked databases
 * Run with: node scripts/create-notion-dashboard.js
 */

import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function createDashboard() {
  console.log('Creating Notion Dashboard...\n');

  const dossierDbId = process.env.NOTION_DOSSIERS_DB_ID;
  const tasksDbId = process.env.NOTION_TASKS_DB_ID;
  const projectsDbId = process.env.NOTION_PROJECTS_DB_ID;
  const contractsDbId = process.env.NOTION_CONTRACTS_DB_ID;

  // Build clean URLs
  const tasksUrl = `https://www.notion.so/${tasksDbId.replace(/-/g, '')}`;
  const projectsUrl = `https://www.notion.so/${projectsDbId.replace(/-/g, '')}`;
  const dossierUrl = `https://www.notion.so/${dossierDbId.replace(/-/g, '')}`;
  const contractsUrl = `https://www.notion.so/${contractsDbId.replace(/-/g, '')}`;

  console.log('Database IDs:');
  console.log('- Dossiers:', dossierDbId);
  console.log('- Tasks:', tasksDbId);
  console.log('- Projects:', projectsDbId);
  console.log('- Contracts:', contractsDbId);
  console.log('');

  try {
    // First, let's find a suitable parent page
    const projectsDb = await notion.databases.retrieve({ database_id: projectsDbId });
    let parentPageId = null;

    if (projectsDb.parent.type === 'page_id') {
      parentPageId = projectsDb.parent.page_id;
      console.log('Using Projects DB parent:', parentPageId);
    }

    if (!parentPageId) {
      console.error('No suitable parent page found.');
      process.exit(1);
    }

    console.log('\nCreating dashboard under page:', parentPageId);

    // Create the dashboard page with all content
    const dashboard = await notion.pages.create({
      parent: { page_id: parentPageId },
      icon: { emoji: '📊' },
      properties: {
        title: [{ text: { content: 'Tableau de Bord - Smart Value' } }]
      },
      children: [
        // Header
        {
          type: 'heading_1',
          heading_1: {
            rich_text: [{ text: { content: '📊 Tableau de Bord Smart Value Assurances' } }]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: 'Vue centralisée de toutes les activités. Cliquez sur les boutons ci-dessous pour créer ou accéder aux éléments.' } }]
          }
        },
        { type: 'divider', divider: {} },

        // Quick Actions Section
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '⚡ Actions Rapides - Créer' } }]
          }
        },
        {
          type: 'column_list',
          column_list: {
            children: [
              {
                type: 'column',
                column: {
                  children: [
                    {
                      type: 'callout',
                      callout: {
                        icon: { emoji: '➕' },
                        color: 'blue_background',
                        rich_text: [
                          {
                            text: {
                              content: 'Nouvelle Tâche',
                              link: { url: tasksUrl }
                            },
                            annotations: { bold: true }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                type: 'column',
                column: {
                  children: [
                    {
                      type: 'callout',
                      callout: {
                        icon: { emoji: '📋' },
                        color: 'green_background',
                        rich_text: [
                          {
                            text: {
                              content: 'Nouveau Projet',
                              link: { url: projectsUrl }
                            },
                            annotations: { bold: true }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                type: 'column',
                column: {
                  children: [
                    {
                      type: 'callout',
                      callout: {
                        icon: { emoji: '📁' },
                        color: 'yellow_background',
                        rich_text: [
                          {
                            text: {
                              content: 'Nouveau Dossier',
                              link: { url: dossierUrl }
                            },
                            annotations: { bold: true }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                type: 'column',
                column: {
                  children: [
                    {
                      type: 'callout',
                      callout: {
                        icon: { emoji: '📝' },
                        color: 'purple_background',
                        rich_text: [
                          {
                            text: {
                              content: 'Nouveau Contrat',
                              link: { url: contractsUrl }
                            },
                            annotations: { bold: true }
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        { type: 'divider', divider: {} },

        // Navigation Section
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '🔗 Accès Rapide aux Bases' } }]
          }
        },
        {
          type: 'column_list',
          column_list: {
            children: [
              {
                type: 'column',
                column: {
                  children: [
                    {
                      type: 'callout',
                      callout: {
                        icon: { emoji: '📋' },
                        color: 'gray_background',
                        rich_text: [
                          {
                            text: {
                              content: '📋 PROJETS\n',
                              link: { url: projectsUrl }
                            },
                            annotations: { bold: true }
                          },
                          {
                            text: { content: 'Tous les projets en cours et terminés' }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                type: 'column',
                column: {
                  children: [
                    {
                      type: 'callout',
                      callout: {
                        icon: { emoji: '✅' },
                        color: 'gray_background',
                        rich_text: [
                          {
                            text: {
                              content: '✅ TÂCHES\n',
                              link: { url: tasksUrl }
                            },
                            annotations: { bold: true }
                          },
                          {
                            text: { content: 'Toutes les tâches à faire' }
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          type: 'column_list',
          column_list: {
            children: [
              {
                type: 'column',
                column: {
                  children: [
                    {
                      type: 'callout',
                      callout: {
                        icon: { emoji: '📁' },
                        color: 'gray_background',
                        rich_text: [
                          {
                            text: {
                              content: '📁 DOSSIERS CLIENTS\n',
                              link: { url: dossierUrl }
                            },
                            annotations: { bold: true }
                          },
                          {
                            text: { content: 'Rechercher et gérer les dossiers' }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                type: 'column',
                column: {
                  children: [
                    {
                      type: 'callout',
                      callout: {
                        icon: { emoji: '📝' },
                        color: 'gray_background',
                        rich_text: [
                          {
                            text: {
                              content: '📝 CONTRATS\n',
                              link: { url: contractsUrl }
                            },
                            annotations: { bold: true }
                          },
                          {
                            text: { content: 'Tous les contrats d\'assurance' }
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        { type: 'divider', divider: {} },

        // Tips section
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '💡 Astuces' } }]
          }
        },
        {
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ text: { content: 'Utilisez Ctrl+K (ou Cmd+K) pour rechercher rapidement un dossier ou un élément' } }]
          }
        },
        {
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ text: { content: 'Cliquez sur un bouton coloré pour ouvrir la base et créer un nouvel élément' } }]
          }
        },
        {
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ text: { content: 'Les liens gris ouvrent les vues complètes des bases de données' } }]
          }
        }
      ]
    });

    console.log('\n✅ Dashboard created successfully!');
    console.log('📊 URL:', dashboard.url);
    console.log('\nLe tableau de bord contient:');
    console.log('- 4 boutons rapides pour créer: Tâche, Projet, Dossier, Contrat');
    console.log('- 4 liens vers les bases de données complètes');
    console.log('- Section astuces pour la navigation');
    console.log('\nOuvrez ce lien dans Notion:', dashboard.url);

  } catch (error) {
    console.error('Error creating dashboard:', error.message);
    if (error.body) {
      console.error('Details:', JSON.stringify(error.body, null, 2));
    }
    process.exit(1);
  }
}

createDashboard();

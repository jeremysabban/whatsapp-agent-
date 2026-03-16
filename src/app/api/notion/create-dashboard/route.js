import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

/**
 * POST /api/notion/create-dashboard
 * Creates a dashboard page in Notion with linked databases
 */
export async function POST(request) {
  try {
    // Get the parent page ID from the request or use workspace root
    const body = await request.json().catch(() => ({}));
    const parentPageId = body.parentPageId || '2dcac984-46f5-811a-b1f7-c9e468ea3f9e';

    const dossierDbId = process.env.NOTION_DOSSIERS_DB_ID;
    const tasksDbId = process.env.NOTION_TASKS_DB_ID;
    const projectsDbId = process.env.NOTION_PROJECTS_DB_ID;
    const contractsDbId = process.env.NOTION_CONTRACTS_DB_ID;

    // Create the dashboard page
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
            rich_text: [{ text: { content: '📊 Tableau de Bord' } }]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: 'Vue centralisée des projets, tâches, dossiers et contrats.' } }]
          }
        },
        { type: 'divider', divider: {} },

        // Quick Actions Section
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '⚡ Actions Rapides' } }]
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
                              link: { url: `https://www.notion.so/${tasksDbId.replace(/-/g, '')}?v=new` }
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
                              link: { url: `https://www.notion.so/${projectsDbId.replace(/-/g, '')}?v=new` }
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
                              link: { url: `https://www.notion.so/${dossierDbId.replace(/-/g, '')}?v=new` }
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
                              link: { url: `https://www.notion.so/${contractsDbId.replace(/-/g, '')}?v=new` }
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

        // Projects Section
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '📋 Projets en Cours' } }]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: '' } }]
          }
        },

        // Tasks Section
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '✅ Tâches à Faire' } }]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: '' } }]
          }
        },

        // Dossiers Section
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '📁 Dossiers Récents' } }]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: '' } }]
          }
        },

        // Contracts Section
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: '📝 Contrats' } }]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: '' } }]
          }
        }
      ]
    });

    // Now add linked databases as children (need separate API calls)
    // Add Projects linked database
    await notion.blocks.children.append({
      block_id: dashboard.id,
      children: [
        {
          type: 'link_to_page',
          link_to_page: {
            type: 'database_id',
            database_id: projectsDbId
          }
        }
      ]
    });

    // Add Tasks linked database
    await notion.blocks.children.append({
      block_id: dashboard.id,
      children: [
        {
          type: 'link_to_page',
          link_to_page: {
            type: 'database_id',
            database_id: tasksDbId
          }
        }
      ]
    });

    // Add Dossiers linked database
    await notion.blocks.children.append({
      block_id: dashboard.id,
      children: [
        {
          type: 'link_to_page',
          link_to_page: {
            type: 'database_id',
            database_id: dossierDbId
          }
        }
      ]
    });

    // Add Contracts linked database
    await notion.blocks.children.append({
      block_id: dashboard.id,
      children: [
        {
          type: 'link_to_page',
          link_to_page: {
            type: 'database_id',
            database_id: contractsDbId
          }
        }
      ]
    });

    return NextResponse.json({
      success: true,
      dashboardId: dashboard.id,
      url: dashboard.url,
      message: 'Tableau de bord créé avec succès'
    });

  } catch (error) {
    console.error('[NOTION] Error creating dashboard:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/notion/create-dashboard
 * Returns info about how to create the dashboard
 */
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to create the dashboard',
    instructions: 'POST with optional { parentPageId: "..." } to specify where to create the dashboard'
  });
}

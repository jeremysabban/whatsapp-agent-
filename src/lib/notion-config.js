// Notion API configuration
export const NOTION_API_KEY = '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';
export const NOTION_DOSSIERS_DB_ID = '8f32e57fff6a4d26b5ab502142e8f8d6';
export const NOTION_VERSION = '2022-06-28';

// Base IDs for task/project creation
export const NOTION_TASKS_DB_ID = '2dcac98446f5813a9389d0a675eec96f';
export const NOTION_PROJECTS_DB_ID = '2dcac98446f5819db597ee01fb67ac27';
export const NOTION_CONTRACTS_DB_ID = ''; // TODO: Add contracts database ID

export function notionHeaders() {
  return {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

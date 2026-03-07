// Notion API configuration — values loaded from .env.local
const requiredEnvVars = [
  'NOTION_API_KEY',
  'NOTION_DOSSIERS_DB_ID',
  'NOTION_TASKS_DB_ID',
  'NOTION_PROJECTS_DB_ID',
  'NOTION_CONTRACTS_DB_ID',
  'NOTION_CONTACTS_DB_ID',
];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing Env Var: ${key} — check your .env.local`);
  }
}

export const NOTION_API_KEY = process.env.NOTION_API_KEY;
export const NOTION_DOSSIERS_DB_ID = process.env.NOTION_DOSSIERS_DB_ID;
export const NOTION_TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;
export const NOTION_PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID;
export const NOTION_CONTRACTS_DB_ID = process.env.NOTION_CONTRACTS_DB_ID;
export const NOTION_CONTACTS_DB_ID = process.env.NOTION_CONTACTS_DB_ID;
export const NOTION_VERSION = '2022-06-28';

export function notionHeaders() {
  return {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

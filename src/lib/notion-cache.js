// Notion Cache System - Keeps data in memory with scheduled refresh
import { notionHeaders, NOTION_DOSSIERS_DB_ID, NOTION_CONTACTS_DB_ID, NOTION_TASKS_DB_ID, NOTION_PROJECTS_DB_ID } from './notion-config.js';

// Use global to persist cache across Next.js hot reloads in dev mode
const globalCache = globalThis;

if (!globalCache._notionCache) {
  globalCache._notionCache = {
    contacts: { data: null, lastUpdate: null },
    dossiers: { data: null, lastUpdate: null },
    tasks: { data: null, lastUpdate: null },
    projects: { data: null, lastUpdate: null },
  };
}

if (!globalCache._schedulerStarted) {
  globalCache._schedulerStarted = false;
}

// Reference the global cache
const cache = globalCache._notionCache;

// Fetch all pages from a Notion database with pagination
async function fetchAllPages(databaseId, filter = {}, sorts = []) {
  let allResults = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const body = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;
    if (Object.keys(filter).length > 0) body.filter = filter;
    if (sorts.length > 0) body.sorts = sorts;

    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`Notion API error for ${databaseId}:`, await response.text());
      break;
    }

    const data = await response.json();
    allResults = allResults.concat(data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return allResults;
}

// Refresh contacts cache
async function refreshContacts() {
  console.log('[CACHE] Refreshing contacts...');
  try {
    const results = await fetchAllPages(NOTION_CONTACTS_DB_ID);
    const contacts = results.map(page => ({
      id: page.id,
      name: page.properties['Nom_Prénom']?.title?.[0]?.plain_text || '',
      phone: page.properties['*Téléphone']?.phone_number || '',
      email: page.properties['*E-mail']?.email || '',
      status: page.properties['Statut contact']?.multi_select?.map(s => s.name) || [],
      hasWhatsapp: page.properties['Whatsapp']?.checkbox || false,
      dossierId: page.properties['💬 Dossier']?.relation?.[0]?.id || null,
      url: page.url,
    }));
    cache.contacts = { data: contacts, lastUpdate: new Date() };
    console.log(`[CACHE] Contacts refreshed: ${contacts.length} items`);
    return contacts;
  } catch (error) {
    console.error('[CACHE] Error refreshing contacts:', error);
    return cache.contacts.data;
  }
}

// Helper to find title property dynamically
function findTitleProperty(properties) {
  for (const [key, value] of Object.entries(properties)) {
    if (value.type === 'title' && value.title?.[0]?.plain_text) {
      return value.title[0].plain_text;
    }
  }
  return '';
}

// Refresh dossiers cache
async function refreshDossiers() {
  console.log('[CACHE] Refreshing dossiers...');
  try {
    const results = await fetchAllPages(NOTION_DOSSIERS_DB_ID);
    const dossiers = results.map(page => ({
      id: page.id,
      name: findTitleProperty(page.properties),
      identifiant: page.properties['Identifiant']?.rich_text?.[0]?.plain_text || '',
      status: page.properties['Service Lead']?.select?.name || '',
      phone: page.properties['telephone']?.rollup?.array?.[0]?.phone_number || '',
      email: page.properties['🫅 Email']?.rollup?.array?.[0]?.email || '',
      driveUrl: page.properties['Google drive']?.url || '',
      geminiUrl: page.properties['Gemini GPT']?.url || '',
      url: page.url,
    }));
    cache.dossiers = { data: dossiers, lastUpdate: new Date() };
    console.log(`[CACHE] Dossiers refreshed: ${dossiers.length} items`);
    return dossiers;
  } catch (error) {
    console.error('[CACHE] Error refreshing dossiers:', error);
    return cache.dossiers.data;
  }
}

// Fetch page content (blocks) to extract notes
async function fetchPageContent(pageId) {
  try {
    const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=20`, {
      headers: notionHeaders(),
    });
    if (!response.ok) return '';
    const data = await response.json();

    // Extract text from blocks (paragraphs, headings, etc.)
    const texts = [];
    for (const block of data.results || []) {
      const richText = block.paragraph?.rich_text
        || block.heading_1?.rich_text
        || block.heading_2?.rich_text
        || block.heading_3?.rich_text
        || block.bulleted_list_item?.rich_text
        || block.numbered_list_item?.rich_text
        || block.to_do?.rich_text;
      if (richText?.length > 0) {
        texts.push(richText.map(t => t.plain_text).join(''));
      }
    }
    return texts.join(' ').substring(0, 500); // Limit to 500 chars
  } catch {
    return '';
  }
}

// Refresh tasks cache (all tasks, not just open ones)
async function refreshTasks() {
  console.log('[CACHE] Refreshing tasks...');
  try {
    const results = await fetchAllPages(NOTION_TASKS_DB_ID, {}, [
      { timestamp: 'created_time', direction: 'descending' }
    ]);

    // Fetch page content for each task (in batches of 10)
    console.log('[CACHE] Fetching task content...');
    const taskContents = {};
    for (let i = 0; i < results.length; i += 10) {
      const batch = results.slice(i, i + 10);
      const contents = await Promise.all(batch.map(p => fetchPageContent(p.id)));
      batch.forEach((p, idx) => { taskContents[p.id] = contents[idx]; });
    }

    const tasks = results.map(page => {
      // Try property first, then page content
      const noteProps = ['Note', 'Notes', 'Description', 'Détails', 'Commentaire'];
      let note = '';
      for (const prop of noteProps) {
        const richText = page.properties[prop]?.rich_text;
        if (richText?.length > 0) {
          note = richText.map(t => t.plain_text).join('');
          break;
        }
      }
      // If no property note, use page content
      if (!note) {
        note = taskContents[page.id] || '';
      }

      // Get assignee (select type field)
      const assignee = page.properties['Responsable']?.select?.name || null;

      // Get task type (select type field: Appel, Email, Autre)
      const taskType = page.properties['Type de tâche']?.select?.name || null;

      return {
        id: page.id,
        name: page.properties['Tâche']?.title?.[0]?.plain_text || '',
        completed: page.properties['Statut']?.checkbox || false,
        priority: page.properties['Priorité']?.status?.name || page.properties['Priorité']?.select?.name || '',
        date: page.properties['Date']?.date?.start || null,
        dossierId: page.properties['💬 Dossiers']?.relation?.[0]?.id || null,
        projectId: page.properties['Projet']?.relation?.[0]?.id || null,
        assignee,
        taskType,
        note,
        createdAt: page.created_time,
        url: page.url,
      };
    });
    cache.tasks = { data: tasks, lastUpdate: new Date() };
    console.log(`[CACHE] Tasks refreshed: ${tasks.length} items`);
    return tasks;
  } catch (error) {
    console.error('[CACHE] Error refreshing tasks:', error);
    return cache.tasks.data;
  }
}

// Refresh projects cache
// Refresh projects cache (all projects)
async function refreshProjects() {
  console.log('[CACHE] Refreshing projects...');
  try {
    const results = await fetchAllPages(NOTION_PROJECTS_DB_ID, {}, [
      { timestamp: 'last_edited_time', direction: 'descending' }
    ]);
    const projects = results.map(page => ({
      id: page.id,
      name: page.properties['Name']?.title?.[0]?.plain_text || '',
      type: page.properties['Type']?.select?.name || '',
      completed: page.properties['Terminé']?.checkbox || false,
      priority: page.properties['Priorité']?.status?.name || page.properties['Priorité']?.select?.name || '',
      level: page.properties['Niveau du Projet']?.status?.name || page.properties['Niveau du Projet']?.select?.name || '',
      dossierId: page.properties['💬 Dossiers']?.relation?.[0]?.id || null,
      date: page.properties['Date']?.date?.start || null,
      url: page.url,
    }));
    cache.projects = { data: projects, lastUpdate: new Date() };
    console.log(`[CACHE] Projects refreshed: ${projects.length} items`);
    return projects;
  } catch (error) {
    console.error('[CACHE] Error refreshing projects:', error);
    return cache.projects.data;
  }
}

// Refresh all caches
export async function refreshAllCaches() {
  console.log('[CACHE] Starting full refresh...');
  const start = Date.now();

  await Promise.all([
    refreshContacts(),
    refreshDossiers(),
    refreshTasks(),
    refreshProjects(),
  ]);

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[CACHE] Full refresh completed in ${duration}s`);

  return {
    contacts: cache.contacts.data?.length || 0,
    dossiers: cache.dossiers.data?.length || 0,
    tasks: cache.tasks.data?.length || 0,
    projects: cache.projects.data?.length || 0,
    lastUpdate: new Date().toISOString(),
    duration: `${duration}s`,
  };
}

// Get cached data (returns null if not cached yet)
export function getCache(type) {
  return cache[type] || null;
}

// Get all cache status
export function getCacheStatus() {
  return {
    contacts: { count: cache.contacts.data?.length || 0, lastUpdate: cache.contacts.lastUpdate },
    dossiers: { count: cache.dossiers.data?.length || 0, lastUpdate: cache.dossiers.lastUpdate },
    tasks: { count: cache.tasks.data?.length || 0, lastUpdate: cache.tasks.lastUpdate },
    projects: { count: cache.projects.data?.length || 0, lastUpdate: cache.projects.lastUpdate },
  };
}

// Check if we're within business hours (9h-19h Paris time)
function isBusinessHours() {
  const now = new Date();
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const hour = parisTime.getHours();
  return hour >= 9 && hour < 19;
}

// Start the scheduler (called once on app start)
export function startScheduler() {
  if (globalCache._schedulerStarted) return;
  globalCache._schedulerStarted = true;

  console.log('[CACHE] Scheduler started - will refresh every 30 min between 9h-19h (Paris time)');

  // Initial refresh on start
  refreshAllCaches();

  // Refresh every 30 minutes during business hours (9h-19h)
  setInterval(() => {
    if (isBusinessHours()) {
      console.log('[CACHE] Scheduled refresh triggered (30 min interval)');
      refreshAllCaches();
    }
  }, 30 * 60 * 1000); // Every 30 minutes
}

// Lookup functions for quick access by ID
export function getDossierById(id) {
  if (!cache.dossiers.data) return null;
  return cache.dossiers.data.find(d => d.id === id) || null;
}

export function getProjectById(id) {
  if (!cache.projects.data) return null;
  return cache.projects.data.find(p => p.id === id) || null;
}

export function getTaskById(id) {
  if (!cache.tasks.data) return null;
  return cache.tasks.data.find(t => t.id === id) || null;
}

export function getContactById(id) {
  if (!cache.contacts.data) return null;
  return cache.contacts.data.find(c => c.id === id) || null;
}

// Ensure cache is populated (call this before using cache)
export async function ensureCachePopulated() {
  const needsRefresh = !cache.contacts.data || !cache.dossiers.data || !cache.tasks.data || !cache.projects.data;
  if (needsRefresh) {
    console.log('[CACHE] Cache empty, triggering refresh...');
    await refreshAllCaches();
  }
  return true;
}

// Export individual refresh functions for manual refresh
export { refreshContacts, refreshDossiers, refreshTasks, refreshProjects };

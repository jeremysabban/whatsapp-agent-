import { NextResponse } from 'next/server';
import { refreshAllCaches, getCacheStatus, getCache, startScheduler } from '@/lib/notion-cache';

// Start scheduler on first API call
let initialized = false;

function ensureInitialized() {
  if (!initialized) {
    startScheduler();
    initialized = true;
  }
}

// GET - Get cache status
export async function GET() {
  ensureInitialized();

  const status = getCacheStatus();
  return NextResponse.json({
    status: 'ok',
    cache: status,
    nextScheduledRefresh: getNextRefreshTime(),
  });
}

// POST - Manual refresh
export async function POST(request) {
  ensureInitialized();

  try {
    const body = await request.json().catch(() => ({}));
    const type = body.type; // Optional: 'contacts', 'dossiers', 'tasks', 'projects'

    let result;
    if (type) {
      // Refresh specific cache
      const { refreshContacts, refreshDossiers, refreshTasks, refreshProjects } = await import('@/lib/notion-cache');
      switch (type) {
        case 'contacts':
          await refreshContacts();
          break;
        case 'dossiers':
          await refreshDossiers();
          break;
        case 'tasks':
          await refreshTasks();
          break;
        case 'projects':
          await refreshProjects();
          break;
        default:
          return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
      }
      result = { refreshed: type };
    } else {
      // Refresh all
      result = await refreshAllCaches();
    }

    return NextResponse.json({
      status: 'ok',
      ...result,
      cache: getCacheStatus(),
    });
  } catch (error) {
    console.error('Cache refresh error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getNextRefreshTime() {
  const now = new Date();
  const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const hour = paris.getHours();

  let nextHour;
  if (hour < 8) nextHour = 8;
  else if (hour < 13) nextHour = 13;
  else if (hour < 19) nextHour = 19;
  else nextHour = 8; // Tomorrow

  const next = new Date(paris);
  next.setHours(nextHour, 0, 0, 0);
  if (nextHour === 8 && hour >= 19) {
    next.setDate(next.getDate() + 1);
  }

  return next.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
}

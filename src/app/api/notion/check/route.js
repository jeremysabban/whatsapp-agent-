import { NextResponse } from 'next/server';
import { NOTION_API_KEY, NOTION_DOSSIERS_DB_ID, notionHeaders } from '@/lib/notion-config';

export async function GET() {
  const status = {
    hasApiKey: true,
    hasDbId: true,
    apiKeyPrefix: NOTION_API_KEY.substring(0, 10) + '...',
    dbId: NOTION_DOSSIERS_DB_ID,
    configured: true,
  };
  
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DOSSIERS_DB_ID}`, {
      headers: notionHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      status.connectionOk = true;
      status.dbTitle = data.title?.[0]?.plain_text || 'Sans titre';
    } else {
      const err = await res.json();
      status.connectionOk = false;
      status.error = err.message || `HTTP ${res.status}`;
    }
  } catch (e) {
    status.connectionOk = false;
    status.error = e.message;
  }
  
  return NextResponse.json(status);
}

import { NextResponse } from 'next/server';
import { getAgentLogs, getAgentLogCount } from '@/lib/database';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type') || null;

    const logs = getAgentLogs(limit, offset, type);
    const total = getAgentLogCount(type);

    return NextResponse.json({ logs, total, limit, offset });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

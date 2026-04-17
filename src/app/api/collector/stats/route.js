import { NextResponse } from 'next/server';
import { getCollectorStats } from '@/lib/drive-collector';

export const dynamic = 'force-dynamic';

/**
 * GET /api/collector/stats
 *
 * Stats du collector (totaux, par source, récents)
 */
export async function GET() {
  try {
    const stats = getCollectorStats();
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

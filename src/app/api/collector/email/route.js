import { NextResponse } from 'next/server';
import { collectEmailAttachments } from '@/lib/drive-collector';

export const dynamic = 'force-dynamic';

/**
 * POST /api/collector/email
 *
 * Scan Gmail pour les PJ des compagnies d'assurance → A TRIER
 * Appelé par le cron toutes les 30 min ou manuellement
 */
export async function POST() {
  try {
    const results = await collectEmailAttachments();

    return NextResponse.json({
      success: true,
      ...results,
      summary: `${results.uploaded.length} PJ email envoyée(s) vers A TRIER, ${results.skipped.length} déjà traité(s)`
    });
  } catch (err) {
    console.error('[COLLECTOR API] Email error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

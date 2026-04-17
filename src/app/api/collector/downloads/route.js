import { NextResponse } from 'next/server';
import { collectDownloadsFolder } from '@/lib/drive-collector';

export const dynamic = 'force-dynamic';

/**
 * POST /api/collector/downloads
 * Body (optional): { dir: "C:\\Users\\Jeremy\\Downloads" }
 *
 * Scan le dossier Downloads pour les nouveaux fichiers → A TRIER
 * Appelé par le cron toutes les 30 min ou manuellement
 */
export async function POST(request) {
  try {
    let customDir = null;
    try {
      const body = await request.json();
      customDir = body?.dir || null;
    } catch {
      // No body is fine
    }

    const results = await collectDownloadsFolder(customDir);

    return NextResponse.json({
      success: true,
      ...results,
      summary: `${results.uploaded.length} fichier(s) du Downloads envoyé(s) vers A TRIER, ${results.skipped.length} déjà traité(s)`
    });
  } catch (err) {
    console.error('[COLLECTOR API] Downloads error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { generateRecap, getNextRecapTime } from '@/lib/recap-engine';

/**
 * POST /api/recap
 * Déclenche un recap immédiat
 */
export async function POST(request) {
  try {
    console.log('[API/RECAP] Manual recap triggered');
    const result = await generateRecap();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Recap généré et envoyé',
        recap: result.recap
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        recap: result.recap // Include recap even if send failed
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[API/RECAP] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/recap/status
 * Retourne l'heure du prochain recap
 */
export async function GET(request) {
  try {
    const nextRecap = getNextRecapTime();

    return NextResponse.json({
      success: true,
      nextRecap: nextRecap.toISOString(),
      nextRecapFormatted: nextRecap.toLocaleString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      }),
      schedule: ['8h00', '11h00', '15h00', '18h00'],
      days: 'Lundi - Samedi'
    });
  } catch (error) {
    console.error('[API/RECAP] Status error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

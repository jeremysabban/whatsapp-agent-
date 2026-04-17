import { NextResponse } from 'next/server';
import { collectWhatsAppDocs } from '@/lib/drive-collector';

export const dynamic = 'force-dynamic';

/**
 * POST /api/collector/whatsapp
 * Body: { conversationJid: "xxx@s.whatsapp.net" }
 *
 * Upload tous les docs WhatsApp d'un contact vers A TRIER (hors vocaux)
 */
export async function POST(request) {
  try {
    const { conversationJid } = await request.json();

    if (!conversationJid) {
      return NextResponse.json({ error: 'conversationJid requis' }, { status: 400 });
    }

    const results = await collectWhatsAppDocs(conversationJid);

    return NextResponse.json({
      success: true,
      ...results,
      summary: `${results.uploaded.length} envoyé(s) vers A TRIER, ${results.skipped.length} déjà traité(s), ${results.errors.length} erreur(s)`
    });
  } catch (err) {
    console.error('[COLLECTOR API] WhatsApp error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import {
  getDossierConversation
} from '@/lib/database';
import {
  buildClientContext360
} from '@/lib/knowledge-base';
import { chatWithDossier } from '@/lib/claude-brain';

/**
 * GET /api/dossier-chat?dossierId=xxx
 * Récupère l'historique de conversation et le contexte 360°
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dossierId = searchParams.get('dossierId');

    if (!dossierId) {
      return NextResponse.json({ error: 'dossierId requis' }, { status: 400 });
    }

    // Charger la conversation existante
    const conversation = getDossierConversation(dossierId);
    const history = conversation?.messages || [];

    // Charger le contexte 360°
    const context360 = await buildClientContext360(dossierId);

    return NextResponse.json({
      success: true,
      history,
      context360
    });

  } catch (error) {
    console.error('[DOSSIER-CHAT] GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/dossier-chat
 * Envoie un message et reçoit une réponse de Claude
 *
 * Body: {
 *   dossierId: string,
 *   message: string,
 *   document?: {
 *     type: 'base64',
 *     mediaType: string,
 *     data: string (base64)
 *   }
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { dossierId, message, document } = body;

    if (!dossierId) {
      return NextResponse.json({ error: 'dossierId requis' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'message requis' }, { status: 400 });
    }

    // 1. Charger la conversation existante pour l'historique
    const existingConversation = getDossierConversation(dossierId);
    const conversationHistory = (existingConversation?.messages || [])
      .slice(-20) // Derniers 20 messages
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    console.log('[DOSSIER-CHAT] History:', conversationHistory.length, 'messages');
    console.log('[DOSSIER-CHAT] Message:', message.substring(0, 100) + '...');
    console.log('[DOSSIER-CHAT] Document:', document ? `${document.mediaType} (${(document.data?.length || 0)} chars)` : 'none');

    // 2. Appeler chatWithDossier avec support document
    const response = await chatWithDossier(
      message,
      dossierId,
      conversationHistory,
      document // { type: 'base64', mediaType: 'application/pdf', data: '...' }
    );

    // 3. Récupérer l'historique mis à jour
    const updatedConversation = getDossierConversation(dossierId);
    const history = updatedConversation?.messages || [];

    return NextResponse.json({
      success: true,
      response: response,
      history
    });

  } catch (error) {
    console.error('[DOSSIER-CHAT] POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

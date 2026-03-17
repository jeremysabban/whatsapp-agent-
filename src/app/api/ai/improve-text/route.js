import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { text, context } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Texte requis' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `Tu es un assistant d'écriture professionnel français.
Tu améliores les textes pour les rendre plus clairs, professionnels et efficaces.

RÈGLES:
- Garde le sens original du message
- Corrige les fautes d'orthographe et de grammaire
- Améliore la formulation pour être plus professionnel
- Garde un ton adapté au contexte (formel pour emails/tâches, cordial pour WhatsApp)
- Ne change pas radicalement le message, juste l'améliore
- Réponds UNIQUEMENT avec le texte amélioré, sans explication
- Si le texte est déjà bien, renvoie-le tel quel ou avec corrections mineures

CONTEXTE: ${context || 'message professionnel'}`,
      generationConfig: { temperature: 0.3 }
    });

    const result = await model.generateContent(`Améliore ce texte: "${text}"`);
    const improvedText = result.response.text().trim();

    // Remove quotes if the AI added them
    const cleaned = improvedText.replace(/^["']|["']$/g, '');

    return NextResponse.json({
      original: text,
      improved: cleaned,
      success: true
    });

  } catch (err) {
    console.error('[AI] Improve text error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

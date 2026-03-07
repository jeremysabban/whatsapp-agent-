import { NextResponse } from 'next/server';
import { processAudioCommand } from '@/lib/gemini-brain';
import { scheduleReminder, addNoteToDossier, createTask } from '@/lib/gemini-tools';

export async function POST(req) {
  try {
    // 1. Récupération de l'audio (Base64 envoyé par le frontend)
    const { audioBase64 } = await req.json();
    if (!audioBase64) return NextResponse.json({ error: "Pas d'audio" }, { status: 400 });

    // 2. LE CERVEAU : Analyse (Audio -> JSON)
    const analysis = await processAudioCommand(audioBase64);

    // Si Gemini n'a rien compris ou renvoie une erreur
    if (!analysis || analysis.error) {
      return NextResponse.json({
        message: "Je n'ai pas bien entendu. Peux-tu répéter ?"
      });
    }

    // 3. LES MAINS : Exécution de l'action
    let result = { message: "Action non reconnue." };

    switch (analysis.intention) {
      case 'RAPPEL':
        if (analysis.time && analysis.action) {
          result = await scheduleReminder(analysis.action, analysis.time);
        } else {
          result = { message: "J'ai compris le rappel, mais il manque l'heure." };
        }
        break;

      case 'NOTE':
        if (analysis.client && analysis.content) {
          result = await addNoteToDossier(analysis.client, analysis.content);
        } else {
          result = { message: "C'est une note, mais je n'ai pas reconnu le client." };
        }
        break;

      case 'TACHE':
        if (analysis.content) {
          result = await createTask(analysis.content);
        }
        break;

      default:
        result = { message: `J'ai compris : "${analysis.content}", mais je ne sais pas quoi en faire.` };
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Brain Error:", error);
    return NextResponse.json({ error: "Erreur interne du cerveau" }, { status: 500 });
  }
}

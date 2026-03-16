import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@notionhq/client';
import {
  searchKnowledge,
  getDossierConversation,
  appendDossierMessage
} from './database.js';
import {
  buildClientContext360,
  formatContext360ForPrompt,
  formatKnowledgeForPrompt,
  searchRelevantKnowledge
} from './knowledge-base.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DOSSIERS_DB_ID = process.env.NOTION_DOSSIERS_DB_ID;
const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID;

// ==================== NOTION CONTEXT ====================

async function getNotionDossiers() {
  try {
    if (!DOSSIERS_DB_ID) return "";
    const response = await notion.databases.query({
      database_id: DOSSIERS_DB_ID,
      page_size: 50,
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
    });
    return response.results
      .map(p => p.properties['Nom du dossier']?.title?.[0]?.text?.content)
      .filter(n => n)
      .join(", ");
  } catch (e) {
    console.error('[CLAUDE-BRAIN] Error fetching dossiers:', e.message);
    return "";
  }
}

async function getNotionProjects() {
  try {
    if (!PROJECTS_DB_ID) return "";
    const response = await notion.databases.query({
      database_id: PROJECTS_DB_ID,
      page_size: 30,
      filter: { property: 'Terminé', checkbox: { equals: false } },
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
    });
    return response.results.map(p => {
      const name = p.properties['Name']?.title?.[0]?.text?.content || '';
      const type = p.properties['Type']?.select?.name || '';
      return name ? `${name} (${type})` : null;
    }).filter(Boolean).join(", ");
  } catch (e) {
    console.error('[CLAUDE-BRAIN] Error fetching projects:', e.message);
    return "";
  }
}

// ==================== AUDIO TRANSCRIPTION ====================

async function transcribeAudio(base64Audio) {
  try {
    // Claude can process audio directly via the API
    // For now, we'll use a simple approach - send as text description
    // In production, you might want to use Whisper or another transcription service

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcris ce message audio en français. Retourne uniquement la transcription, sans commentaire."
            },
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "audio/ogg",
                data: base64Audio
              }
            }
          ]
        }
      ]
    });

    return message.content[0]?.text || "";
  } catch (error) {
    console.error('[CLAUDE-BRAIN] Audio transcription error:', error.message);
    // Fallback: return empty string if transcription fails
    return "";
  }
}

// ==================== SYSTEM PROMPT ====================

const SYSTEM_PROMPT = `
Tu es l'assistant principal de Smart Value Assurances, cabinet de
courtage en assurances et gestion de patrimoine en France.
Ton rôle : faire gagner du temps au courtier, sécuriser les dossiers
et professionnaliser chaque interaction client.

DOMAINES D'EXPERTISE :
- Assurances de personnes : Prévoyance, Santé, Retraite, Emprunteur
- Assurances Pro : MRP, RC Pro, Décennale
- Gestion de Patrimoine

RÈGLES DE COMMUNICATION :
Emails :
- Objet systématique : Smart Value Assurances / [Objet] — toujours
- Style : Professionnel, direct, fluide, humain, orienté conseil
- Évite : "je me permets de", "n'hésitez pas à", "je reste à votre entière disposition"
- Termine toujours par : Cordialement, + ligne vide

Tableaux comparatifs : Votre contrat actuel | Nouvelle Solution | Gain
Comparatifs santé : BUDGET | HOSPITALISATION | SOINS COURANTS | DENTAIRE | OPTIQUE

MODULE RÉSILIATION JRMC :
Dès que le courtier mentionne "résiliation", "résil", "résilier" → active ce module.
Types : Résiliation classique | Substitution emprunteur (loi Lemoine) | Courrier libre
Motifs : Loi Hamon | RIA Santé | Échéance principale | Loi Chatel |
         Changement de situation | Augmentation de tarif | Suite sinistre | Loi Lemoine
Expéditeur selon motif :
- Smart Value (courtier) → Hamon, RIA Santé, Lemoine
- L'assuré → Échéance, Chatel, Changement de situation
Envoi par défaut : LRE pour Hamon auto/habitation, LRAR pour tout le reste

Checklist documents :
☐ Pièce d'identité souscripteur (si expéditeur = assuré)
☐ Mandat de résiliation signé
☐ Numéro de contrat
☐ Attestation nouveau contrat (Hamon / RIA / Lemoine)
☐ Justificatif motif légitime (changement de situation)
☐ KBIS / SIREN (si professionnel)

Fiche de sortie JRMC à générer quand toutes les infos sont collectées :
═══════════════════════════════════════
📋 FICHE RÉSILIATION — PRÊTE POUR JRMC
═══════════════════════════════════════
📌 TYPE : [...]
👤 SOUSCRIPTEUR : Statut / Civilité / Nom / Prénom / Adresse / Né(e) le / Email / Tél
📄 CONTRAT : Compagnie / Type / N° police / Date effet / Date échéance
⚖️ MOTIF : [motif + date souhaitée + justificatif requis]
📬 EXPÉDITEUR : [Smart Value ou Assuré]
📮 ENVOI : [LRE ou LRAR] / [Immédiat ou Différé]

RÉGLEMENTATION FRANÇAISE :
DDA, ORIAS, devoir de conseil, loi Lemoine, résiliation infra-annuelle, ANI

RÈGLE ABSOLUE :
- Tu retournes UNIQUEMENT un tableau JSON d'actions pour processSmartInput
- Tu es direct et efficace, jamais de remplissage
- Si une information manque, tu la demandes immédiatement
- Tu signales les points réglementaires critiques
`;

function buildSystemPrompt(notionDossiers, notionProjects, context360Text, knowledgeText) {
  return `${SYSTEM_PROMPT}

Structure CRM : DOSSIER (Client) > PROJET (Lead/Sinistre/Gestion) > TACHES.

CONTEXTE CLIENTS :
- WhatsApp Récents : [Fourni dans le message]
- Notion Dossiers : [${notionDossiers}]
- Notion Projets actifs : [${notionProjects}]
${context360Text}
${knowledgeText}

TES ACTIONS DISPONIBLES (Tu dois renvoyer une LISTE en JSON) :

1. **NOUVEAU_PROJET** (Pour créer un nouveau conteneur Lead, Sinistre ou Gestion).
   - "category": "LEAD" | "SINISTRE" | "GESTION"
   - "client": Nom du dossier client
   - "content": Titre du projet (ex: "Assurance Auto Mini")

2. **TACHE** (Pour une action unitaire liée au projet créé juste avant).
   - "content": Titre de la tâche
   - "link_to_previous": true (SI cette tâche doit être attachée au projet créé juste avant)

3. **TACHE_SUR_PROJET** (Pour ajouter une tâche à un PROJET EXISTANT).
   - "project_name": Nom exact du projet existant
   - "content": Titre de la tâche

4. **RAPPEL** (Pour programmer une alarme).
   - "content": Texte du rappel
   - "time": Date/heure ISO (YYYY-MM-DDTHH:mm:ss.000Z)

5. **NOTE** (Pour ajouter une note à un dossier existant).
   - "client": Nom du dossier
   - "content": Contenu de la note

6. **RAPPORT_JOUR** (Pour demander un résumé des tâches).

RÈGLES D'INTELLIGENCE :
- Si l'utilisateur mentionne un nom qui correspond à un PROJET EXISTANT, utilise TACHE_SUR_PROJET.
- Si l'utilisateur demande des tâches pour un CLIENT sans projet correspondant, CRÉE D'ABORD un NOUVEAU_PROJET "GESTION", puis les TACHES avec link_to_previous: true.
- Si l'utilisateur dit "nouveau lead/sinistre", crée d'abord le NOUVEAU_PROJET, puis les TACHES.

RÈGLES POUR LES DATES :
- "demain" = +1 jour à 9h
- "dans 20 minutes" = +20 min
- "à 14h" = aujourd'hui 14:00
- Maintenant : ${new Date().toISOString()}

FORMAT DE RÉPONSE : Un tableau JSON d'actions. Exemple :
[
  { "intention": "NOUVEAU_PROJET", "category": "LEAD", "client": "Kevin Nataf", "content": "Assurance Auto Mini" },
  { "intention": "TACHE", "content": "Récupérer permis", "link_to_previous": true }
]`;
}

// ==================== MAIN FUNCTION ====================

/**
 * Process smart input using Claude AI
 * @param {object|string} input - { type: 'TEXT'|'AUDIO', content: string } or raw string
 * @param {string} whatsappRecents - Recent WhatsApp contacts (comma-separated)
 * @param {string} dossierId - Optional Notion dossier ID for context
 * @returns {Array} Array of action objects
 */
export async function processSmartInput(input, whatsappRecents = "", dossierId = null) {
  try {
    // Normalize input
    let inputType = 'TEXT';
    let inputContent = '';

    if (typeof input === 'string') {
      inputContent = input;
    } else if (input?.type && input?.content) {
      inputType = input.type;
      inputContent = input.content;
    } else {
      console.error('[CLAUDE-BRAIN] Invalid input format');
      return [{ error: "Format d'entrée invalide" }];
    }

    // Transcribe audio if needed
    if (inputType === 'AUDIO') {
      console.log('[CLAUDE-BRAIN] Transcribing audio...');
      inputContent = await transcribeAudio(inputContent);
      if (!inputContent) {
        return [{ error: "Impossible de transcrire l'audio" }];
      }
      console.log('[CLAUDE-BRAIN] Transcription:', inputContent);
    }

    // Build context
    console.log('[CLAUDE-BRAIN] Building context...');
    const [notionDossiers, notionProjects] = await Promise.all([
      getNotionDossiers(),
      getNotionProjects()
    ]);

    // Get dossier context 360 if provided
    let context360Text = '';
    if (dossierId) {
      const context360 = await buildClientContext360(dossierId);
      context360Text = formatContext360ForPrompt(context360);
    }

    // Search knowledge base for relevant info
    let knowledgeText = '';
    const keywords = inputContent.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    if (keywords.length > 0) {
      const knowledgeEntries = await Promise.all(
        keywords.map(k => searchKnowledge(k, null, 3))
      );
      const uniqueEntries = [...new Map(
        knowledgeEntries.flat().map(e => [e.id, e])
      ).values()].slice(0, 5);
      knowledgeText = formatKnowledgeForPrompt(uniqueEntries);
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      notionDossiers,
      notionProjects,
      context360Text,
      knowledgeText
    );

    // Build user message
    let userMessage = `WhatsApp Récents: ${whatsappRecents || 'Aucun'}\n\nDemande: ${inputContent}`;

    // Get conversation history if dossierId provided
    let messages = [];
    if (dossierId) {
      const dossierConv = getDossierConversation(dossierId);
      if (dossierConv?.messages?.length > 0) {
        // Add recent conversation history (last 10 messages)
        messages = dossierConv.messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content
        }));
      }
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    console.log('[CLAUDE-BRAIN] Calling Claude API...');
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages
    });

    const responseText = response.content[0]?.text || '[]';
    console.log('[CLAUDE-BRAIN] Raw response:', responseText);

    // Parse JSON response
    let parsed;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('[CLAUDE-BRAIN] JSON parse error:', parseError.message);
      console.error('[CLAUDE-BRAIN] Response was:', responseText);
      return [{ error: "Erreur de parsing JSON" }];
    }

    // Ensure it's an array
    if (!Array.isArray(parsed)) {
      parsed = [parsed];
    }

    // Save conversation if dossierId provided
    if (dossierId) {
      appendDossierMessage(dossierId, 'user', inputContent);
      appendDossierMessage(dossierId, 'assistant', JSON.stringify(parsed));
    }

    console.log('[CLAUDE-BRAIN] Actions détectées:', JSON.stringify(parsed, null, 2));
    return parsed;

  } catch (error) {
    console.error('[CLAUDE-BRAIN] Error:', error.message);
    return [{ error: `Erreur IA: ${error.message}` }];
  }
}

// Backward compatibility - same as Gemini version
export async function analyzeFollowUp(r) {
  return { hasTask: false };
}

// ==================== DOSSIER CHAT (Conversational) ====================

const CHAT_SYSTEM_PROMPT = `Tu es l'assistant IA de Smart Value Assurances, cabinet de courtage en assurances et gestion de patrimoine.

Tu assistes le courtier dans la gestion de ses dossiers clients. Tu as accès au contexte 360° du client (ses infos, projets, documents, messages WhatsApp récents).

STYLE :
- Réponds de façon conversationnelle, naturelle et professionnelle
- Sois concis mais complet
- Utilise le contexte client pour personnaliser tes réponses
- Quand tu donnes des conseils, cite tes sources (documents, réglementation)

EXPERTISE :
- Assurances de personnes : Prévoyance, Santé, Retraite, Emprunteur
- Assurances Pro : MRP, RC Pro, Décennale
- Réglementation : DDA, ORIAS, loi Lemoine, résiliation infra-annuelle, ANI, loi Hamon

TU PEUX :
- Résumer le dossier client
- Analyser les documents du client
- Proposer des actions à faire
- Répondre aux questions sur la réglementation
- Aider à rédiger des courriers/emails
- Préparer des éléments pour un RDV client

Date actuelle : ${new Date().toLocaleDateString('fr-FR')}`;

/**
 * Process conversational chat for a dossier
 * @param {string} dossierId - Notion dossier ID
 * @param {string} message - User message
 * @param {object} context360 - Pre-loaded context (optional)
 * @returns {object} { response: string, context360: object }
 */
export async function processDossierChat(dossierId, message, context360 = null) {
  try {
    // Build context 360 if not provided
    if (!context360) {
      context360 = await buildClientContext360(dossierId);
    }
    const context360Text = formatContext360ForPrompt(context360);

    // Get conversation history
    const dossierConv = getDossierConversation(dossierId);
    let messages = [];

    if (dossierConv?.messages?.length > 0) {
      // Get last 20 messages for context
      messages = dossierConv.messages.slice(-20).map(m => ({
        role: m.role,
        content: m.content
      }));
    }

    // Add current user message
    messages.push({ role: "user", content: message });

    // Build system prompt with context
    const systemPrompt = `${CHAT_SYSTEM_PROMPT}

${context360Text}`;

    console.log('[DOSSIER-CHAT] Calling Claude for conversational response...');
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages
    });

    const responseText = response.content[0]?.text || "Désolé, je n'ai pas pu générer de réponse.";

    // Save conversation
    appendDossierMessage(dossierId, 'user', message);
    appendDossierMessage(dossierId, 'assistant', responseText);

    console.log('[DOSSIER-CHAT] Response generated:', responseText.substring(0, 100) + '...');

    return {
      response: responseText,
      context360
    };

  } catch (error) {
    console.error('[DOSSIER-CHAT] Error:', error.message);
    return {
      response: `Erreur: ${error.message}`,
      context360: context360 || {}
    };
  }
}

/**
 * Chat with dossier - supports document analysis
 * @param {string} message - User message
 * @param {string} dossierId - Notion dossier ID
 * @param {Array} conversationHistory - Previous messages
 * @param {object} document - Optional document { type: 'base64', mediaType: string, data: string }
 * @returns {string} Response text
 */
export async function chatWithDossier(message, dossierId, conversationHistory = [], document = null) {
  try {
    // Load context 360 of the dossier
    const context360 = await buildClientContext360(dossierId);
    const knowledge = await searchRelevantKnowledge(message);

    const systemPrompt = `Tu es l'assistant expert de Jeremy, courtier chez Smart Value Assurances.
Tu analyses et conseilles sur les dossiers clients.

CONTEXTE DU DOSSIER :
${formatContext360ForPrompt(context360)}

BASE DE CONNAISSANCE :
${formatKnowledgeForPrompt(knowledge)}

RÈGLES :
- Réponds en français, directement et de façon conversationnelle
- Si tu n'as pas assez d'informations, dis-le clairement
- Ne promets jamais d'analyser "en cours" - analyse immédiatement avec ce que tu as
- Si un document PDF est fourni, analyse-le en détail
- Si un PDF est mentionné mais pas disponible en texte, demande à Jeremy de le joindre
- Sois concis mais complet
- Date actuelle : ${new Date().toLocaleDateString('fr-FR')}`;

    // Build messages array
    let messages = [...conversationHistory];

    // Add current message (with or without document)
    if (document && document.data) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: document.mediaType || 'application/pdf',
              data: document.data
            }
          },
          { type: 'text', text: message }
        ]
      });
    } else {
      messages.push({ role: 'user', content: message });
    }

    console.log('[CHAT-DOSSIER] Calling Claude...', document ? '(with document)' : '');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages
    });

    const responseText = response.content[0]?.text || "Désolé, je n'ai pas pu générer de réponse.";

    // Save conversation
    appendDossierMessage(dossierId, 'user', message);
    appendDossierMessage(dossierId, 'assistant', responseText);

    console.log('[CHAT-DOSSIER] Response:', responseText.substring(0, 100) + '...');

    return responseText;

  } catch (error) {
    console.error('[CHAT-DOSSIER] Error:', error.message);
    throw error;
  }
}

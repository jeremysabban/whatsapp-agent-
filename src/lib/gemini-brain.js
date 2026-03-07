import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client } from '@notionhq/client';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DOSSIERS_DB_ID = process.env.NOTION_DOSSIERS_DB_ID;

// Mémoire Notion (Dossiers existants)
async function getNotionDossiers() {
  try {
    if (!DOSSIERS_DB_ID) return "";
    const response = await notion.databases.query({
      database_id: DOSSIERS_DB_ID, page_size: 50,
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
    });
    return response.results.map(p => p.properties['Nom du dossier']?.title[0]?.text?.content).filter(n => n).join(", ");
  } catch (e) { return ""; }
}

// Mémoire Notion (Projets actifs)
async function getNotionProjects() {
  try {
    const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID;
    if (!PROJECTS_DB_ID) return "";
    const response = await notion.databases.query({
      database_id: PROJECTS_DB_ID,
      page_size: 30,
      filter: { property: 'Terminé', checkbox: { equals: false } },
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
    });
    return response.results.map(p => {
      const name = p.properties['Name']?.title[0]?.text?.content || '';
      const type = p.properties['Type']?.select?.name || '';
      return name ? `${name} (${type})` : null;
    }).filter(Boolean).join(", ");
  } catch (e) { return ""; }
}

export async function processSmartInput(input, whatsappRecents = "") {
  try {
    const notionNames = await getNotionDossiers();
    const notionProjects = await getNotionProjects();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `
Tu es l'assistant exécutif expert en CRM Notion.
Structure de la base : DOSSIER (Client) > PROJET (Lead/Sinistre/Gestion) > TACHES.

CONTEXTE CLIENTS :
- WhatsApp Récents : [${whatsappRecents}]
- Notion Dossiers : [${notionNames}]
- Notion Projets actifs : [${notionProjects}]

TES ORDRES (Tu dois renvoyer une LISTE d'actions en JSON) :

1. **NOUVEAU_PROJET** (Pour créer un nouveau conteneur Lead, Sinistre ou Gestion).
   - "category": "LEAD" | "SINISTRE" | "GESTION"
   - "client": Nom du dossier client
   - "content": Titre du projet (ex: "Assurance Auto Mini")

2. **TACHE** (Pour une action unitaire liée au projet créé juste avant).
   - "content": Titre de la tâche
   - "link_to_previous": true (SI cette tâche doit être attachée au projet créé juste avant dans la même liste)

3. **TACHE_SUR_PROJET** (Pour ajouter une tâche à un PROJET EXISTANT trouvé dans la liste "Projets actifs").
   - "project_name": Nom exact du projet existant (tel qu'il apparaît dans la liste)
   - "content": Titre de la tâche

4. **RAPPEL** (Pour programmer une alarme).
   - "content": Texte du rappel
   - "time": Date/heure ISO (YYYY-MM-DDTHH:mm:ss.000Z)

5. **NOTE** (Pour ajouter une note à un dossier existant).
   - "client": Nom du dossier
   - "content": Contenu de la note

6. **RAPPORT_JOUR** (Pour demander un résumé des tâches).

RÈGLES D'INTELLIGENCE (CAS COMPLEXES) :
- Si l'utilisateur mentionne un nom qui correspond à un PROJET EXISTANT dans la liste des projets actifs (ex: "Pigallerie", "Mutuelle Pigallerie"), utilise TACHE_SUR_PROJET avec le nom exact du projet.
- Si l'utilisateur demande des tâches en vrac pour un CLIENT (dossier) sans projet existant correspondant, CRÉE D'ABORD UN PROJET "GESTION" (ex: "Suivi demandes") puis lie les tâches avec link_to_previous: true.
- Si l'utilisateur dit "nouveau lead/sinistre", crée d'abord le NOUVEAU_PROJET, puis les TACHES avec link_to_previous: true.

RÈGLES POUR LES DATES :
- "demain" = +1 jour à 9h
- "dans 20 minutes" = +20 min
- "à 14h" = aujourd'hui 14:00
- Maintenant : ${new Date().toISOString()}

FORMAT DE RÉPONSE ATTENDU (TABLEAU JSON) :
Exemple 1 - Tâches sur projet existant :
[
  { "intention": "TACHE_SUR_PROJET", "project_name": "Mutuelle Pigallerie", "content": "Résiliation mutuelle" },
  { "intention": "TACHE_SUR_PROJET", "project_name": "Mutuelle Pigallerie", "content": "Résiliation prévoyance" }
]

Exemple 2 - Nouveau lead + tâches :
[
  { "intention": "NOUVEAU_PROJET", "category": "LEAD", "client": "Kevin Nataf", "content": "Assurance Auto Mini" },
  { "intention": "TACHE", "content": "Récupérer permis", "link_to_previous": true },
  { "intention": "TACHE", "content": "Récupérer carte grise", "link_to_previous": true }
]
`,
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
    });

    let promptParts = [];
    if (input.type === 'AUDIO') {
        promptParts.push("Génère la liste des actions.");
        promptParts.push({ inlineData: { data: input.content, mimeType: "audio/ogg" } });
    } else {
        promptParts.push(`Analyse et génère la séquence d'actions : "${input.content}"`);
    }

    const result = await model.generateContent(promptParts);
    // On s'assure que c'est bien un tableau, même s'il n'y a qu'une seule action
    let parsed = JSON.parse(result.response.text());
    if (!Array.isArray(parsed)) parsed = [parsed];
    console.log('[BRAIN] Actions détectées:', JSON.stringify(parsed, null, 2));
    return parsed;

  } catch (error) {
    console.error("[BRAIN] Error:", error.message);
    return [{ error: "Erreur analyse IA" }];
  }
}

// Simplifié - le nouveau système gère tout en une fois
export async function analyzeFollowUp(r) {
  return { hasTask: false };
}

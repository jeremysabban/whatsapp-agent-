# WhatsApp Agent - Contexte Complet pour Claude

## Vue d'ensemble

Agent WhatsApp CRM personnel qui permet de gérer Notion par commandes vocales ou textuelles envoyées dans "Notes à moi-même".

**Stack technique :**
- Next.js 14 (App Router)
- Baileys (WhatsApp Web API)
- Gemini 2.0 Flash (multimodal - texte + audio)
- Notion API (backend CRM)
- SQLite (cache local conversations)
- node-cron (rapports automatiques)

---

## Architecture CRM Notion

```
DOSSIER (Client)
  └── PROJET (Lead / Sinistre / Gestion)
       └── TÂCHES
```

**Bases Notion utilisées :**
- `NOTION_DOSSIERS_DB_ID` - Dossiers clients
- `NOTION_PROJECTS_DB_ID` - Projets (Type: Lead/Sinistre/Gestion)
- `NOTION_TASKS_DB_ID` - Tâches (liées aux projets)
- `NOTION_CONTACTS_DB_ID` - Contacts
- `NOTION_CONTRACTS_DB_ID` - Contrats

---

## Architecture Brain (Cerveau IA)

### Flux de traitement

```
Message dans "Notes à moi-même"
         ↓
   [whatsapp-client.js]
   Détecte message fromMe + isNoteToSelf
         ↓
   [gemini-brain.js]
   processSmartInput(input, recentContacts)
   → Retourne TABLEAU d'actions JSON
         ↓
   [whatsapp-client.js]
   Boucle sur les actions
   Exécute via gemini-tools.js
         ↓
   Envoie résumé dans la conversation
```

### Fichiers clés

#### 1. `src/lib/gemini-brain.js`
- Reçoit texte OU audio (base64)
- Contexte : contacts WhatsApp récents + dossiers Notion
- Retourne un TABLEAU d'actions (pas une seule)
- Permet de chaîner : créer projet + tâches liées en une commande

**Intentions supportées :**
```javascript
[
  { "intention": "NOUVEAU_PROJET", "category": "LEAD|SINISTRE|GESTION", "client": "Nom", "content": "Titre projet" },
  { "intention": "TACHE", "content": "Description", "link_to_previous": true },
  { "intention": "RAPPEL", "content": "Texte", "time": "ISO8601" },
  { "intention": "NOTE", "client": "Nom dossier", "content": "Contenu" },
  { "intention": "RAPPORT_JOUR" }
]
```

#### 2. `src/lib/gemini-tools.js`
Fonctions d'exécution :

```javascript
// Créer un projet lié au dossier client
createProject(category, clientName, projectTitle)
// → Cherche le dossier, crée le projet, retourne { success, projectId }

// Créer une tâche (optionnellement liée à un projet)
createTaskOnProject(taskDescription, projectId = null)
// → Crée la tâche, lie au projet si projectId fourni

// Programmer un rappel
scheduleReminder(text, timeISO)
// → Stocke dans data/reminders.json

// Ajouter une note à un dossier
addNoteToDossier(clientName, content)
// → Recherche le dossier, ajoute un bloc paragraphe

// Générer le rapport des tâches
getTasksReport()
// → Appelle /api/notion/all-tasks, formate avec priorités et projets
```

#### 3. `src/lib/whatsapp-client.js` (lignes 335-465)
Handler principal dans `messages.upsert` :

```javascript
// Détection "Notes à moi-même"
const myNumber = wa.sock?.user?.id?.split(':')[0];
const isNoteToSelf = jid.split('@')[0] === myNumber;

if (fromMe && isNoteToSelf) {
  // Commande spéciale "rapport"
  if (txtLower === 'rapport') {
    const report = await getTasksReport();
    await wa.sock.sendMessage(jid, { text: report });
  }

  // Traitement Brain
  const actionsList = await processSmartInput(inputPayload, recentNamesList);
  let lastCreatedProjectId = null;

  for (const action of actionsList) {
    switch (action.intention) {
      case 'NOUVEAU_PROJET':
        const res = await createProject(action.category, action.client, action.content);
        lastCreatedProjectId = res.projectId; // Pour chaînage
        break;
      case 'TACHE':
        // Si link_to_previous, utilise lastCreatedProjectId
        await createTaskOnProject(action.content, targetProjectId);
        break;
      // ... autres cas
    }
  }
}
```

---

## Fonctionnalités Cron

Rapports automatiques envoyés dans "Notes à moi-même" :
- 8h00, 12h00, 18h00 (Europe/Paris)
- Configuré dans `whatsapp-client.js` lignes 560-579

---

## Composant React Principal

`src/components/WhatsAppAgent.jsx` (~1300 lignes)

### Fonctionnalités UI
- Liste des conversations avec filtres (labels, non-lus)
- Vue messages avec auto-scroll
- Panneau dossier Notion (projets, tâches, contacts, contrats)
- Système de tags (Lead/Sinistre/Gestion) liés aux projets Notion
- Modal création/liaison projets
- Liaison contact WhatsApp ↔ Contact Notion
- Settings WhatsApp (connexion QR, status)

### États clés
```javascript
const [conversations, setConversations] = useState([]);
const [selectedJid, setSelectedJid] = useState(null);
const [selectedMessages, setSelectedMessages] = useState([]);
const [dossierDetails, setDossierDetails] = useState(null);
const [showTagProjectModal, setShowTagProjectModal] = useState(false);
```

### Corrections récentes
- **QR Code** : fetch immédiat au lieu d'attendre 2s
- **Auto-scroll** : `scrollTop = scrollHeight` sur container ref
- **Infinite re-render** : suppression useEffect problématique dans Settings

---

## API Routes Notion

### `/api/notion/search-dossiers` (POST)
Recherche dossiers par nom avec extraction du nom depuis l'URL si le champ titre est vide/emoji.

### `/api/notion/dossier-details` (GET)
Retourne le dossier complet avec :
- Projets (actifs et terminés)
- Tâches (groupées par projet + orphelines)
- Contacts
- Contrats
- Stats

### `/api/notion/all-tasks` (GET)
Liste toutes les tâches non complétées avec nom du projet.

### `/api/notion/sync-contact` (POST)
Crée ou met à jour un contact Notion.

### `/api/notion/update-status` (POST)
Met à jour les métadonnées d'une conversation (tags, liaisons Notion).

---

## Structure Base de Données SQLite

`src/lib/database.js`

### Tables principales
- `conversations` - Métadonnées conversations WhatsApp
- `messages` - Historique messages
- `documents` - Documents/médias téléchargés
- `labels` - Labels WhatsApp Business
- `label_associations` - Liaison label ↔ conversation
- `agent_logs` - Logs des actions de l'agent

### Champs enrichis sur `conversations`
```javascript
{
  notion_contact_id,    // ID contact Notion lié
  notion_dossier_id,    // ID dossier Notion lié
  tags,                 // JSON array ["Lead", "Sinistre"]
  tag_projects,         // JSON { "Lead": [{id, name, url}], ... }
  notes                 // Notes libres
}
```

---

## Problèmes résolus récemment

1. **Port 3000 occupé** : `pkill -f "next dev"` avant relance
2. **Nom dossier = emoji** : extraction depuis URL Notion comme fallback
3. **Rapport "Erreur Notion"** : propriétés Notion incorrectes (Status vs Statut), basculé sur API interne
4. **ERR_INSUFFICIENT_RESOURCES** : suppression useEffect causant boucle infinie
5. **WhatsApp rate limiting** : attendre 5min, supprimer data/auth

---

## Commandes de test

Dans "Notes à moi-même" WhatsApp :

```
rapport
→ Génère le rapport des tâches

Nouveau lead Kevin Nataf assurance auto avec tâche carte grise et tâche devis
→ Crée projet LEAD + 2 tâches liées

Rappel demain 9h appeler le client Dupont
→ Programme une alarme

Note sur dossier Martin : RDV confirmé pour vendredi
→ Ajoute une note au dossier
```

---

## Plan en cours (non terminé)

Fichier : `/Users/jeremysabban/.claude/plans/stateful-strolling-iverson.md`

Objectifs restants :
1. Fix header dossier (bouton refresh)
2. Migration tag_projects vers format array
3. Bouton création contact (👤+)
4. Indicateur liaison sous le téléphone
5. Mise à jour tags row pour format array
6. Modal tag projet pour arrays
7. Auto-sync tags depuis projets Notion

---

## Fichiers à lire en priorité

```
src/lib/gemini-brain.js      # Cerveau IA
src/lib/gemini-tools.js      # Outils d'exécution
src/lib/whatsapp-client.js   # Handler WhatsApp + Cron
src/lib/database.js          # SQLite + enrichissement
src/lib/notion-config.js     # Config Notion
src/components/WhatsAppAgent.jsx  # UI React
src/app/api/notion/*/route.js     # API routes Notion
```

---

## Variables d'environnement requises

```env
GEMINI_API_KEY=
NOTION_API_KEY=
NOTION_DOSSIERS_DB_ID=
NOTION_PROJECTS_DB_ID=
NOTION_TASKS_DB_ID=
NOTION_CONTACTS_DB_ID=
NOTION_CONTRACTS_DB_ID=
```

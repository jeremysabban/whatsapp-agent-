# WhatsApp Agent - Architecture Complète

## Vue d'ensemble

Agent WhatsApp CRM personnel permettant de gérer Notion par commandes vocales ou textuelles envoyées dans "Notes à moi-même". Interface web complète pour la gestion des conversations, documents, tâches et projets.

---

## 1. Arborescence du projet

```
whatsapp-agent/
├── .env.local                 # Variables d'environnement (API keys)
├── package.json               # Dépendances et scripts
├── next.config.js             # Configuration Next.js
├── middleware.js              # Middleware d'authentification
├── tailwind.config.js         # Configuration Tailwind CSS
├── data/                      # Données persistantes
│   ├── auth/                  # Credentials WhatsApp (Baileys)
│   ├── auth_backup/           # Backup de session WhatsApp
│   ├── media/                 # Photos/vidéos téléchargés
│   ├── documents/             # Documents téléchargés
│   ├── reminders.json         # Rappels programmés
│   └── wa-notifications.json  # Queue de notifications
├── scripts/                   # Scripts utilitaires
│   ├── create-notion-dashboard.js
│   ├── sync-hsva-with-notion.js
│   ├── sync-notion-contacts.js
│   └── update-notion-dashboard.js
└── src/
    ├── app/
    │   ├── layout.js          # Layout principal
    │   ├── page.js            # Page d'accueil
    │   ├── login/page.jsx     # Page de connexion
    │   └── api/               # Routes API (voir section 4)
    ├── components/
    │   ├── WhatsAppAgent.jsx  # Composant principal (~1500 lignes)
    │   ├── CalendarView.jsx   # Vue calendrier
    │   ├── DossierChat.jsx    # Chat Claude par dossier
    │   ├── DossierDetail.jsx  # Détails d'un dossier
    │   ├── DossierList.jsx    # Liste des dossiers
    │   ├── ProjectsView.jsx   # Vue des projets
    │   └── TasksView.jsx      # Vue des tâches
    └── lib/
        ├── whatsapp-client.js # Client WhatsApp (Baileys)
        ├── gemini-brain.js    # Cerveau IA (Gemini)
        ├── gemini-tools.js    # Outils d'exécution Notion
        ├── database.js        # SQLite (better-sqlite3)
        ├── notion-config.js   # Configuration Notion
        ├── notion-cache.js    # Cache Notion
        ├── calendar-client.js # Client Google Calendar
        ├── gmail-client.js    # Client Gmail
        ├── claude-brain.js    # Alternative Claude (non utilisé)
        ├── knowledge-base.js  # Base de connaissances
        └── recap-engine.js    # Moteur de récapitulatifs
```

---

## 2. Stack Technique

### Dépendances principales (package.json)

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.78.0",      // Claude API (backup)
    "@google/generative-ai": "^0.24.1",   // Gemini 2.0 Flash
    "@notionhq/client": "^2.3.0",         // Notion API
    "@whiskeysockets/baileys": "^6.7.16", // WhatsApp Web API
    "better-sqlite3": "^11.7.0",          // Base de données locale
    "dotenv": "^17.3.1",                  // Variables d'environnement
    "googleapis": "^171.4.0",             // Google Calendar/Gmail
    "imap": "^0.8.19",                    // Lecture emails
    "mailparser": "^3.9.4",               // Parsing emails
    "next": "^14.2.21",                   // Framework React
    "node-cron": "^4.2.1",                // Tâches planifiées
    "pino": "^9.6.0",                     // Logging
    "qrcode": "^1.5.4",                   // Génération QR codes
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17"
  }
}
```

---

## 3. Architecture CRM Notion

### Hiérarchie des données

```
DOSSIER (Client)
  └── PROJET (Lead / Sinistre / Gestion)
       └── TÂCHES
```

### Bases Notion utilisées

| Variable d'environnement   | Description          |
|---------------------------|----------------------|
| `NOTION_DOSSIERS_DB_ID`   | Dossiers clients     |
| `NOTION_PROJECTS_DB_ID`   | Projets              |
| `NOTION_TASKS_DB_ID`      | Tâches               |
| `NOTION_CONTACTS_DB_ID`   | Contacts             |
| `NOTION_CONTRACTS_DB_ID`  | Contrats             |

---

## 4. API Routes

### WhatsApp (`/api/whatsapp/`)

| Route | Méthode | Description |
|-------|---------|-------------|
| `/connect` | POST | Connexion WhatsApp |
| `/disconnect` | POST | Déconnexion |
| `/reconnect` | POST | Reconnexion forcée |
| `/reset` | POST | Reset session |
| `/status` | GET | État connexion |
| `/qr` | GET | QR Code pour login |
| `/conversations` | GET | Liste conversations |
| `/messages/[jid]` | GET | Messages d'une conv |
| `/send` | POST | Envoyer un message |
| `/documents` | GET | Liste documents |
| `/media/[filename]` | GET | Télécharger média |
| `/labels` | GET | Labels WhatsApp Business |
| `/update-status` | POST | Mettre à jour statut |
| `/agent-log` | GET | Logs de l'agent |
| `/events` | GET | SSE temps réel |

### Notion (`/api/notion/`)

| Route | Méthode | Description |
|-------|---------|-------------|
| `/dossiers` | GET | Liste dossiers |
| `/dossier-details` | GET | Détails complets d'un dossier |
| `/search-dossiers` | POST | Recherche dossiers |
| `/link-dossier` | POST | Lier conv WhatsApp ↔ Dossier |
| `/projects` | GET | Liste projets |
| `/create-project` | POST | Créer un projet |
| `/get-projects` | GET | Projets d'un dossier |
| `/tasks` | GET | Liste tâches |
| `/all-tasks` | GET | Toutes les tâches ouvertes |
| `/create-task` | POST | Créer une tâche |
| `/update-task-status` | POST | Cocher/décocher tâche |
| `/contacts` | GET | Liste contacts |
| `/sync-contact` | POST | Créer/màj contact |
| `/link-notion-contact` | POST | Lier conv ↔ Contact |
| `/analytics` | GET | Statistiques |
| `/sales-stats` | GET | Stats ventes |
| `/pipeline-projects` | GET | Pipeline commercial |

### Autres

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/brain` | POST | Appel direct au cerveau IA |
| `/api/reminders` | GET/POST | Gestion rappels |
| `/api/calendar/events` | GET | Événements Google Calendar |
| `/api/dossier-chat` | POST | Chat Claude sur dossier |
| `/api/ai/improve-text` | POST | Amélioration texte |

---

## 5. Architecture Brain (Cerveau IA)

### Flux de traitement

```
Message dans "Notes à moi-même" (WhatsApp)
         ↓
   [whatsapp-client.js]
   Détecte message fromMe + isNoteToSelf
         ↓
   [gemini-brain.js]
   processSmartInput(input, recentContacts)
   → Retourne TABLEAU d'actions JSON
         ↓
   [whatsapp-client.js]
   Propose le plan à l'utilisateur
         ↓
   Validation (1/ok) → Exécution
   Modification (2) → Reformulation
   Annulation (3) → Abandon
         ↓
   [gemini-tools.js]
   Exécute chaque action sur Notion
         ↓
   Envoie résumé dans la conversation
```

### Intentions supportées (gemini-brain.js)

```javascript
[
  { "intention": "NOUVEAU_PROJET", "category": "LEAD|SINISTRE|GESTION", "client": "Nom", "content": "Titre" },
  { "intention": "TACHE", "content": "Description", "link_to_previous": true },
  { "intention": "TACHE_SUR_PROJET", "project_name": "Nom projet existant", "content": "Description" },
  { "intention": "RAPPEL", "content": "Texte", "time": "ISO8601" },
  { "intention": "NOTE", "client": "Nom dossier", "content": "Contenu" },
  { "intention": "RAPPORT_JOUR" }
]
```

### Outils d'exécution (gemini-tools.js)

| Fonction | Description |
|----------|-------------|
| `scheduleReminder(text, timeISO)` | Programmer un rappel |
| `addNoteToDossier(clientName, content)` | Ajouter note à un dossier |
| `createTask(taskDescription)` | Créer une tâche simple |
| `createProject(category, clientName, title)` | Créer un projet |
| `createTaskOnProject(description, projectId)` | Tâche liée à un projet |
| `findProjectAndCreateTask(projectName, desc)` | Trouver projet + créer tâche |
| `getTasksReport()` | Rapport des tâches |
| `getCategoryReport(category)` | Rapport par catégorie |
| `getDailyReport()` | Rapport quotidien |
| `completeTaskById(taskId)` | Marquer tâche comme faite |

---

## 6. Base de Données SQLite

### Schéma (database.js)

```sql
-- Conversations WhatsApp
CREATE TABLE conversations (
  jid TEXT PRIMARY KEY,
  name TEXT,
  whatsapp_name TEXT,
  custom_name TEXT,
  phone TEXT,
  email TEXT,
  avatar_initials TEXT,
  avatar_color TEXT,
  status TEXT,              -- client, assurance, prospect, apporteur, hsva, inbox
  category TEXT,
  tags TEXT,                -- JSON array
  tag_projects TEXT,        -- JSON { "Lead": [{id, name, url}], ... }
  priority TEXT,
  notes TEXT,
  unread_count INTEGER,
  last_message TEXT,
  last_message_time INTEGER,
  starred INTEGER,
  reminder_at INTEGER,
  reminder_note TEXT,
  notion_dossier_id TEXT,
  notion_dossier_name TEXT,
  notion_dossier_url TEXT,
  notion_contact_id TEXT,
  notion_contact_name TEXT,
  notion_contact_url TEXT,
  name_source TEXT          -- contact, dossier, manual, whatsapp
);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_jid TEXT,
  from_me INTEGER,
  sender_name TEXT,
  text TEXT,
  timestamp INTEGER,
  message_type TEXT,        -- text, image, video, document, audio, ptt
  is_document INTEGER,
  media_url TEXT,
  media_mimetype TEXT
);

-- Documents/Médias
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  conversation_jid TEXT,
  message_id TEXT,
  filename TEXT,
  mimetype TEXT,
  file_size INTEGER,
  status TEXT,              -- recu, identifie, classe, telecharge, traite
  local_path TEXT
);

-- Labels WhatsApp Business
CREATE TABLE wa_labels (
  id TEXT PRIMARY KEY,
  name TEXT,
  color INTEGER,
  predefined_id TEXT
);

CREATE TABLE wa_label_associations (
  label_id TEXT,
  chat_jid TEXT,
  PRIMARY KEY (label_id, chat_jid)
);

-- Logs de l'agent
CREATE TABLE agent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER,
  action_type TEXT,
  description TEXT,
  conversation_jid TEXT,
  conversation_name TEXT,
  metadata TEXT
);

-- Cache Notion
CREATE TABLE notion_cache (
  dossier_id TEXT PRIMARY KEY,
  data TEXT,
  updated_at INTEGER
);

-- Base de connaissances
CREATE TABLE knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  titre TEXT,
  contenu TEXT,
  assureur TEXT,
  produit TEXT
);

-- Conversations Claude par dossier
CREATE TABLE dossier_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_notion_id TEXT UNIQUE,
  messages TEXT,            -- JSON array
  context_360 TEXT          -- JSON object
);
```

---

## 7. WhatsApp Client (whatsapp-client.js)

### Fonctionnalités principales

- **Connexion persistante** via Baileys avec gestion reconnexion automatique
- **Backup de session** automatique (toutes les 30 min)
- **Monitoring connexion** avec détection d'inactivité (5 min)
- **Exponential backoff** pour les reconnexions (3s → 60s max)
- **Queue de téléchargement média** (max 2 simultanés)
- **Détection tâches 👉** dans les messages envoyés
- **Cron jobs** pour rapports automatiques (8h, 12h, 18h)
- **Server-Sent Events** pour temps réel

### Commandes WhatsApp (Notes à moi-même)

```
command / aide / help       → Liste des commandes
rapport                     → Toutes les tâches
rapport leads               → Leads en cours par dossier
rapport sinistres           → Sinistres en cours
rapport gestions            → Gestions en cours
rapport jour                → Résumé de la journée

Après un rapport:
{numéro}                    → Zoom sur un dossier
fait {n}                    → Cocher la tâche n°
ajouter {texte}             → Nouvelle tâche sur le projet
retour                      → Revenir au rapport

Création:
"Nouveau lead Dupont assurance auto"
"Tâche résiliation mutuelle sur Pigallerie"
"Note sur Abbache : client veut rappel lundi"

Rappels:
"Rappelle-moi demain à 9h appeler Abbache"
"Rappel dans 20 min relancer Generali"

Vocal: Envoie un vocal → mêmes commandes qu'en texte
```

---

## 8. Composant UI Principal (WhatsAppAgent.jsx)

### Vues disponibles

| Vue | Description |
|-----|-------------|
| `dashboard` | Tableau de bord avec stats et analytique |
| `messages` | Liste conversations + chat |
| `documents` | Gestion documents reçus |
| `kanban` | Vue kanban des conversations par statut |
| `taches` | Liste de toutes les tâches Notion |
| `projets` | Liste de tous les projets Notion |
| `calendar` | Vue calendrier Google |
| `dossiers` | Liste des dossiers Notion |
| `contacts` | Liste des contacts Notion |
| `agentLog` | Historique des actions de l'agent |
| `settings` | Paramètres WhatsApp |

### États principaux

```javascript
const [conversations, setConversations] = useState([]);
const [selectedJid, setSelectedJid] = useState(null);
const [selectedMessages, setSelectedMessages] = useState([]);
const [dossierDetails, setDossierDetails] = useState(null);
const [connected, setConnected] = useState(false);
const [qrImage, setQrImage] = useState(null);
```

### Fonctionnalités UI

- Liste conversations avec filtres (labels, temps, non-lus)
- Vue messages avec auto-scroll
- Panneau dossier Notion (projets, tâches, contacts, contrats)
- Système de tags (Lead/Sinistre/Gestion) liés aux projets Notion
- Modal création/liaison projets
- Liaison contact WhatsApp ↔ Contact Notion
- Preview documents (images, PDF)
- Recherche globale
- Drag & drop pour le Kanban

---

## 9. Flow UX côté utilisateur WhatsApp

### 1. Configuration initiale

```
1. Démarrer l'application: npm run dev
2. Accéder à http://localhost:3000
3. Aller dans Settings > Scanner le QR code avec WhatsApp
4. Attendre la synchronisation des messages (peut prendre quelques minutes)
```

### 2. Utilisation quotidienne (Notes à moi-même)

```
Moi: "Nouveau lead Martin assurance habitation avec tâche devis et tâche RIB"

Agent: 🧠 *PLAN D'ACTION*

1. 💰 Créer projet *LEAD* → assurance habitation
   └ Dossier : Martin
2. ✅ Tâche : devis (liée au projet ci-dessus)
3. ✅ Tâche : RIB (liée au projet ci-dessus)

─────────────────
1️⃣ *Valider*  │  2️⃣ *Modifier*  │  3️⃣ *Annuler*

Moi: 1

Agent: ✅ *EXÉCUTÉ*

💰 *Projet LEAD* créé pour *Martin*
   └ assurance habitation
✅ Tâche : devis
✅ Tâche : RIB
```

### 3. Rapports automatiques

- **8h, 12h, 18h** : Rapport des tâches envoyé automatiquement
- **Navigation interactive** : Répondre avec un numéro pour zoomer sur un dossier

### 4. Interface Web

```
1. Sidebar gauche: Navigation entre vues
2. Liste centrale: Conversations/Documents/Tâches
3. Panneau droit: Détails (messages, dossier Notion)
4. Actions: Créer tâche, lier dossier, changer statut
```

---

## 10. Variables d'environnement requises (.env.local)

```env
# Gemini (IA principale)
GEMINI_API_KEY=

# Claude (backup/chat dossier)
ANTHROPIC_API_KEY=

# Notion
NOTION_API_KEY=
NOTION_DOSSIERS_DB_ID=
NOTION_PROJECTS_DB_ID=
NOTION_TASKS_DB_ID=
NOTION_CONTACTS_DB_ID=
NOTION_CONTRACTS_DB_ID=

# Google (optionnel)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Auth
AUTH_PASSWORD=
```

---

## 11. Commandes de développement

```bash
# Démarrer en développement
npm run dev

# Build production
npm run build
npm start

# Si port 3000 occupé
pkill -f "next dev"
npm run dev
```

---

## 12. Résumé des fichiers clés à lire

| Fichier | Rôle |
|---------|------|
| `src/lib/gemini-brain.js` | Cerveau IA - analyse des commandes |
| `src/lib/gemini-tools.js` | Exécution des actions Notion |
| `src/lib/whatsapp-client.js` | Client WhatsApp + Handler messages + Cron |
| `src/lib/database.js` | SQLite + enrichissement données |
| `src/lib/notion-config.js` | Configuration Notion |
| `src/components/WhatsAppAgent.jsx` | Interface React principale |
| `src/app/api/notion/*/route.js` | Routes API Notion |
| `src/app/api/whatsapp/*/route.js` | Routes API WhatsApp |

---

*Document généré le 18 mars 2026*

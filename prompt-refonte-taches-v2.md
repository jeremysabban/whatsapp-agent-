# PROMPT CLAUDE CODE — Refonte Système de Tâches (v2 — basé sur le code réel)

---

## CONTEXTE — ÉTAT ACTUEL DU CODE

Agent WhatsApp CRM en Next.js 14 / Tailwind CSS connecté à Notion. Le système de tâches fonctionne déjà mais manque de cohérence entre les 3 couches (Notion ↔ Agent WhatsApp ↔ Web).

### Propriétés Notion EXISTANTES (base NOTION_TASKS_DB_ID) :

| Propriété Notion | Type | Valeurs |
|-----------------|------|---------|
| `Tâche` | Title | Nom de la tâche |
| `Statut` | Checkbox | true/false (pas un vrai Status !) |
| `Priorité` | Status | `Urg & Imp`, `Important`, `Urgent`, `Secondaire`, `En attente`, `À prioriser` |
| `Date échéance` | Date | ISO date |
| `Responsable` | Multi-select | `Jeremy`, `Perrine` |
| `Type de tâche` | Select | `Appel`, `Email`, `Autre` |
| `Projet` | Relation | → NOTION_PROJECTS_DB_ID |
| `💬 Dossiers` | Relation | → NOTION_DOSSIERS_DB_ID |
| `Commentaires` | Rich text | Texte libre (utilisé comme notes) |

### Fichiers clés à modifier :

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/lib/gemini-brain.js` | 127 lignes | Cerveau IA — system prompt Gemini, intentions JSON |
| `src/lib/gemini-tools.js` | 638 lignes | Exécution des actions Notion (11 outils) |
| `src/lib/whatsapp-client.js` | ~1693 lignes | Client WhatsApp, dispatcher intentions (L.1194-1280), rapports (L.791-933), cron (L.1566-1598) |
| `src/components/TasksView.jsx` | ~500+ lignes | Vue tâches web (déjà riche !) |
| `src/app/api/notion/create-task/route.js` | 102 lignes | API création tâche |
| `src/app/api/notion/update-task/route.js` | 110 lignes | API mise à jour tâche (toutes propriétés) |
| `src/app/api/notion/update-task-status/route.js` | 49 lignes | API toggle checkbox |
| `src/app/api/notion/all-tasks/route.js` | 126 lignes | API liste tâches enrichies + cache |
| `src/app/api/notion/tasks/route.js` | ~100 lignes | API tâches groupées par dossier |

---

## CE QUI EXISTE DÉJÀ ET MARCHE (NE PAS CASSER)

1. **TasksView.jsx** a déjà :
   - Groupement par dossier avec expand/collapse
   - Modal création tâche (nom, projet, assignee, date, type)
   - Modal complétion avec option "Tâches suivantes" manuelles
   - Fiche détail tâche (panneau latéral) avec notes/commentaires, assignee, ajout tâche
   - Filtres (assignee, urgent, recherche, tri)
   - Edition inline (nom, date, type, priorité)
   - Système Eisenhower (quadrants priorité)

2. **API routes** supportent déjà : create, update (toutes props), toggle status, delete (archive), all-tasks avec enrichissement

3. **gemini-tools.js** a déjà : createTask, createTaskOnProject, findProjectAndCreateTask, completeTaskById, getTasksReport, getCategoryReport, getDailyReport

4. **whatsapp-client.js** a déjà : dispatcher d'intentions (L.1194-1280), rapports par catégorie, "fait {n}", navigation zoom dossier, cron 8h/12h/18h

---

## CE QUI MANQUE — AMÉLIORATIONS À FAIRE

### PROBLÈME 1 : gemini-tools.js désynchronisé avec l'API create-task

**Constat** : L'API `create-task/route.js` supporte déjà `date`, `assignee`, `priority`, `taskType` mais `gemini-tools.js` n'envoie AUCUN de ces champs. Les fonctions `createTask()` et `createTaskOnProject()` dans gemini-tools.js créent des tâches avec seulement un titre et un checkbox.

**Fix dans `src/lib/gemini-tools.js`** :

Modifier `createTask()` (ligne 86) :
```javascript
// AVANT (actuel) :
export async function createTask(taskDescription) {
  await notion.pages.create({
    properties: {
      'Name': { title: [{ text: { content: taskDescription } }] },
      'Status': { status: { name: 'À faire' } }   // ← FAUX ! Le champ s'appelle 'Tâche' et 'Statut' est un checkbox
    }
  });
}

// APRÈS :
export async function createTask(taskDescription, options = {}) {
  // options : { projectId, dossierId, priority, dueDate, assignee, taskType, nextTask, source }
  const properties = {
    'Tâche': { title: [{ text: { content: taskDescription } }] },
    'Statut': { checkbox: false }
  };
  if (options.priority) properties['Priorité'] = { status: { name: mapPriority(options.priority) } };
  if (options.dueDate) properties['Date échéance'] = { date: { start: options.dueDate } };
  if (options.projectId) properties['Projet'] = { relation: [{ id: options.projectId }] };
  if (options.dossierId) properties['💬 Dossiers'] = { relation: [{ id: options.dossierId }] };
  if (options.assignee) {
    const assignees = options.assignee.split(', ').map(n => ({ name: n.trim() }));
    properties['Responsable'] = { multi_select: assignees };
  }
  if (options.taskType) properties['Type de tâche'] = { select: { name: options.taskType } };

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({ parent: { database_id: NOTION_TASKS_DB_ID }, properties })
  });
  // ... (garder le reste)
}

// Helper pour mapper les priorités du langage naturel vers les valeurs Notion
function mapPriority(input) {
  const lower = (input || '').toLowerCase();
  if (lower.includes('urg') && lower.includes('imp')) return 'Urg & Imp';
  if (lower.includes('urgent')) return 'Urgent';
  if (lower.includes('important')) return 'Important';
  if (lower.includes('secondaire') || lower.includes('basse')) return 'Secondaire';
  if (lower.includes('attente')) return 'En attente';
  return 'À prioriser';
}
```

**MÊME FIX pour `createTaskOnProject()`** (ligne 195) — le champ title s'appelle `'Tâche'` pas `'Name'`, et `'Statut'` est un `checkbox` pas un `status`. Vérifier et corriger.

ATTENTION : `createTask()` utilise `notion.pages.create()` (SDK) tandis que `createTaskOnProject()` utilise `fetch()` directement. Harmoniser en utilisant `fetch()` partout comme le fait l'API route `create-task/route.js`.

---

### PROBLÈME 2 : Le brain ne gère pas les échéances, priorités, commentaires

**Fix dans `src/lib/gemini-brain.js`** — Enrichir le system prompt (ligne 46-103) :

Ajouter ces nouvelles intentions dans le system prompt :

```
7. **TACHE** enrichie — Ajout de champs optionnels :
   - "content": Titre de la tâche
   - "link_to_previous": true/false
   - "due_date": Date ISO (optionnel) — extraite de "pour vendredi", "avant demain", "dans 3 jours"
   - "priority": "urgente" | "importante" | "normale" | "secondaire" (optionnel)
   - "assignee": "Jeremy" | "Perrine" (optionnel, défaut: pas d'assignee)
   - "task_type": "Appel" | "Email" | "Autre" (optionnel)

8. **MODIFIER_TACHE** (NOUVEAU) — Modifier une tâche existante
   - "task_name": Nom ou début du nom de la tâche à trouver
   - "updates": { "priority": "...", "due_date": "...", "assignee": "..." }

9. **COMMENTER_TACHE** (NOUVEAU) — Ajouter un commentaire
   - "task_name": Nom de la tâche
   - "comment": Texte du commentaire

10. **COMPLETER_TACHE** (NOUVEAU) — Marquer une tâche comme terminée par son nom
    - "task_name": Nom de la tâche

11. **RAPPORT_TACHES** (NOUVEAU) — Rapport filtré
    - "filter": "retard" | "aujourd'hui" | "semaine" | "urgent" | "tout"
```

**Ajouter des exemples au system prompt** pour que Gemini comprenne :
```
Exemple 3 - Tâche avec échéance et priorité :
[
  { "intention": "TACHE_SUR_PROJET", "project_name": "Mutuelle Pigallerie", "content": "Résiliation mutuelle", "due_date": "2026-03-25", "priority": "urgente" }
]

Exemple 4 - Complétion de tâche :
[
  { "intention": "COMPLETER_TACHE", "task_name": "Relancer Generali" }
]

Exemple 5 - Commentaire :
[
  { "intention": "COMMENTER_TACHE", "task_name": "Devis habitation", "comment": "Client veut offre à 150€/mois" }
]

Exemple 6 - Modification :
[
  { "intention": "MODIFIER_TACHE", "task_name": "Devis Dupont", "updates": { "priority": "urgente", "due_date": "2026-03-20" } }
]
```

**Enrichir les règles de dates** dans le system prompt (ligne 86-89) pour couvrir plus de cas :
```
RÈGLES POUR LES DATES :
- "demain" = +1 jour à 9h
- "après-demain" = +2 jours à 9h
- "dans 20 minutes" = +20 min
- "à 14h" = aujourd'hui 14:00
- "vendredi" = vendredi prochain si on est après vendredi, sinon ce vendredi
- "la semaine prochaine" = lundi prochain à 9h
- "dans 3 jours" = +3 jours à 9h
- "fin de semaine" = vendredi 18h
- "urgent" / "dès que possible" = aujourd'hui
- Maintenant : ${new Date().toISOString()}
- Jour actuel : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long' })}
```

---

### PROBLÈME 3 : Nouvelles fonctions dans gemini-tools.js

**Ajouter ces fonctions dans `src/lib/gemini-tools.js`** :

```javascript
// --- OUTIL 12 : TROUVER UNE TÂCHE PAR NOM ---
export async function findTaskByName(taskName) {
  // Rechercher dans la base NOTION_TASKS_DB_ID
  // Filtre : title contains taskName, Statut checkbox = false
  // Retourner : { id, name, projectId, dossierId, priority, date }
  // Si aucun résultat : retourner null avec suggestion de tâches similaires
}

// --- OUTIL 13 : COMPLÉTER PAR NOM ---
export async function completeTaskByName(taskName) {
  const task = await findTaskByName(taskName);
  if (!task) return { success: false, message: `Tâche "${taskName}" introuvable` };
  return await completeTaskById(task.id);
  // BONUS : si la tâche a un champ "Tâche suivante", créer automatiquement
}

// --- OUTIL 14 : MODIFIER UNE TÂCHE ---
export async function updateTaskByName(taskName, updates) {
  const task = await findTaskByName(taskName);
  if (!task) return { success: false, message: `Tâche "${taskName}" introuvable` };
  // Appeler l'API interne : POST /api/notion/update-task
  // Mapper updates vers les noms de propriétés Notion
}

// --- OUTIL 15 : COMMENTER UNE TÂCHE ---
export async function addTaskComment(taskName, comment) {
  const task = await findTaskByName(taskName);
  if (!task) return { success: false, message: `Tâche "${taskName}" introuvable` };
  // OPTION A (recommandée) : Utiliser l'API Notion Comments
  //   await notion.comments.create({ parent: { page_id: task.id }, rich_text: [{ text: { content: `[${timestamp}] ${comment}` } }] })
  // OPTION B : Appendre au champ "Commentaires" (rich_text) existant
  //   Lire le contenu actuel → ajouter la nouvelle ligne avec timestamp → PATCH
}

// --- OUTIL 16 : RAPPORT TÂCHES FILTRÉ ---
export async function getFilteredTasksReport(filter) {
  // filter : "retard" | "aujourd'hui" | "semaine" | "urgent" | "tout"
  // Appeler GET /api/notion/all-tasks
  // Filtrer selon le critère
  // Formater en rapport WhatsApp avec numérotation pour interaction
}
```

---

### PROBLÈME 4 : Dispatcher dans whatsapp-client.js incomplet

**Modifier le switch dans `src/lib/whatsapp-client.js`** (lignes 1194-1280).

Actuellement le switch gère : `NOUVEAU_PROJET`, `TACHE`, `TACHE_SUR_PROJET`, `RAPPEL`, `NOTE`, `RAPPORT_JOUR`.

**Ajouter les nouveaux cases** :

```javascript
case 'MODIFIER_TACHE':
  const modResult = await updateTaskByName(action.task_name, action.updates);
  if (modResult.success) {
    responseText += `✏️ Tâche modifiée : *${action.task_name}*\n`;
    if (action.updates.priority) responseText += `   └ Priorité → ${action.updates.priority}\n`;
    if (action.updates.due_date) responseText += `   └ Échéance → ${new Date(action.updates.due_date).toLocaleDateString('fr-FR')}\n`;
  } else {
    responseText += `⚠️ ${modResult.message}\n`;
  }
  break;

case 'COMMENTER_TACHE':
  const commentResult = await addTaskComment(action.task_name, action.comment);
  responseText += commentResult.success
    ? `💬 Commentaire ajouté sur *${action.task_name}*\n`
    : `⚠️ ${commentResult.message}\n`;
  break;

case 'COMPLETER_TACHE':
  const completeResult = await completeTaskByName(action.task_name);
  responseText += completeResult.success
    ? `✅ Tâche terminée : *${completeResult.taskName}*\n`
    : `⚠️ ${completeResult.message}\n`;
  break;

case 'RAPPORT_TACHES':
  const reportResult = await getFilteredTasksReport(action.filter);
  responseText += reportResult;
  break;
```

**Aussi : passer les nouveaux champs de TACHE au createTaskOnProject()**.

Actuellement (lignes 1215-1226), quand l'intention est `TACHE`, seul `action.content` est passé. Il faut aussi passer `action.due_date`, `action.priority`, `action.assignee`, `action.task_type` :

```javascript
case 'TACHE':
  const targetProjectId = action.link_to_previous ? lastCreatedProjectId : null;
  const taskOptions = {
    dueDate: action.due_date || null,
    priority: action.priority || null,
    assignee: action.assignee || null,
    taskType: action.task_type || null
  };
  // Si lié à un projet, passer les options
  const taskResult = targetProjectId
    ? await createTaskOnProject(action.content, targetProjectId, taskOptions)  // ← ajouter options
    : await createTask(action.content, taskOptions);  // ← ajouter options
  responseText += `✅ *${action.content}*\n`;
  break;
```

→ **Il faut donc aussi modifier la signature de `createTaskOnProject()`** dans gemini-tools.js pour accepter un 3e paramètre `options`.

---

### PROBLÈME 5 : Commandes WhatsApp enrichies

**Ajouter dans le handler de follow-ups** (whatsapp-client.js, vers lignes 1123-1160) :

Nouvelles commandes après un rapport :

```javascript
// "comment {n} {texte}" — ajouter un commentaire à la tâche n°
const commentMatch = txtLower.match(/^comment(?:aire)?\s+(\d+)\s+(.+)$/i);
if (commentMatch && currentReport) {
  const taskIndex = parseInt(commentMatch[1]) - 1;
  const commentText = commentMatch[2];
  const task = currentReport.tasks[taskIndex];
  if (task) {
    await addTaskComment(task.taskName, commentText);
    await wa.sock.sendMessage(jid, { text: `💬 Commentaire ajouté sur *${task.taskName}*` });
  }
}

// "urgent {n}" — passer en urgente
const urgentMatch = txtLower.match(/^urgent\s+(\d+)$/);
if (urgentMatch && currentReport) {
  const task = currentReport.tasks[parseInt(urgentMatch[1]) - 1];
  if (task) {
    await updateTaskByName(task.taskName, { priority: 'Urgent' });
    await wa.sock.sendMessage(jid, { text: `🔴 *${task.taskName}* → Urgent` });
  }
}

// "échéance {n} {date}" — changer l'échéance
const deadlineMatch = txtLower.match(/^[eé]ch[eé]ance\s+(\d+)\s+(.+)$/i);
if (deadlineMatch && currentReport) {
  const task = currentReport.tasks[parseInt(deadlineMatch[1]) - 1];
  const dateStr = deadlineMatch[2]; // "lundi", "demain", "25/03"
  // Parser la date relative → ISO
  // Appeler updateTaskByName(task.taskName, { due_date: parsedDate })
}

// "détail {n}" — détails complets
const detailMatch = txtLower.match(/^d[eé]tail\s+(\d+)$/);
if (detailMatch && currentReport) {
  const task = currentReport.tasks[parseInt(detailMatch[1]) - 1];
  // Récupérer tous les détails via l'API Notion
  // Formater : nom, priorité, échéance, assignee, projet, dossier, commentaires, historique
}
```

**Nouvelles commandes directes (hors rapport)** :
```
"tâches en retard"  → getFilteredTasksReport('retard')
"tâches aujourd'hui" → getFilteredTasksReport('aujourd'hui')
"tâches urgentes"    → getFilteredTasksReport('urgent')
"tâches semaine"     → getFilteredTasksReport('semaine')
```

Ajouter dans le bloc de commandes (lignes 791-933) :
```javascript
if (txtLower.startsWith('tâches') || txtLower.startsWith('taches')) {
  const filterMap = {
    'retard': 'retard', 'en retard': 'retard',
    "aujourd'hui": 'aujourd_hui', 'aujourdhui': 'aujourd_hui', 'du jour': 'aujourd_hui',
    'urgent': 'urgent', 'urgentes': 'urgent',
    'semaine': 'semaine', 'cette semaine': 'semaine'
  };
  const keyword = txtLower.replace(/^t[aâ]ches?\s*/, '');
  const filter = filterMap[keyword] || 'tout';
  const report = await getFilteredTasksReport(filter);
  await wa.sock.sendMessage(jid, { text: report });
  return;
}
```

---

### PROBLÈME 6 : Enrichir les rapports cron (8h, 12h, 18h)

**Modifier le cron dans `whatsapp-client.js`** (lignes 1566-1598).

Actuellement le cron envoie juste `getTasksReport()`. Enrichir :

```javascript
// 8h — Briefing matin
cron.schedule('0 8 * * 1-6', async () => {
  const allTasks = await fetch('http://localhost:3000/api/notion/all-tasks').then(r => r.json());
  const tasks = allTasks.tasks || [];
  const overdue = tasks.filter(t => t.dateStatus === 'overdue');
  const today = tasks.filter(t => t.dateStatus === 'today');
  const urgent = tasks.filter(t => t.priority === 'Urg & Imp' || t.priority === 'Urgent');

  let text = `☀️ *BRIEFING DU JOUR*\n\n`;
  if (overdue.length > 0) text += `⚠️ *${overdue.length} en retard*\n`;
  if (today.length > 0) text += `📅 *${today.length} prévues aujourd'hui*\n`;
  if (urgent.length > 0) text += `🔴 *${urgent.length} urgentes*\n`;
  text += `\n`;

  // Détail des tâches du jour par priorité
  const todayAndOverdue = [...overdue, ...today].sort(/* par priorité */);
  todayAndOverdue.forEach((t, i) => {
    const icon = t.dateStatus === 'overdue' ? '⚠️' : '📅';
    text += `${i+1}. ${icon} ${t.name} → ${t.dossier?.name || 'Sans dossier'}\n`;
  });

  // Envoyer
  await wa.sock.sendMessage(myJid, { text });
}, { timezone: 'Europe/Paris' });

// 18h — Bilan
cron.schedule('0 18 * * 1-6', async () => {
  // Tâches terminées aujourd'hui (via getDailyReport existant)
  const report = await getDailyReport();
  // Ajouter les tâches prévues demain
  await wa.sock.sendMessage(myJid, { text: report.text });
}, { timezone: 'Europe/Paris' });

// 12h — Rappel mi-journée (garder le rapport standard)
cron.schedule('0 12 * * *', async () => {
  const report = await getTasksReport();
  await wa.sock.sendMessage(myJid, { text: report });
}, { timezone: 'Europe/Paris' });
```

---

### PROBLÈME 7 : Auto-création de tâche suivante à la complétion

**TasksView.jsx a déjà cette logique** (lignes 320-391) mais uniquement côté Web. Il faut la même côté WhatsApp.

**Modifier `completeTaskById()` dans gemini-tools.js** (ligne 615) :

```javascript
export async function completeTaskById(taskId) {
  // 1. Récupérer la tâche AVANT de la compléter (pour lire "Tâche suivante" si elle existe)
  const getRes = await fetch(`https://api.notion.com/v1/pages/${taskId}`, { headers: notionHeaders() });
  const taskPage = await getRes.json();
  const taskName = taskPage.properties['Tâche']?.title?.[0]?.text?.content || 'Tâche';
  const nextTaskText = taskPage.properties['Tâche suivante']?.rich_text?.[0]?.text?.content || null;
  // Note: "Tâche suivante" n'existe peut-être pas encore dans Notion → voir PROBLÈME 8

  // 2. Compléter
  const res = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
    method: 'PATCH',
    headers: notionHeaders(),
    body: JSON.stringify({ properties: { 'Statut': { checkbox: true } } })
  });

  // 3. Si "Tâche suivante" définie → créer automatiquement
  let nextTaskCreated = null;
  if (nextTaskText) {
    const projectId = taskPage.properties['Projet']?.relation?.[0]?.id;
    const dossierId = taskPage.properties['💬 Dossiers']?.relation?.[0]?.id;
    const newTask = await createTaskOnProject(nextTaskText, projectId, { dossierId });
    nextTaskCreated = { name: nextTaskText, id: newTask.taskId };
  }

  return { success: true, taskName, nextTaskCreated };
}
```

---

### PROBLÈME 8 : Propriété "Tâche suivante" à ajouter dans Notion

**Créer `scripts/add-next-task-property.js`** :

```javascript
// Script pour ajouter la propriété "Tâche suivante" à la base Tâches si elle n'existe pas
const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function addProperty() {
  await notion.databases.update({
    database_id: process.env.NOTION_TASKS_DB_ID,
    properties: {
      'Tâche suivante': { rich_text: {} }
    }
  });
  console.log('✅ Propriété "Tâche suivante" ajoutée');
}
addProperty();
```

Exécuter : `node scripts/add-next-task-property.js`

---

### PROBLÈME 9 : Vue calendrier des tâches dans l'agent web

**Nouvelle API route : `src/app/api/notion/tasks-calendar/route.js`**

```javascript
// GET /api/notion/tasks-calendar?month=2026-03
// Retourne les tâches avec échéance, groupées par jour
// Format : { "2026-03-25": [{ id, name, priority, status, project, dossier }], ... }
// Utiliser le cache existant (getCache('tasks')) et filtrer par mois
```

**Enrichir TasksView.jsx** — Ajouter un toggle "📅 Calendrier" dans la toolbar :

- Vue liste (actuelle) ↔ Vue calendrier (nouvelle)
- Le calendrier montre les tâches par jour avec dots de priorité colorés
- Clic sur un jour → liste des tâches de ce jour
- Clic sur une tâche → ouvre le panneau détail existant
- Jours avec tâches en retard → fond rouge pâle
- Barre résumé en bas : `⚠️ X en retard · 📅 X aujourd'hui · 📋 X cette semaine`

---

## IMPORTS À METTRE À JOUR

**Dans `whatsapp-client.js`** (ligne 9), ajouter les nouveaux imports :
```javascript
import { scheduleReminder, addNoteToDossier, createTask, createProject,
         createTaskOnProject, getTasksReport, findProjectAndCreateTask,
         getCategoryReport, getDailyReport, completeTaskById,
         // NOUVEAUX :
         findTaskByName, completeTaskByName, updateTaskByName,
         addTaskComment, getFilteredTasksReport
} from './gemini-tools.js';
```

---

## ORDRE D'IMPLÉMENTATION

1. **`scripts/add-next-task-property.js`** — Ajouter la propriété Notion manquante
2. **`gemini-tools.js`** — Corriger createTask/createTaskOnProject (noms de propriétés !) + ajouter les 5 nouvelles fonctions
3. **`gemini-brain.js`** — Enrichir le system prompt avec les nouvelles intentions + exemples + dates
4. **`whatsapp-client.js`** — Ajouter les nouveaux cases dans le switch dispatcher + nouvelles commandes + enrichir cron
5. **`tasks-calendar/route.js`** — Nouvelle API calendrier
6. **`TasksView.jsx`** — Ajouter vue calendrier toggle

## TEST DE COHÉRENCE FINAL

Après implémentation, vérifier ces scénarios end-to-end :

1. **WhatsApp** : "Tâche urgente relancer Generali pour vendredi sur Dupont"
   → Doit créer dans Notion avec priorité=Urgent, date=vendredi, dossier=Dupont

2. **WhatsApp** : "La tâche relancer Generali est faite"
   → Doit cocher dans Notion + créer la tâche suivante si définie

3. **WhatsApp** : "Comment sur la tâche devis Martin : client veut 150€/mois"
   → Doit ajouter le commentaire dans Notion

4. **WhatsApp** : "Tâches en retard"
   → Doit lister les tâches avec date dépassée

5. **Web** : Créer tâche via modal → doit apparaître dans le rapport WhatsApp suivant

6. **Web** : Cocher tâche avec "tâche suivante" → toast + nouvelle tâche créée

7. **Calendrier Web** : Afficher les tâches du mois avec les bons codes couleur priorité

---

**COMMENCE MAINTENANT. Lis d'abord les fichiers dans l'ordre : `gemini-tools.js`, `gemini-brain.js`, `whatsapp-client.js` (lignes 1194-1280 et 791-933), puis implémente dans l'ordre ci-dessus.**

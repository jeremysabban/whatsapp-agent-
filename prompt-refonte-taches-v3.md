# PROMPT CLAUDE CODE — Refonte Tâches v3 (modèle simplifié)

---

## CONTEXTE

Agent WhatsApp CRM en Next.js 14 / Tailwind CSS connecté à Notion. Le système de tâches fonctionne mais est incohérent entre WhatsApp et le Web, et il manque des fonctionnalités clés.

### MODÈLE DE TÂCHE SIMPLIFIÉ

Pas de niveaux de priorité. Une tâche c'est :

```
TÂCHE
├── Titre (nom)
├── Projet (relation)
├── Responsable (qui)
├── Échéance (date)
├── Statut : binaire ☐ / ☑ (checkbox)
├── Commentaires (1 ou plusieurs, chacun avec auteur + timestamp)
├── Chaîne de tâches : tâches avant / tâches après sur le même projet
└── Report possible (décaler l'échéance)
```

### PROPRIÉTÉS NOTION EXISTANTES (base NOTION_TASKS_DB_ID)

| Propriété | Type Notion | Ce qu'on garde |
|-----------|-------------|----------------|
| `Tâche` | Title | ✅ Titre — on garde |
| `Statut` | Checkbox | ✅ Binaire — on garde |
| `Date échéance` | Date | ✅ Échéance — on garde |
| `Responsable` | Multi-select | ✅ `Jeremy`, `Perrine` — on garde |
| `Projet` | Relation → Projects | ✅ — on garde |
| `💬 Dossiers` | Relation → Dossiers | ✅ — on garde |
| `Commentaires` | Rich text | ⚠️ On va le remplacer par les vrais commentaires Notion (API Comments) |
| `Priorité` | Status | ❌ **SUPPRIMER de l'usage** — ne plus l'alimenter, ne plus l'afficher, ne pas supprimer la colonne Notion |
| `Type de tâche` | Select | ❌ **SUPPRIMER de l'usage** — idem |

### PROPRIÉTÉS NOTION À AJOUTER

| Propriété | Type Notion | Description |
|-----------|-------------|-------------|
| `Ordre` | Number | Position dans la chaîne de tâches du projet (1, 2, 3...) |

### FICHIERS À MODIFIER (avec état actuel)

**Backend :**
- `src/lib/gemini-brain.js` (127 lignes) — System prompt Gemini, 6 intentions
- `src/lib/gemini-tools.js` (638 lignes) — 11 outils d'exécution Notion
  - ⚠️ `createTask()` L.86 utilise `'Name'` et `'Status'` au lieu de `'Tâche'` et `'Statut'` (checkbox)
  - ⚠️ `createTaskOnProject()` L.195 est correct (`'Tâche'`, checkbox) mais ne passe ni date, ni responsable, ni dossier auto
  - ⚠️ `completeTaskById()` L.615 fait juste un PATCH checkbox, sans vérifier la chaîne
- `src/lib/whatsapp-client.js` (~1693 lignes)
  - Dispatcher L.1194-1280 : switch sur 6 intentions (NOUVEAU_PROJET, TACHE, TACHE_SUR_PROJET, RAPPEL, NOTE, RAPPORT_JOUR)
  - Commandes rapports L.791-933
  - Follow-ups (fait {n}, ajouter, retour) L.1045-1160
  - Cron jobs L.1566-1598

**API Routes :**
- `src/app/api/notion/create-task/route.js` (102 lignes) — Supporte déjà date, assignee, priority, taskType
- `src/app/api/notion/update-task/route.js` (110 lignes) — PATCH toutes propriétés
- `src/app/api/notion/update-task-status/route.js` (49 lignes) — Toggle checkbox
- `src/app/api/notion/all-tasks/route.js` (126 lignes) — Liste enrichie + cache + Eisenhower
- `src/app/api/notion/tasks/route.js` — Tâches groupées par dossier

**Frontend :**
- `src/components/TasksView.jsx` (500+ lignes) — A déjà : modal création, modal complétion avec tâches suivantes, fiche détail, notes/commentaires, filtres, édition

---

## MODIFICATIONS DÉTAILLÉES

### 1. SCRIPT — Ajouter propriété "Ordre"

Créer `scripts/update-tasks-schema.js` :
```javascript
// Ajouter la propriété "Ordre" (number) à la base Tâches
// Ne pas toucher aux propriétés existantes
await notion.databases.update({
  database_id: process.env.NOTION_TASKS_DB_ID,
  properties: {
    'Ordre': { number: {} }
  }
});
```

---

### 2. gemini-tools.js — Corriger et enrichir

#### 2a. Corriger `createTask()` (L.86-103)

Le code actuel utilise les MAUVAIS noms de propriétés :
```javascript
// ACTUEL (FAUX) :
'Name': { title: [...] },
'Status': { status: { name: 'À faire' } }

// CORRECT :
'Tâche': { title: [...] },
'Statut': { checkbox: false }
```

Remplacer par :
```javascript
export async function createTask(taskDescription, options = {}) {
  // options : { projectId, dossierId, dueDate, assignee }
  console.log(`🛠️ Outil : Création tâche "${taskDescription}"`);
  if (!NOTION_TASKS_DB_ID) return { success: false, message: "Base de tâches non configurée" };

  const properties = {
    'Tâche': { title: [{ text: { content: taskDescription } }] },
    'Statut': { checkbox: false }
  };

  if (options.dueDate) properties['Date échéance'] = { date: { start: options.dueDate } };
  if (options.assignee) {
    const assignees = options.assignee.split(', ').map(n => ({ name: n.trim() }));
    properties['Responsable'] = { multi_select: assignees };
  }
  if (options.projectId) properties['Projet'] = { relation: [{ id: options.projectId }] };
  if (options.dossierId) properties['💬 Dossiers'] = { relation: [{ id: options.dossierId }] };

  // Si projectId fourni mais pas dossierId, récupérer le dossier du projet
  if (options.projectId && !options.dossierId) {
    try {
      const projRes = await fetch(`https://api.notion.com/v1/pages/${options.projectId}`, { headers: notionHeaders() });
      if (projRes.ok) {
        const projData = await projRes.json();
        const dId = projData.properties['💬 Dossiers']?.relation?.[0]?.id;
        if (dId) properties['💬 Dossiers'] = { relation: [{ id: dId }] };
      }
    } catch (e) {}
  }

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({ parent: { database_id: NOTION_TASKS_DB_ID }, properties })
  });

  if (!res.ok) {
    const err = await res.json();
    return { success: false, message: err.message || "Erreur Notion" };
  }
  const created = await res.json();
  return { success: true, taskId: created.id, message: `Tâche créée : ${taskDescription}` };
}
```

#### 2b. Enrichir `createTaskOnProject()` (L.195-251)

Ajouter un 3e paramètre `options = {}` pour passer date/assignee :
```javascript
export async function createTaskOnProject(taskDescription, projectId = null, options = {}) {
  // ... code existant ...
  // Ajouter APRÈS la construction initiale des properties (L.203-206) :
  if (options.dueDate) properties['Date échéance'] = { date: { start: options.dueDate } };
  if (options.assignee) {
    const assignees = options.assignee.split(', ').map(n => ({ name: n.trim() }));
    properties['Responsable'] = { multi_select: assignees };
  }
  if (options.dossierId) properties['💬 Dossiers'] = { relation: [{ id: options.dossierId }] };
  if (options.ordre) properties['Ordre'] = { number: options.ordre };
  // ... reste du code existant ...
}
```

#### 2c. Enrichir `completeTaskById()` (L.615-637)

Après avoir coché une tâche, vérifier s'il y a une tâche suivante dans la chaîne (même projet, Ordre = Ordre+1) :

```javascript
export async function completeTaskById(taskId) {
  try {
    // 1. Lire la tâche avant de la compléter
    const getRes = await fetch(`https://api.notion.com/v1/pages/${taskId}`, { headers: notionHeaders() });
    if (!getRes.ok) return { success: false, message: 'Tâche introuvable' };
    const taskPage = await getRes.json();
    const taskName = taskPage.properties['Tâche']?.title?.[0]?.text?.content || 'Tâche';
    const projectId = taskPage.properties['Projet']?.relation?.[0]?.id || null;
    const ordre = taskPage.properties['Ordre']?.number || null;

    // 2. Cocher
    const res = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
      method: 'PATCH',
      headers: notionHeaders(),
      body: JSON.stringify({ properties: { 'Statut': { checkbox: true } } })
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, message: err.message };
    }

    // 3. Chercher la tâche suivante dans la chaîne (même projet, Ordre = ordre+1)
    let nextTask = null;
    if (projectId && ordre) {
      try {
        const nextRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
          method: 'POST',
          headers: notionHeaders(),
          body: JSON.stringify({
            filter: {
              and: [
                { property: 'Projet', relation: { contains: projectId } },
                { property: 'Ordre', number: { equals: ordre + 1 } },
                { property: 'Statut', checkbox: { equals: false } }
              ]
            },
            page_size: 1
          })
        });
        if (nextRes.ok) {
          const nextData = await nextRes.json();
          if (nextData.results.length > 0) {
            nextTask = {
              id: nextData.results[0].id,
              name: nextData.results[0].properties['Tâche']?.title?.[0]?.text?.content || 'Tâche suivante'
            };
          }
        }
      } catch (e) {}
    }

    return { success: true, taskName, nextTask };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
```

#### 2d. Nouvelles fonctions à ajouter

```javascript
// --- TROUVER UNE TÂCHE PAR NOM (recherche fuzzy) ---
export async function findTaskByName(taskName) {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        and: [
          { property: 'Tâche', title: { contains: taskName } },
          { property: 'Statut', checkbox: { equals: false } }
        ]
      },
      page_size: 5
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.results.length === 0) return null;
  const t = data.results[0];
  return {
    id: t.id,
    name: t.properties['Tâche']?.title?.[0]?.text?.content,
    projectId: t.properties['Projet']?.relation?.[0]?.id,
    dossierId: t.properties['💬 Dossiers']?.relation?.[0]?.id,
    date: t.properties['Date échéance']?.date?.start,
    ordre: t.properties['Ordre']?.number
  };
}

// --- COMPLÉTER PAR NOM ---
export async function completeTaskByName(taskName) {
  const task = await findTaskByName(taskName);
  if (!task) return { success: false, message: `Tâche "${taskName}" introuvable` };
  return await completeTaskById(task.id);
}

// --- REPORTER UNE TÂCHE (décaler l'échéance) ---
export async function postponeTask(taskName, newDate) {
  const task = await findTaskByName(taskName);
  if (!task) return { success: false, message: `Tâche "${taskName}" introuvable` };

  await fetch(`https://api.notion.com/v1/pages/${task.id}`, {
    method: 'PATCH',
    headers: notionHeaders(),
    body: JSON.stringify({
      properties: { 'Date échéance': { date: { start: newDate } } }
    })
  });
  return { success: true, taskName: task.name, newDate };
}

// --- COMMENTER UNE TÂCHE (via API Notion Comments) ---
export async function addTaskComment(taskIdOrName, comment, author = 'Jeremy') {
  let taskId = taskIdOrName;
  let taskName = taskIdOrName;

  // Si c'est un nom et pas un UUID, chercher
  if (!taskIdOrName.includes('-') || taskIdOrName.length < 30) {
    const task = await findTaskByName(taskIdOrName);
    if (!task) return { success: false, message: `Tâche "${taskIdOrName}" introuvable` };
    taskId = task.id;
    taskName = task.name;
  }

  const timestamp = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  await notion.comments.create({
    parent: { page_id: taskId },
    rich_text: [{
      text: { content: `[${timestamp} — ${author}] ${comment}` }
    }]
  });

  return { success: true, taskName, comment };
}

// --- CRÉER UNE CHAÎNE DE TÂCHES SUR UN PROJET ---
export async function createTaskChain(projectId, tasks, options = {}) {
  // tasks = [{ content: "Demander RIB", dueDate, assignee }, { content: "Envoyer contrat", dueDate, assignee }, ...]
  // Chaque tâche reçoit un Ordre séquentiel (1, 2, 3...)

  // D'abord, trouver le dernier Ordre existant sur ce projet
  let startOrdre = 1;
  try {
    const existingRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: { property: 'Projet', relation: { contains: projectId } },
        sorts: [{ property: 'Ordre', direction: 'descending' }],
        page_size: 1
      })
    });
    if (existingRes.ok) {
      const data = await existingRes.json();
      if (data.results.length > 0) {
        startOrdre = (data.results[0].properties['Ordre']?.number || 0) + 1;
      }
    }
  } catch (e) {}

  const created = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const result = await createTaskOnProject(t.content, projectId, {
      dueDate: t.dueDate || options.dueDate,
      assignee: t.assignee || options.assignee,
      dossierId: options.dossierId,
      ordre: startOrdre + i
    });
    created.push({ ...result, ordre: startOrdre + i, name: t.content });
  }

  return { success: true, created, message: `${created.length} tâches créées en chaîne` };
}

// --- RAPPORT TÂCHES FILTRÉ ---
export async function getFilteredTasksReport(filter = 'tout') {
  try {
    const res = await fetch('http://localhost:3000/api/notion/all-tasks');
    if (!res.ok) return "⚠️ Erreur récupération tâches.";
    const data = await res.json();
    const tasks = (data.tasks || []).filter(t => !t.completed);

    const today = new Date().toISOString().split('T')[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    let filtered;
    let title;
    switch (filter) {
      case 'retard':
        filtered = tasks.filter(t => t.date && t.date < today);
        title = '⚠️ TÂCHES EN RETARD';
        break;
      case 'aujourd_hui':
        filtered = tasks.filter(t => t.date === today);
        title = '📅 TÂCHES DU JOUR';
        break;
      case 'semaine':
        filtered = tasks.filter(t => t.date && t.date >= today && t.date <= weekEnd);
        title = '📆 TÂCHES DE LA SEMAINE';
        break;
      default:
        filtered = tasks;
        title = '📋 TOUTES LES TÂCHES';
    }

    if (filtered.length === 0) return `${title}\n\n✅ Rien à signaler !`;

    let text = `${title} (${filtered.length})\n\n`;
    filtered.forEach((t, i) => {
      const dateStr = t.date
        ? (t.date < today ? `⚠️ retard` : `📅 ${new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`)
        : '';
      const project = t.project?.name ? `📁 ${t.project.name}` : '';
      const assignee = t.assignee || '';
      text += `${i+1}. ☐ *${t.name}*\n   └ ${[project, assignee, dateStr].filter(Boolean).join(' · ')}\n\n`;
    });

    text += `─────────────────\n`;
    text += `*fait {n}* → terminer · *report {n} lundi* → reporter\n`;
    text += `*comment {n} texte* → commenter · *détail {n}* → voir tout`;

    return text;
  } catch (error) {
    return "⚠️ Erreur rapport.";
  }
}
```

---

### 3. gemini-brain.js — Enrichir le system prompt

**Fichier : `src/lib/gemini-brain.js`**, modifier le `systemInstruction` (L.46-103).

**Remplacer les 6 intentions actuelles par ces 9** (dans le même format) :

```
TES ORDRES (Tu dois renvoyer une LISTE d'actions en JSON) :

1. **NOUVEAU_PROJET** — Créer un projet Lead/Sinistre/Gestion
   - "category": "LEAD" | "SINISTRE" | "GESTION"
   - "client": Nom du dossier client
   - "content": Titre du projet

2. **TACHE** — Créer une tâche (liée au projet créé juste avant si link_to_previous)
   - "content": Titre de la tâche
   - "link_to_previous": true/false
   - "due_date": Date ISO (optionnel) — extraire de "pour vendredi", "avant demain"
   - "assignee": "Jeremy" | "Perrine" (optionnel)

3. **TACHE_SUR_PROJET** — Tâche sur un projet existant
   - "project_name": Nom du projet existant
   - "content": Titre de la tâche
   - "due_date": Date ISO (optionnel)
   - "assignee": "Jeremy" | "Perrine" (optionnel)

4. **CHAINE_TACHES** (NOUVEAU) — Créer plusieurs tâches ordonnées sur un projet
   - "project_name": Nom du projet (existant) OU "link_to_previous": true
   - "tasks": [
       { "content": "Étape 1", "due_date": "...", "assignee": "..." },
       { "content": "Étape 2", "due_date": "...", "assignee": "..." }
     ]

5. **RAPPEL**
   - "content": Texte du rappel
   - "time": Date/heure ISO

6. **NOTE**
   - "client": Nom du dossier
   - "content": Contenu

7. **COMPLETER_TACHE** (NOUVEAU) — Marquer une tâche comme faite
   - "task_name": Nom ou partie du nom de la tâche

8. **COMMENTER_TACHE** (NOUVEAU) — Ajouter un commentaire
   - "task_name": Nom de la tâche
   - "comment": Texte du commentaire

9. **REPORTER_TACHE** (NOUVEAU) — Décaler l'échéance
   - "task_name": Nom de la tâche
   - "new_date": Nouvelle date ISO

10. **RAPPORT_JOUR**
```

**Ajouter des exemples au system prompt** :

```
Exemple 3 - Chaîne de tâches :
"Sur le lead Martin, d'abord récupérer le RIB, puis envoyer le contrat, puis relancer"
[
  { "intention": "CHAINE_TACHES", "project_name": "Lead Martin", "tasks": [
    { "content": "Récupérer le RIB" },
    { "content": "Envoyer le contrat" },
    { "content": "Relancer" }
  ]}
]

Exemple 4 - Compléter et commenter :
"La tâche RIB Dupont est faite, il a envoyé par mail"
[
  { "intention": "COMPLETER_TACHE", "task_name": "RIB Dupont" },
  { "intention": "COMMENTER_TACHE", "task_name": "RIB Dupont", "comment": "Reçu par mail" }
]

Exemple 5 - Reporter :
"Reporte la tâche relance Generali à lundi"
[
  { "intention": "REPORTER_TACHE", "task_name": "relance Generali", "new_date": "2026-03-23T09:00:00.000Z" }
]

Exemple 6 - Tâche avec échéance :
"Tâche appeler Martin pour vendredi"
[
  { "intention": "TACHE_SUR_PROJET", "project_name": "Martin", "content": "Appeler Martin", "due_date": "2026-03-20" }
]
```

**Enrichir les règles de dates** (L.86-89) — ajouter :
```
- Jour actuel : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
- "vendredi" = vendredi prochain si on est après vendredi, sinon ce vendredi
- "la semaine prochaine" = lundi prochain à 9h
- "dans 3 jours" = +3 jours à 9h
- "fin de semaine" = vendredi 18h
```

---

### 4. whatsapp-client.js — Dispatcher + Commandes

#### 4a. Ajouter les nouveaux cases dans le switch (L.1194-1280)

Après les cases existants, ajouter :

```javascript
case 'COMPLETER_TACHE':
  const compResult = await completeTaskByName(action.task_name);
  if (compResult.success) {
    responseText += `✅ *${compResult.taskName}* → terminée\n`;
    if (compResult.nextTask) {
      responseText += `   ➡️ Prochaine étape : *${compResult.nextTask.name}*\n`;
    }
  } else {
    responseText += `⚠️ ${compResult.message}\n`;
  }
  break;

case 'COMMENTER_TACHE':
  const cmtResult = await addTaskComment(action.task_name, action.comment);
  responseText += cmtResult.success
    ? `💬 Commentaire ajouté sur *${cmtResult.taskName}*\n`
    : `⚠️ ${cmtResult.message}\n`;
  break;

case 'REPORTER_TACHE':
  const postResult = await postponeTask(action.task_name, action.new_date);
  if (postResult.success) {
    const dateStr = new Date(action.new_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    responseText += `📅 *${postResult.taskName}* reportée au ${dateStr}\n`;
  } else {
    responseText += `⚠️ ${postResult.message}\n`;
  }
  break;

case 'CHAINE_TACHES':
  let chainProjectId = null;
  if (action.link_to_previous && lastCreatedProjectId) {
    chainProjectId = lastCreatedProjectId;
  } else if (action.project_name) {
    // Chercher le projet
    const projSearch = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: { property: 'Name', title: { contains: action.project_name } },
        page_size: 1
      })
    });
    if (projSearch.ok) {
      const projData = await projSearch.json();
      if (projData.results.length > 0) chainProjectId = projData.results[0].id;
    }
  }
  if (chainProjectId) {
    const chainResult = await createTaskChain(chainProjectId, action.tasks);
    responseText += `🔗 *Chaîne de ${chainResult.created.length} tâches* créée :\n`;
    chainResult.created.forEach((t, i) => {
      responseText += `   ${i+1}. ${t.name}\n`;
    });
  } else {
    responseText += `⚠️ Projet introuvable pour la chaîne\n`;
  }
  break;
```

#### 4b. Passer date/assignee dans le case TACHE existant (L.1215-1226)

Actuellement :
```javascript
case 'TACHE':
  const targetProjectId = action.link_to_previous ? lastCreatedProjectId : null;
  if (targetProjectId) {
    taskResult = await createTaskOnProject(action.content, targetProjectId);
  } else {
    taskResult = await createTask(action.content);
  }
```

Modifier en :
```javascript
case 'TACHE':
  const targetProjectId = action.link_to_previous ? lastCreatedProjectId : null;
  const taskOpts = {
    dueDate: action.due_date || null,
    assignee: action.assignee || null
  };
  if (targetProjectId) {
    taskResult = await createTaskOnProject(action.content, targetProjectId, taskOpts);
  } else {
    taskResult = await createTask(action.content, taskOpts);
  }
```

**Même chose pour TACHE_SUR_PROJET** (L.1228-1235) :
```javascript
case 'TACHE_SUR_PROJET':
  const fpResult = await findProjectAndCreateTask(action.project_name, action.content);
  // → modifier findProjectAndCreateTask() pour accepter un 3e param options
  // et passer action.due_date, action.assignee
```

#### 4c. Nouvelles commandes WhatsApp directes (ajouter vers L.791-933)

```javascript
// Commandes "tâches ..."
if (txtLower.match(/^t[aâ]ches?\s/)) {
  const keyword = txtLower.replace(/^t[aâ]ches?\s*/, '');
  const filterMap = {
    'retard': 'retard', 'en retard': 'retard',
    "aujourd'hui": 'aujourd_hui', 'aujourdhui': 'aujourd_hui', 'du jour': 'aujourd_hui',
    'semaine': 'semaine', 'cette semaine': 'semaine',
  };
  const filter = filterMap[keyword] || 'tout';
  const report = await getFilteredTasksReport(filter);
  await wa.sock.sendMessage(jid, { text: report });
  // Stocker pour follow-up (fait, comment, report, détail)
  return;
}
```

#### 4d. Nouvelles commandes follow-up après un rapport (ajouter vers L.1123-1160)

En plus du `fait {n}` existant, ajouter :

```javascript
// "report {n} {date}" — reporter une tâche
const reportMatch = txtLower.match(/^report(?:e|er)?\s+(\d+)\s+(.+)$/i);
if (reportMatch && currentReport) {
  const taskIndex = parseInt(reportMatch[1]) - 1;
  const dateInput = reportMatch[2]; // "lundi", "demain", "25/03"
  // Envoyer au brain pour parser la date : processSmartInput(`reporter la tâche au ${dateInput}`)
  // Ou parser directement avec une fonction helper
  // Puis appeler postponeTask(task.taskName, parsedDate)
}

// "comment {n} {texte}" — commenter
const commentMatch = txtLower.match(/^comment(?:aire)?\s+(\d+)\s+(.+)$/i);
if (commentMatch && currentReport) {
  const taskIndex = parseInt(commentMatch[1]) - 1;
  const comment = commentMatch[2];
  // Trouver la tâche dans le rapport courant
  // Appeler addTaskComment(taskId, comment)
}

// "détail {n}" — afficher tous les détails + commentaires
const detailMatch = txtLower.match(/^d[eé]tail\s+(\d+)$/);
if (detailMatch && currentReport) {
  const taskIndex = parseInt(detailMatch[1]) - 1;
  // Récupérer la page Notion complète
  // Récupérer les commentaires Notion : notion.comments.list({ block_id: taskId })
  // Formater : nom, projet, dossier, responsable, échéance, position dans la chaîne, commentaires
}
```

#### 4e. Enrichir les cron jobs (L.1566-1598)

Remplacer les 3 cron identiques par des rapports différenciés :

```javascript
// 8h — Briefing matin (lun-sam)
cron.schedule('0 8 * * 1-6', async () => {
  if (wa.connectionStatus !== 'connected' || !wa.sock) return;
  const myJid = wa.sock.user?.id?.split(':')[0] + '@s.whatsapp.net';

  const allRes = await fetch('http://localhost:3000/api/notion/all-tasks');
  const data = await allRes.json();
  const tasks = (data.tasks || []).filter(t => !t.completed);
  const today = new Date().toISOString().split('T')[0];

  const overdue = tasks.filter(t => t.date && t.date < today);
  const todayTasks = tasks.filter(t => t.date === today);

  let text = `☀️ *BRIEFING DU JOUR*\n\n`;
  if (overdue.length) text += `⚠️ ${overdue.length} en retard\n`;
  text += `📅 ${todayTasks.length} prévues aujourd'hui\n`;
  text += `📋 ${tasks.length} ouvertes au total\n\n`;

  [...overdue, ...todayTasks].forEach((t, i) => {
    const icon = (t.date && t.date < today) ? '⚠️' : '📅';
    text += `${i+1}. ${icon} *${t.name}*\n   └ ${t.project?.name || ''} ${t.assignee || ''}\n`;
  });

  await wa.sock.sendMessage(myJid, { text });
}, { timezone: 'Europe/Paris' });

// 12h — Rappel mi-journée
cron.schedule('0 12 * * *', async () => {
  if (wa.connectionStatus !== 'connected' || !wa.sock) return;
  const myJid = wa.sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
  const report = await getTasksReport();
  await wa.sock.sendMessage(myJid, { text: report });
}, { timezone: 'Europe/Paris' });

// 18h — Bilan fin de journée (lun-ven)
cron.schedule('0 18 * * 1-5', async () => {
  if (wa.connectionStatus !== 'connected' || !wa.sock) return;
  const myJid = wa.sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
  const daily = await getDailyReport();
  if (daily.success) await wa.sock.sendMessage(myJid, { text: daily.text });
}, { timezone: 'Europe/Paris' });
```

---

### 5. Imports à mettre à jour

**Dans `whatsapp-client.js`** (L.9), ajouter les nouveaux imports :
```javascript
import { scheduleReminder, addNoteToDossier, createTask, createProject,
         createTaskOnProject, getTasksReport, findProjectAndCreateTask,
         getCategoryReport, getDailyReport, completeTaskById,
         // NOUVEAUX :
         findTaskByName, completeTaskByName, postponeTask,
         addTaskComment, createTaskChain, getFilteredTasksReport
} from './gemini-tools.js';
```

---

### 6. API route — Commentaires Notion

**Nouvelle route : `src/app/api/notion/task-comments/route.js`**

```javascript
// GET /api/notion/task-comments?taskId=xxx
// Retourne les commentaires Notion d'une tâche (notion.comments.list)
// Chaque commentaire : { id, author, text, createdTime }

// POST /api/notion/task-comments
// Body : { taskId, comment, author }
// Crée un commentaire via notion.comments.create
```

**Pourquoi ?** Le TasksView.jsx utilise actuellement le champ rich_text "Commentaires" (un seul bloc de texte). On migre vers les vrais commentaires Notion qui ont chacun un auteur et un timestamp natifs.

---

### 7. API route — Tâches calendrier

**Nouvelle route : `src/app/api/notion/tasks-calendar/route.js`**

```javascript
// GET /api/notion/tasks-calendar?month=2026-03
// Utilise le cache existant (getCache('tasks'))
// Filtre les tâches ayant une date dans le mois demandé
// Retourne : { "2026-03-18": [{ id, name, completed, project, assignee }], "2026-03-25": [...] }
```

---

### 8. TasksView.jsx — Adaptations

**Simplifier** :
- Retirer les références à `priority`, `quadrant`, `Eisenhower` dans le composant
- Retirer `taskType` des formulaires
- Retirer les filtres `filterUrgent`

**Ajouter** :
- Section commentaires dans la fiche détail qui appelle `GET /api/notion/task-comments?taskId=xxx`
  - Chaque commentaire affiché avec auteur + date + texte (style timeline)
  - Input en bas pour ajouter un commentaire (`POST /api/notion/task-comments`)
- Bouton "📅 Reporter" sur chaque tâche → ouvre un date picker, PATCH la date
- Vue "Chaîne" dans la fiche détail : afficher les tâches du même projet ordonnées par `Ordre`, avec la tâche courante surlignée
- Toggle "📅 Calendrier" dans la toolbar pour basculer en vue calendrier mensuelle

---

### 9. API `create-task/route.js` — Ajouter support Ordre

**Modifier `src/app/api/notion/create-task/route.js`** (L.7) :
Ajouter `ordre` dans les paramètres acceptés :
```javascript
const { name, dossierId, projectId, assignee, date, ordre } = await request.json();
// ...
if (ordre) properties['Ordre'] = { number: ordre };
```

Retirer `priority` et `taskType` du destructuring (on ne les utilise plus).

---

## ORDRE D'IMPLÉMENTATION

1. `scripts/update-tasks-schema.js` — Ajouter propriété "Ordre"
2. `src/lib/gemini-tools.js` — Corriger noms de propriétés + enrichir fonctions existantes + ajouter 6 nouvelles fonctions
3. `src/lib/gemini-brain.js` — Enrichir system prompt avec 4 nouvelles intentions + exemples + dates
4. `src/lib/whatsapp-client.js` — Nouveaux cases dispatcher + nouvelles commandes + cron différenciés
5. `src/app/api/notion/task-comments/route.js` — Nouvelle route commentaires
6. `src/app/api/notion/tasks-calendar/route.js` — Nouvelle route calendrier
7. `src/app/api/notion/create-task/route.js` — Ajouter support Ordre, retirer priority/taskType
8. `src/components/TasksView.jsx` — Simplifier (retirer priorité/type) + ajouter commentaires/chaîne/calendrier/report

## CE QUI NE DOIT PAS CHANGER
- Les autres vues (dashboard, kanban, documents, conversations, contacts)
- La hiérarchie Dossier > Projet > Tâches
- Le flow de validation WhatsApp (plan → 1/2/3)
- Les API routes non liées aux tâches
- Le système de cache (notion-cache.js)

## TESTS END-TO-END

1. WhatsApp : "Tâche appeler Martin pour vendredi" → créée dans Notion avec échéance vendredi
2. WhatsApp : "Sur le lead Dupont, d'abord RIB, puis contrat, puis relance" → 3 tâches avec Ordre 1,2,3
3. WhatsApp : "La tâche RIB Dupont est faite" → cochée + message avec prochaine étape "contrat"
4. WhatsApp : "Comment sur tâche contrat Dupont : client a envoyé par mail" → commentaire Notion créé
5. WhatsApp : "Reporte la tâche relance au lundi" → échéance mise à jour
6. WhatsApp : "Tâches en retard" → rapport filtré
7. Web : Voir les commentaires sur une tâche dans la fiche détail
8. Web : Voir la chaîne de tâches ordonnée dans la fiche détail
9. Web : Basculer en vue calendrier

---

**COMMENCE MAINTENANT. Lis d'abord `gemini-tools.js` en entier, puis `gemini-brain.js`, puis les lignes 1194-1280 et 791-933 de `whatsapp-client.js`. Implémente dans l'ordre ci-dessus.**

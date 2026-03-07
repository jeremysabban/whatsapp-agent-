import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';
import { NOTION_TASKS_DB_ID, NOTION_API_KEY, NOTION_PROJECTS_DB_ID, NOTION_DOSSIERS_DB_ID, notionHeaders } from './notion-config.js';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const REMINDERS_DB_PATH = path.join(process.cwd(), 'data', 'reminders.json');

// --- OUTIL 1 : RAPPEL ---
export async function scheduleReminder(text, timeISO) {
  console.log(`🛠️ Outil : Programmation rappel pour ${timeISO}`);

  // Validation de la date
  if (!timeISO) {
    timeISO = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    console.log(`🛠️ Pas de date fournie, défaut: ${timeISO}`);
  }

  let reminderDate = new Date(timeISO);
  if (isNaN(reminderDate.getTime())) {
    reminderDate = new Date(Date.now() + 10 * 60 * 1000);
    timeISO = reminderDate.toISOString();
    console.log(`🛠️ Date invalide, défaut dans 10min: ${timeISO}`);
  }

  let reminders = [];
  try {
    if (fs.existsSync(REMINDERS_DB_PATH)) {
      reminders = JSON.parse(fs.readFileSync(REMINDERS_DB_PATH, 'utf8'));
    }
  } catch (e) {}

  reminders.push({
    id: Date.now().toString(),
    text: text || 'Rappel',
    time: timeISO,
    phone: 'me'
  });

  fs.writeFileSync(REMINDERS_DB_PATH, JSON.stringify(reminders, null, 2));

  const timeStr = reminderDate.toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
  return { success: true, message: `Alarme réglée pour ${timeStr}` };
}

// --- OUTIL 2 : NOTE SUR DOSSIER ---
export async function addNoteToDossier(clientName, content) {
  console.log(`🔍 Recherche dossier pour : ${clientName}`);

  const searchResponse = await notion.search({
    query: clientName,
    filter: { value: 'page', property: 'object' },
    page_size: 1
  });

  if (searchResponse.results.length === 0) {
    return { success: false, message: `Dossier introuvable pour ${clientName}` };
  }

  const pageId = searchResponse.results[0].id;
  const pageTitle = searchResponse.results[0].properties['Nom']?.title[0]?.text?.content || "Dossier";

  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        heading_3: {
          rich_text: [{ text: { content: `🎙️ Note ${new Date().toLocaleDateString()}` } }]
        }
      },
      {
        paragraph: {
          rich_text: [{ text: { content: content } }]
        }
      }
    ]
  });

  return { success: true, message: `Note ajoutée au dossier **${pageTitle}**` };
}

// --- OUTIL 3 : TÂCHE ---
export async function createTask(taskDescription) {
  console.log(`🛠️ Outil : Création tâche "${taskDescription}"`);

  const tasksDbId = process.env.NOTION_TASKS_DB_ID;
  if (!tasksDbId) {
    return { success: false, message: "Base de tâches non configurée" };
  }

  await notion.pages.create({
    parent: { database_id: tasksDbId },
    properties: {
      'Name': { title: [{ text: { content: taskDescription } }] },
      'Status': { status: { name: 'À faire' } }
    }
  });

  return { success: true, message: `Tâche créée : ${taskDescription}` };
}

// --- OUTIL 4 : NOUVEAU LEAD ---
export async function createLead(clientName, projectDetails) {
  console.log(`💼 Création Lead : ${clientName} - ${projectDetails}`);

  const dbId = process.env.NOTION_CONTACTS_DB_ID;
  if (!dbId) {
    return { success: false, message: "Pas de base Contacts configurée." };
  }

  try {
    await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        'Nom': { title: [{ text: { content: clientName || 'Nouveau Lead' } }] },
        'Tags': { multi_select: [{ name: 'Lead' }] },
        'Projet': { rich_text: [{ text: { content: projectDetails || '' } }] },
        'Statut': { select: { name: 'Nouveau' } }
      }
    });
    return { success: true, message: `Lead créé pour **${clientName}**` };
  } catch (error) {
    console.error('❌ Erreur création Lead:', error.message);
    return { success: false, message: "Erreur lors de la création du lead Notion." };
  }
}

// --- OUTIL 5 : CRÉER UN PROJET (Lead/Sinistre/Gestion) ---
export async function createProject(category, clientName, projectTitle) {
  console.log(`📂 Création Projet ${category} : ${clientName} - ${projectTitle}`);

  if (!NOTION_PROJECTS_DB_ID) {
    return { success: false, message: "Base Projets non configurée" };
  }

  try {
    // 1. Recherche du dossier client
    let dossierId = null;
    if (clientName && NOTION_DOSSIERS_DB_ID) {
      const searchRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_DOSSIERS_DB_ID}/query`, {
        method: 'POST',
        headers: notionHeaders(),
        body: JSON.stringify({
          filter: { property: 'Nom du dossier', title: { contains: clientName } },
          page_size: 1
        })
      });
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.results.length > 0) {
          dossierId = data.results[0].id;
        }
      }
    }

    // 2. Création du projet
    const properties = {
      'Name': { title: [{ text: { content: projectTitle || `${category} - ${clientName}` } }] },
      'Type': { select: { name: category } }
    };

    // Lier au dossier si trouvé
    if (dossierId) {
      properties['💬 Dossiers'] = { relation: [{ id: dossierId }] };
    }

    const res = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: NOTION_PROJECTS_DB_ID },
        properties
      })
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('❌ Erreur création Projet:', err);
      return { success: false, message: err.message || "Erreur Notion" };
    }

    const created = await res.json();
    return { success: true, projectId: created.id, message: `Projet créé` };

  } catch (error) {
    console.error('❌ Erreur création Projet:', error.message);
    return { success: false, message: error.message };
  }
}

// --- OUTIL 6 : CRÉER UNE TÂCHE (avec lien optionnel au projet) ---
export async function createTaskOnProject(taskDescription, projectId = null) {
  console.log(`✅ Création Tâche : "${taskDescription}" ${projectId ? `(projet: ${projectId})` : '(sans projet)'}`);

  if (!NOTION_TASKS_DB_ID) {
    return { success: false, message: "Base Tâches non configurée" };
  }

  try {
    const properties = {
      'Tâche': { title: [{ text: { content: taskDescription } }] },
      'Statut': { checkbox: false }
    };

    // Lier au projet si fourni + récupérer le dossier du projet
    if (projectId) {
      properties['Projet'] = { relation: [{ id: projectId }] };

      // Récupérer le projet pour obtenir le dossier lié
      try {
        const projectRes = await fetch(`https://api.notion.com/v1/pages/${projectId}`, {
          headers: notionHeaders()
        });
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          const dossierId = projectData.properties['💬 Dossiers']?.relation?.[0]?.id;
          if (dossierId) {
            properties['💬 Dossiers'] = { relation: [{ id: dossierId }] };
          }
        }
      } catch (e) {
        // Silently continue without dossier link
      }
    }

    const res = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: NOTION_TASKS_DB_ID },
        properties
      })
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('❌ Erreur création Tâche:', err);
      return { success: false, message: err.message || "Erreur Notion" };
    }

    const created = await res.json();
    return { success: true, taskId: created.id, message: `Tâche créée` };

  } catch (error) {
    console.error('❌ Erreur création Tâche:', error.message);
    return { success: false, message: error.message };
  }
}

// --- OUTIL 7 : RAPPORT DES TÂCHES ---
export async function getTasksReport() {
  try {
    // Utilise l'API interne all-tasks qui a déjà tous les noms de projets
    const res = await fetch('http://localhost:3000/api/notion/all-tasks');
    if (!res.ok) {
      return "⚠️ Erreur récupération tâches.";
    }

    const data = await res.json();
    const tasks = data.tasks?.filter(t => !t.completed) || [];

    if (tasks.length === 0) return "✅ Aucune tâche en cours. Tu es à jour !";

    let reportLines = [];

    for (const task of tasks) {
      const taskTitle = task.name || "Sans titre";
      const priority = task.priority || "";
      const dueDate = task.date || null;
      const projectName = task.project?.name || null;

      // Format projet
      const projectContext = projectName ? `📁 ${projectName}` : "⚪️ Sans projet";

      // Format date
      let dateStr = "";
      if (dueDate) {
        const today = new Date().toISOString().split('T')[0];
        if (dueDate < today) dateStr = "⚠️ RETARD";
        else if (dueDate === today) dateStr = "📅 Auj.";
        else {
          const d = new Date(dueDate);
          dateStr = `📅 ${d.getDate()}/${d.getMonth()+1}`;
        }
      }

      const priorityIcon = priority === 'Urg & Imp' ? '🔴' : priority === 'Important' ? '🟡' : priority === 'Urgent' ? '🟠' : '⚪';

      reportLines.push(`${priorityIcon} *${taskTitle}*\n   └ ${projectContext}${dateStr ? ` | ${dateStr}` : ''}`);
    }

    return `📋 *RAPPORT (${tasks.length} tâches)*\n\n${reportLines.join('\n\n')}`;

  } catch (error) {
    console.error("❌ Erreur Rapport:", error.message);
    return "⚠️ Impossible de générer le rapport.";
  }
}

// --- OUTIL 8 : TÂCHE SUR PROJET EXISTANT ---
export async function findProjectAndCreateTask(projectName, taskDescription) {
  console.log(`🔍 Recherche projet "${projectName}" pour y ajouter la tâche "${taskDescription}"`);

  if (!NOTION_PROJECTS_DB_ID || !NOTION_TASKS_DB_ID) {
    return { success: false, message: "Base Projets ou Tâches non configurée" };
  }

  try {
    // 1. Rechercher le projet par nom
    const searchRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: { property: 'Name', title: { contains: projectName } },
        page_size: 5
      })
    });

    if (!searchRes.ok) {
      const err = await searchRes.json();
      return { success: false, message: `Erreur recherche projet: ${err.message}` };
    }

    const data = await searchRes.json();
    if (data.results.length === 0) {
      return { success: false, message: `Projet "${projectName}" introuvable` };
    }

    // Prendre le premier résultat (le plus pertinent)
    const project = data.results[0];
    const projectId = project.id;
    const projectTitle = project.properties['Name']?.title[0]?.text?.content || projectName;
    const dossierId = project.properties['💬 Dossiers']?.relation?.[0]?.id || null;

    // 2. Créer la tâche liée à ce projet (et au dossier si disponible)
    const taskProperties = {
      'Tâche': { title: [{ text: { content: taskDescription } }] },
      'Statut': { checkbox: false },
      'Projet': { relation: [{ id: projectId }] }
    };

    if (dossierId) {
      taskProperties['💬 Dossiers'] = { relation: [{ id: dossierId }] };
    }

    const taskRes = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: NOTION_TASKS_DB_ID },
        properties: taskProperties
      })
    });

    if (!taskRes.ok) {
      const err = await taskRes.json();
      return { success: false, message: `Erreur création tâche: ${err.message}` };
    }

    const created = await taskRes.json();
    return {
      success: true,
      taskId: created.id,
      projectId: projectId,
      projectTitle: projectTitle,
      message: `Tâche créée sur projet "${projectTitle}"`
    };

  } catch (error) {
    console.error('❌ Erreur findProjectAndCreateTask:', error.message);
    return { success: false, message: error.message };
  }
}

// --- OUTIL 9 : RAPPORT PAR CATÉGORIE ---
export async function getCategoryReport(category) {
  // category = 'Lead' | 'Sinistre' | 'Gestion'
  console.log(`📊 Génération rapport ${category}...`);

  if (!NOTION_PROJECTS_DB_ID || !NOTION_TASKS_DB_ID) {
    return { success: false, message: "Bases non configurées" };
  }

  try {
    // 1. Récupérer les projets actifs de cette catégorie
    const projRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        filter: {
          and: [
            { property: 'Type', select: { equals: category } },
            { property: 'Terminé', checkbox: { equals: false } }
          ]
        },
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        page_size: 50
      })
    });

    if (!projRes.ok) {
      const err = await projRes.json();
      return { success: false, message: err.message };
    }

    const projData = await projRes.json();
    const projects = projData.results;

    if (projects.length === 0) {
      return { success: true, text: `Aucun ${category.toLowerCase()} en cours.`, items: [] };
    }

    // 2. Pour chaque projet, récupérer le dossier lié et les tâches
    const items = [];
    let reportText = '';
    let dossierIndex = 1;

    // Regrouper les projets par dossier
    const dossierMap = new Map();

    for (const proj of projects) {
      const projName = proj.properties['Name']?.title?.[0]?.text?.content || 'Sans nom';
      const projId = proj.id;
      const dossierId = proj.properties['💬 Dossiers']?.relation?.[0]?.id || null;

      // Récupérer le nom du dossier
      let dossierName = 'Sans dossier';
      if (dossierId) {
        try {
          const dosRes = await fetch(`https://api.notion.com/v1/pages/${dossierId}`, {
            headers: notionHeaders()
          });
          if (dosRes.ok) {
            const dosPage = await dosRes.json();
            dossierName = dosPage.properties['Nom du dossier']?.title?.[0]?.text?.content || 'Sans nom';
          }
        } catch {}
      }

      // Récupérer les tâches liées au projet
      let tasks = [];
      try {
        const taskRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
          method: 'POST',
          headers: notionHeaders(),
          body: JSON.stringify({
            filter: {
              and: [
                { property: 'Projet', relation: { contains: projId } },
                { property: 'Statut', checkbox: { equals: false } }
              ]
            },
            page_size: 20
          })
        });
        if (taskRes.ok) {
          const taskData = await taskRes.json();
          tasks = taskData.results.map(t => ({
            id: t.id,
            name: t.properties['Tâche']?.title?.[0]?.text?.content || 'Sans titre'
          }));
        }
      } catch {}

      const key = dossierId || 'no-dossier-' + projId;
      if (!dossierMap.has(key)) {
        dossierMap.set(key, { name: dossierName, dossierId, projects: [] });
      }
      dossierMap.get(key).projects.push({ projName, projId, tasks });
    }

    // 3. Formater le rapport
    const emoji = category === 'Lead' ? '💰' : category === 'Sinistre' ? '🚨' : '📋';
    reportText = `${emoji} *${category.toUpperCase()}S EN COURS (${projects.length})*\n\n`;

    for (const [key, dossier] of dossierMap) {
      reportText += `${dossierIndex}️⃣ 📁 *${dossier.name}*\n`;

      const item = {
        index: dossierIndex,
        dossierName: dossier.name,
        dossierId: dossier.dossierId,
        projects: []
      };

      for (const proj of dossier.projects) {
        reportText += `   └ ${proj.projName}\n`;
        const projItem = {
          projName: proj.projName,
          projId: proj.projId,
          tasks: []
        };

        for (const task of proj.tasks) {
          reportText += `     ☐ ${task.name}\n`;
          projItem.tasks.push({ taskId: task.id, taskName: task.name });
        }

        if (proj.tasks.length === 0) {
          reportText += `     _Aucune tâche ouverte_\n`;
        }

        item.projects.push(projItem);
      }

      items.push(item);
      dossierIndex++;
      reportText += '\n';
    }

    reportText += `→ _Réponds un numéro pour agir sur un dossier_`;

    return { success: true, text: reportText, items };

  } catch (error) {
    console.error('❌ Erreur getCategoryReport:', error.message);
    return { success: false, message: error.message };
  }
}

// --- OUTIL 10 : RAPPORT QUOTIDIEN ---
export async function getDailyReport() {
  console.log('📊 Génération rapport quotidien...');

  try {
    // Début de la journée en UTC
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // 1. Projets créés aujourd'hui
    let projetsCreated = [];
    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
        method: 'POST',
        headers: notionHeaders(),
        body: JSON.stringify({
          filter: { timestamp: 'created_time', created_time: { on_or_after: todayISO } },
          page_size: 50
        })
      });
      if (res.ok) {
        const data = await res.json();
        projetsCreated = data.results.map(p => p.properties['Name']?.title?.[0]?.text?.content || 'Sans nom');
      }
    } catch {}

    // 2. Tâches créées aujourd'hui
    let tachesCreated = [];
    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
        method: 'POST',
        headers: notionHeaders(),
        body: JSON.stringify({
          filter: { timestamp: 'created_time', created_time: { on_or_after: todayISO } },
          page_size: 50
        })
      });
      if (res.ok) {
        const data = await res.json();
        tachesCreated = data.results.map(t => t.properties['Tâche']?.title?.[0]?.text?.content || 'Sans titre');
      }
    } catch {}

    // 3. Tâches terminées aujourd'hui (cochées aujourd'hui)
    let tachesDone = [];
    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
        method: 'POST',
        headers: notionHeaders(),
        body: JSON.stringify({
          filter: {
            and: [
              { property: 'Statut', checkbox: { equals: true } },
              { timestamp: 'last_edited_time', last_edited_time: { on_or_after: todayISO } }
            ]
          },
          page_size: 50
        })
      });
      if (res.ok) {
        const data = await res.json();
        tachesDone = data.results.map(t => t.properties['Tâche']?.title?.[0]?.text?.content || 'Sans titre');
      }
    } catch {}

    // Formater
    const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let text = `📊 *RAPPORT DU ${dateStr.toUpperCase()}*\n\n`;

    text += `📦 *Projets créés :* ${projetsCreated.length}\n`;
    for (const p of projetsCreated) { text += `  • ${p}\n`; }
    if (projetsCreated.length === 0) text += `  _Aucun_\n`;

    text += `\n✅ *Tâches terminées :* ${tachesDone.length}\n`;
    for (const t of tachesDone) { text += `  • ${t}\n`; }
    if (tachesDone.length === 0) text += `  _Aucune_\n`;

    text += `\n📋 *Tâches créées :* ${tachesCreated.length}\n`;
    for (const t of tachesCreated) { text += `  • ${t}\n`; }
    if (tachesCreated.length === 0) text += `  _Aucune_\n`;

    return { success: true, text };

  } catch (error) {
    console.error('❌ Erreur getDailyReport:', error.message);
    return { success: false, message: error.message };
  }
}

// --- OUTIL 11 : MARQUER TÂCHE COMME FAITE ---
export async function completeTaskById(taskId) {
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
      method: 'PATCH',
      headers: notionHeaders(),
      body: JSON.stringify({
        properties: { 'Statut': { checkbox: true } }
      })
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, message: err.message };
    }

    const page = await res.json();
    const taskName = page.properties['Tâche']?.title?.[0]?.text?.content || 'Tâche';
    return { success: true, taskName };

  } catch (error) {
    return { success: false, message: error.message };
  }
}

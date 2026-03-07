import { NextResponse } from 'next/server';
import { NOTION_TASKS_DB_ID, NOTION_PROJECTS_DB_ID, NOTION_CONTRACTS_DB_ID, NOTION_CONTACTS_DB_ID, notionHeaders } from '@/lib/notion-config';
import { getNotionCache, setNotionCache, findJidByNotionContactId } from '@/lib/database';

async function fetchPage(pageId) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers: notionHeaders() });
  if (!res.ok) return null;
  return res.json();
}

async function fetchProjects(dossierId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: { property: '💬 Dossiers', relation: { contains: dossierId } },
      sorts: [{ property: 'Dates', direction: 'descending' }],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return data.results.map(p => ({
    id: p.id,
    name: p.properties['Name']?.title?.[0]?.plain_text || 'Sans nom',
    type: p.properties['Type']?.select?.name || '',
    productType: p.properties['Type de projet']?.select?.name || '',
    niveau: p.properties['Niveau du Projet']?.status?.name || p.properties['Niveau du Projet']?.select?.name || '',
    priority: p.properties['Priorité']?.select?.name || '',
    done: p.properties['Terminé']?.checkbox || false,
    createdAt: p.created_time,
    url: p.url,
  }));
}

async function fetchTasks(dossierId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: { property: '💬 Dossiers', relation: { contains: dossierId } },
      sorts: [{ property: 'Date', direction: 'ascending' }],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return data.results.map(t => ({
    id: t.id,
    name: t.properties['Tâche']?.title?.[0]?.plain_text || 'Sans nom',
    status: t.properties['Statut']?.status?.name || t.properties['Statut']?.select?.name || '',
    priority: t.properties['Priorité']?.select?.name || '',
    date: t.properties['Date']?.date?.start || null,
    projectId: t.properties['Projet']?.relation?.[0]?.id || null,
    url: t.url,
  }));
}

async function fetchContacts(dossierId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONTACTS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: { property: '💬 Dossier', relation: { contains: dossierId } },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return data.results.map(c => ({
    id: c.id,
    name: c.properties['Nom_Prénom']?.title?.[0]?.plain_text || 'Sans nom',
    phone: c.properties['*Téléphone']?.phone_number || '',
    email: c.properties['*E-mail']?.email || '',
    statut: (c.properties['Statut contact']?.multi_select || []).map(s => s.name),
    url: c.url,
  }));
}

async function fetchContracts(dossierId) {
  if (!NOTION_CONTRACTS_DB_ID) return [];
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONTRACTS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: { property: 'Dossiers', relation: { contains: dossierId } },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return data.results.map(c => {
    const statutFormula = c.properties['Statut']?.formula;
    let status = '';
    if (statutFormula) {
      status = statutFormula.string || statutFormula.number?.toString() || '';
    }
    const detailsRt = c.properties['détails du contrat']?.rich_text || [];
    const details = detailsRt.map(rt => rt.plain_text).join('');
    return {
      id: c.id,
      name: c.properties['🏆 Numero du contrat']?.title?.[0]?.plain_text || 'Sans numéro',
      productType: c.properties['Type Assurance']?.select?.name || '',
      type_assurance: c.properties['Type Assurance']?.select?.name || null,
      cie_details: c.properties['ID Contrat/CIE']?.rich_text?.[0]?.plain_text || null,
      status,
      dateEffet: c.properties['Date d\'effet']?.date?.start || null,
      dateSignature: c.properties['# Date de signature']?.date?.start || null,
      dateResiliation: c.properties['Date de resilitation']?.date?.start || null,
      desactive: c.properties['Desactivé']?.checkbox || false,
      details,
      url: c.url,
    };
  });
}

async function fetchAndBuildResponse(dossierId) {
  const dossier = await fetchPage(dossierId);
  if (!dossier) return null;

  const props = dossier.properties;

  // Extraction du nom : priorité Nom du dossier, sinon extraction depuis l'URL
  let dossierName = props['Nom du dossier']?.title?.[0]?.plain_text || '';
  // Si le nom est vide ou juste un emoji, extraire depuis l'URL
  if (!dossierName || dossierName.length <= 3 || /^[\p{Emoji}\s]+$/u.test(dossierName)) {
    // URL format: https://www.notion.so/NOM-DU-DOSSIER-pageid
    const urlMatch = dossier.url?.match(/notion\.so\/([^-]+-[^-]+(?:-[^-]+)*)-[a-f0-9]{32}/i);
    if (urlMatch) {
      dossierName = urlMatch[1].replace(/-/g, ' ');
    } else {
      dossierName = 'Sans nom';
    }
  }

  const dossierInfo = {
    id: dossier.id,
    identifiant: props['Identifiant']?.unique_id ? `DOS-${props['Identifiant'].unique_id.number}` : (props['Identifiant']?.rich_text?.[0]?.plain_text || props['Identifiant']?.title?.[0]?.plain_text || ''),
    name: dossierName,
    driveUrl: props['Google drive']?.url || null,
    geminiUrl: props['Gemini GPT']?.url || props['Gemini CHAT']?.url || null,
    category: props['Cat Client']?.select?.name || '',
    createdAt: dossier.created_time,
    url: dossier.url,
  };

  const [projects, tasks, contacts] = await Promise.all([
    fetchProjects(dossierId),
    fetchTasks(dossierId),
    fetchContacts(dossierId),
  ]);

  const contracts = await fetchContracts(dossierId);

  const activeProjects = projects.filter(p => !p.done);
  const doneProjects = projects.filter(p => p.done);

  const tasksByProject = {};
  const orphanTasks = [];

  for (const task of tasks) {
    if (task.projectId) {
      if (!tasksByProject[task.projectId]) tasksByProject[task.projectId] = [];
      tasksByProject[task.projectId].push(task);
    } else {
      orphanTasks.push(task);
    }
  }

  const projectsWithTasks = activeProjects.map(p => ({
    ...p,
    tasks: tasksByProject[p.id] || [],
  }));

  const stats = {
    activeProjects: activeProjects.length,
    doneProjects: doneProjects.length,
    pendingTasks: tasks.filter(t => !['Terminé', 'Done', 'Fait'].includes(t.status)).length,
    contacts: contacts.length,
    contracts: contracts.length,
  };

  // Siblings = all contacts linked to this dossier, with WhatsApp JID if available
  const siblings = contacts.map(ct => {
    const jid = findJidByNotionContactId(ct.id);
    return { id: ct.id, name: ct.name, url: ct.url, jid, has_whatsapp: !!jid };
  });

  return {
    dossier: dossierInfo,
    contracts,
    projects: projectsWithTasks,
    doneProjects,
    orphanTasks,
    contacts,
    siblings,
    stats,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dossierId = searchParams.get('dossierId');
    const cached = searchParams.get('cached') === 'true';
    const refresh = searchParams.get('refresh') === 'true';

    if (!dossierId) {
      return NextResponse.json({ error: 'dossierId required' }, { status: 400 });
    }

    // If cached=true, return cache immediately if available
    if (cached && !refresh) {
      const cache = getNotionCache(dossierId);
      if (cache) {
        return NextResponse.json({ ...cache.data, fromCache: true, isStale: cache.isStale });
      }
    }

    // Fetch from Notion
    const data = await fetchAndBuildResponse(dossierId);
    if (!data) {
      return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });
    }

    // Update cache
    setNotionCache(dossierId, data);

    return NextResponse.json({ ...data, fromCache: false });
  } catch (error) {
    console.error('Dossier details error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

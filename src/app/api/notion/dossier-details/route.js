import { NextResponse } from 'next/server';
import { getLocalDossierById, getLocalProjects, getLocalTasks, getLocalContacts, getLocalContractsByDossier, findJidByNotionContactId } from '@/lib/database';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dossierId = searchParams.get('dossierId');

    if (!dossierId) {
      return NextResponse.json({ error: 'dossierId required' }, { status: 400 });
    }

    const dossier = getLocalDossierById(dossierId);
    if (!dossier) {
      return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });
    }

    const dossierInfo = {
      id: dossier.id,
      identifiant: '',
      name: dossier.name || 'Sans nom',
      driveUrl: dossier.drive_url || null,
      geminiUrl: dossier.gemini_url || null,
      claudeUrl: dossier.claude_url || null,
      category: '',
      createdAt: dossier.updated_at ? new Date(dossier.updated_at).toISOString() : null,
      url: dossier.url || null,
    };

    const projects = getLocalProjects({ dossier_id: dossierId }).map(p => ({
      id: p.id,
      name: p.name || 'Sans nom',
      type: p.type || '',
      productType: '',
      niveau: p.level || '',
      priority: p.priority || '',
      done: p.completed === 1,
      createdAt: p.created_at ? new Date(p.created_at).toISOString() : null,
      url: p.url || null,
    }));

    const tasks = getLocalTasks({ dossier_id: dossierId }).map(t => ({
      id: t.id,
      name: t.name || 'Sans nom',
      status: t.completed ? 'Terminé' : '',
      priority: '',
      date: t.date || null,
      projectId: t.project_id || null,
      url: t.url || null,
    }));

    const contacts = getLocalContacts({ dossier_id: dossierId }).map(c => ({
      id: c.id,
      name: c.name || 'Sans nom',
      phone: c.phone || '',
      email: c.email || '',
      statut: c.status ? c.status.split(', ').filter(Boolean) : [],
      url: c.url || null,
    }));

    const contracts = getLocalContractsByDossier(dossierId).map(c => ({
      id: c.id,
      name: c.name || 'Sans numéro',
      productType: c.product_type || '',
      type_assurance: c.type_assurance || null,
      cie_details: c.cie_details || null,
      status: '',
      dateEffet: c.date_effet || null,
      dateSignature: c.date_signature || null,
      dateResiliation: c.date_resiliation || null,
      desactive: c.desactive === 1,
      details: c.details || '',
      url: c.url || null,
    }));

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
      totalTasks: tasks.length,
    };

    // Siblings = all contacts linked to this dossier, with WhatsApp JID if available
    const siblings = contacts.map(ct => {
      const jid = findJidByNotionContactId(ct.id);
      return { id: ct.id, name: ct.name, url: ct.url, jid, has_whatsapp: !!jid };
    });

    return NextResponse.json({
      dossier: dossierInfo,
      contracts,
      projects: projectsWithTasks,
      projectsWithTasks,
      doneProjects,
      orphanTasks,
      contacts,
      siblings,
      stats,
      fromCache: false,
    });
  } catch (error) {
    console.error('Dossier details error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

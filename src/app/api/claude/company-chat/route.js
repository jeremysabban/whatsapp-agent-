import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { searchDossierEmails } from '@/lib/gmail-client';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company');
    const daysBack = parseInt(searchParams.get('days') || '90', 10);
    if (!company || company.length < 2) return NextResponse.json({ error: 'company required (min 2 chars)' }, { status: 400 });

    const db = getDb();

    const contracts = db.prepare(
      `SELECT name, type_assurance, cie_details, date_effet, date_resiliation, desactive, dossier_id
       FROM contracts WHERE cie_details LIKE ? OR compagnie_name LIKE ? ORDER BY date_effet DESC`
    ).all(`%${company}%`, `%${company}%`);

    const dossierIds = [...new Set(contracts.map(c => c.dossier_id).filter(Boolean))];
    const dossiers = dossierIds.length
      ? db.prepare(`SELECT id, name FROM dossiers WHERE id IN (${dossierIds.map(() => '?').join(',')})`)
          .all(...dossierIds)
      : [];
    const dossierMap = Object.fromEntries(dossiers.map(d => [d.id, d.name]));

    const brokerCodes = db.prepare(
      `SELECT code, company_name FROM broker_codes WHERE company_name LIKE ?`
    ).all(`%${company}%`);

    const gmailQueries = [
      `"${company}"`,
      ...contracts.slice(0, 10).map(c => c.name).filter(n => n && n.length > 3),
    ];

    let emails = [];
    try {
      emails = await searchDossierEmails(gmailQueries, 30, daysBack);
    } catch {}

    const emailLines = emails.map(e => `${e.dateStr} ${e.direction} ${e.peer} | ${e.subject}`);

    const activeContracts = contracts.filter(c => !c.desactive);
    const resilie = contracts.filter(c => c.desactive);

    const contractLines = activeContracts.slice(0, 30).map(c =>
      `- ${c.name} · ${c.type_assurance || '?'} · ${dossierMap[c.dossier_id] || '?'} · effet ${c.date_effet || '?'}`
    );
    const resilieLines = resilie.slice(0, 10).map(c =>
      `- ${c.name} · ${c.type_assurance || '?'} · ${dossierMap[c.dossier_id] || '?'} · resilie ${c.date_resiliation || '?'}`
    );

    const codeLines = brokerCodes.map(c => `- Code ${c.code} (${c.company_name})`);

    const prompt = [
      `ANALYSE COMPAGNIE : ${company.toUpperCase()}`,
      '',
      `CODES COURTIER :`,
      codeLines.length ? codeLines.join('\n') : '- Aucun code trouve',
      '',
      `CONTRATS ACTIFS (${activeContracts.length}) :`,
      contractLines.length ? contractLines.join('\n') : '- Aucun',
      '',
      resilie.length ? `CONTRATS RESILIES (${resilie.length}) :\n${resilieLines.join('\n')}` : '',
      '',
      `DOSSIERS CONCERNES : ${dossiers.map(d => d.name).join(', ') || 'aucun'}`,
      '',
      `HISTORIQUE EMAILS (${daysBack}j, ${emails.length} resultats) :`,
      emailLines.length ? emailLines.join('\n') : 'Aucun email trouve.',
      '',
      `Analyse la relation avec ${company} : volume du portefeuille, sinistres recents, relances en cours, emails en attente de reponse. Resume les actions a mener.`,
      '',
      'MA QUESTION :',
      '[tape ici]',
    ].filter(Boolean).join('\n');

    const claudeUrl = `https://claude.ai/project/019d9645-7417-7277-82d4-6c4cd55973af?q=${encodeURIComponent(prompt)}`;

    return NextResponse.json({
      company,
      activeContracts: activeContracts.length,
      resilieContracts: resilie.length,
      dossiers: dossiers.length,
      emails: emails.length,
      brokerCodes: brokerCodes.length,
      claudeUrl,
      prompt,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

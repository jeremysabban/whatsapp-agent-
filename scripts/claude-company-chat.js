#!/usr/bin/env node

const company = process.argv[2];
const days = parseInt(process.argv[3] || '90', 10);

if (!company) {
  console.log('Usage: node scripts/claude-company-chat.js <compagnie> [jours]');
  console.log('Exemples:');
  console.log('  node scripts/claude-company-chat.js Generali');
  console.log('  node scripts/claude-company-chat.js Henner 180');
  console.log('  node scripts/claude-company-chat.js "Abeille" 30');
  console.log('\nCompagnies dans le portefeuille:');

  const path = require('path');
  const Database = require('better-sqlite3');
  const db = new Database(path.join(__dirname, '..', 'data', 'whatsapp-agent.db'));
  const companies = db.prepare(
    `SELECT compagnie_name, COUNT(*) as nb, SUM(CASE WHEN desactive=0 THEN 1 ELSE 0 END) as actifs
     FROM contracts WHERE compagnie_name IS NOT NULL GROUP BY compagnie_name ORDER BY nb DESC`
  ).all();
  companies.forEach(c => console.log(`  ${c.compagnie_name} (${c.actifs} actifs / ${c.nb} total)`));
  db.close();
  process.exit(0);
}

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const url = `${BASE}/api/claude/company-chat?company=${encodeURIComponent(company)}&days=${days}`;

console.log(`\nRecherche : ${company} (${days} jours)...\n`);

fetch(url)
  .then(r => r.json())
  .then(d => {
    if (d.error) { console.error('Erreur:', d.error); process.exit(1); }
    console.log(`Contrats actifs : ${d.activeContracts}`);
    console.log(`Contrats resilies : ${d.resilieContracts}`);
    console.log(`Dossiers concernes : ${d.dossiers}`);
    console.log(`Emails trouves : ${d.emails}`);
    console.log(`Codes courtier : ${d.brokerCodes}`);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(d.prompt);
    console.log(`${'─'.repeat(60)}\n`);
    console.log(`URL Claude :\n${d.claudeUrl}\n`);
  })
  .catch(e => { console.error('Erreur:', e.message); process.exit(1); });

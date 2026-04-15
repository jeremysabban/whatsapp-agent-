#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'whatsapp-agent.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Load subscriptions
const subscriptions = db.prepare('SELECT * FROM subscriptions').all();

function parseFR(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\s/g, '').replace(',', '.')) || 0;
}

const tagFor = (nature) => (nature === 'PERSO' ? 'PERSO' : 'CHARGE');

function classify(rawDetail, type, subtype) {
  const d = (rawDetail || '').toUpperCase();
  const t = (type || '').trim().toUpperCase();
  const r = (nature, category) => [nature, category, tagFor(nature)];
  if (d.includes('AL HOLDING') || d.includes('ALHOLDING')) return r('HORS_EXPL', 'Remboursement dette AL Holding');
  if (d.includes('SABBAN')) return r('PRO', 'Salaires');
  if (d.includes('SDC 190 BD BINEAU') || d.includes('SDC 190 BINEAU')) return r('PRO', 'Loyer pro');
  if (d.includes('LUMAY') || d.includes('LUMA AVOCAT')) return r('PRO', 'Honoraires');
  if (d.includes('KODSI') || d.includes('SARINA') || d.includes('COACHING')) return r('PRO', 'Coaching');
  if (d.includes('HENNER')) return r('PRO', 'Mutuelle');
  if (d.includes('AIG - FRANCE') || d.includes('AIG FRANCE') || d.includes('AIG-FRANCE')) return r('PRO', 'Assurance Pro');
  if (d.includes('ZOUARI')) return r('PRO', 'Rbt exceptionnel client');
  if (/CLAUDE\.AI|ANTHROPIC|NOTION|USENOTION|LEMSQZY|NOTEFORMS|APPLE\.COM|ADOBE|OPENAI|CHATGPT|ECILIA/.test(d)) return r('PRO', 'Logiciels');
  if (d.includes('BOUYGUES') || d.includes('FREE TELECOM') || d.includes('FREE MOBILE')) return r('PRO', 'Telecom');
  if (/GOOGLE WORKSPAC|GANDI|CONTABO/.test(d)) return r('PRO', 'IT / Hébergement');
  if (d.includes('DIGIDOM')) return r('PRO', 'Domiciliation');
  if (d.includes('CNCEF') || d.includes('AM&JT') || d.includes('AMJT')) return r('PRO', 'Formation');
  if (d.includes('ORIAS') || d.includes('INFOGREFFE')) return r('PRO', 'Réglementation');
  if (t === 'COMMISSIONS' || d.includes('COMMISSIONS FACTURE') || d.includes('COMMISSION INTERVENT')) return r('PRO', 'Frais bancaires');
  if (d.includes('AMAZON') || d.includes('AMZ DIGITAL') || d.includes('AMZN ')) return r('PERSO', 'Amazon');
  if (/CONSISTOIRE|ALLODONS|JUDAIC|CHARIDY|TZEDAKA/.test(d)) return r('PERSO', 'Dons');
  const ALIM = ['FRANPRIX','CARREFOUR','CARREF','PICARD','MONOP','ALDI','POINCARE DISTRI','CHANTHI','BDB ','AFRIKA','BUDDIE','92 DISTRIB','YBRY KASH','KAYSER','BOULANGERIE','CHEZ MEUNIER','BEKEF','MISSADA','B.L.S','STARBUCKS','CHINA LEE','CHARLES ET DAN','GABRIEL PARIS','MAISON GABRIEL','LE VERGER','ABRAHAM','SHINZZO','PHARMACIE','LAPOSTE','TABAC','TALIROULE','MF00','VILLENEUVE LA','SUSHI','KOSHER'];
  if (ALIM.some(k => d.includes(k))) return r('PERSO', 'Alimentation & vie courante');
  const SHOP = ['UNIQLO','FNAC','JRMC','BEAUX TITRE','TEMU','PAYPAL','JIUHAOK','ZARA','H&M'];
  if (SHOP.some(k => d.includes(k))) return r('PERSO', 'Shopping');
  const AUTO = ['COFIROUTE','AREAS','ASF ','TOTAL ','SARGE LES','PARK FOCH','MINIT','RELAIS ST BRICE','ESSENCE','STATION ESSO','SHELL','BP FRANCE'];
  if (AUTO.some(k => d.includes(k))) return r('PERSO', 'Auto / Déplacements');
  if (d.includes('DISNEY') || d.includes('UBER')) return r('PERSO', 'Divers perso');
  return r('PERSO', 'Divers perso');
}

function extractShortLabel(rawDetail, type, subtype) {
  const d = rawDetail;
  // FACTURE CARTE
  const cbMatch = d.match(/FACTURE CARTE DU \d{6} (.+?) CARTE/);
  if (cbMatch) return cbMatch[1].trim();
  // VIR SEPA
  const virMatch = d.match(/\/FRM\s+(.+?)\s+\/(?:EID|RNF)/);
  if (virMatch) return virMatch[1].trim();
  // PRLV SEPA
  const prvMatch = d.match(/PRLV SEPA (.+?)(?:\s+\/|$)/);
  if (prvMatch) return prvMatch[1].trim().slice(0, 50);
  // Fallback
  return (subtype || type || d).slice(0, 60).trim();
}

function toISODate(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const [d, m, y] = ddmmyyyy.split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m}-${d}`;
}

// Find CSV files
const CSV_DIR = path.join(__dirname, '..', 'bordereaux', 'releve-bancaire');
let csvFiles = [];
if (fs.existsSync(CSV_DIR)) {
  csvFiles = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv')).map(f => path.join(CSV_DIR, f));
}
// Also check data/bank/
const BANK_DIR = path.join(__dirname, '..', 'data', 'bank');
if (fs.existsSync(BANK_DIR)) {
  csvFiles.push(...fs.readdirSync(BANK_DIR).filter(f => f.endsWith('.csv')).map(f => path.join(BANK_DIR, f)));
}

if (csvFiles.length === 0) {
  console.log('No CSV files found in bordereaux/releve-bancaire/ or data/bank/');
  process.exit(0);
}

const insert = db.prepare(`INSERT OR IGNORE INTO bank_outflows
  (date, bank_account, type, subtype, raw_detail, short_label, amount, nature, category, subscription_id, tag, user_overridden)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`);

let imported = 0, skipped = 0, unclassified = 0;

for (const csvPath of csvFiles) {
  const filename = path.basename(csvPath);
  const accountMatch = filename.match(/(\d{4})/);
  const bankAccount = accountMatch ? accountMatch[1] : '';

  let content;
  try {
    content = fs.readFileSync(csvPath, 'utf-8');
    if (content.includes('\ufffd')) content = fs.readFileSync(csvPath, 'latin1');
  } catch { content = fs.readFileSync(csvPath, 'latin1'); }

  const lines = content.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(';');
    if (cols.length < 6) continue;

    const amount = parseFR(cols[5]);
    if (amount >= 0) continue; // Only outflows

    const date = toISODate(cols[0].trim());
    if (!date) continue;
    const type = cols[1].trim();
    const subtype = cols[2].trim();
    const rawDetail = cols[3].trim();
    const shortLabel = extractShortLabel(rawDetail, type, subtype);

    // Match subscription
    const rawUpper = rawDetail.toUpperCase();
    let subId = null, nature, category, tag;
    const matchedSub = subscriptions.find(s => rawUpper.includes(s.match_pattern.toUpperCase()));
    if (matchedSub) {
      subId = matchedSub.id;
      nature = matchedSub.nature;
      category = matchedSub.category;
      tag = tagFor(nature);
    } else {
      [nature, category, tag] = classify(rawDetail, type, subtype);
    }

    if (category === 'Divers perso') unclassified++;

    const result = insert.run(date, bankAccount, type, subtype, rawDetail, shortLabel, amount, nature, category, subId, tag);
    if (result.changes > 0) imported++;
    else skipped++;
  }
}

console.log(`Imported: ${imported} | Skipped: ${skipped} | Unclassified: ${unclassified}`);
console.log(`Total outflows in DB: ${db.prepare('SELECT COUNT(*) as c FROM bank_outflows').get().c}`);
db.close();

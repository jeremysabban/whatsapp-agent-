#!/usr/bin/env node
const path = require('path');
const Database = require('better-sqlite3');

// Import classify - since it's ESM, we inline it here
const tagFor = (nature) => (nature === 'PERSO' ? 'PERSO' : 'CHARGE');

function classify(rawDetail, type, subtype) {
  const d = (rawDetail || '').toUpperCase();
  const t = (type || '').trim().toUpperCase();
  const r = (nature, category) => [nature, category, tagFor(nature)];
  if (d.includes('AL HOLDING') || d.includes('ALHOLDING')) return r('HORS_EXPL', 'Remboursement dette AL Holding');
  if (d.includes('SABBAN')) return r('PERSO', 'Salaires');
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

const db = new Database(path.join(__dirname, '..', 'data', 'whatsapp-agent.db'));
db.pragma('journal_mode = WAL');

// Match subscriptions first
const subs = db.prepare('SELECT * FROM subscriptions').all();

// Load finance_tags (dynamic, user-managed). Fallback empty if table missing.
let financeTags = [];
try { financeTags = db.prepare('SELECT id, pattern, position FROM finance_tags ORDER BY position ASC').all(); } catch {}

function matchTagId(rawDetail) {
  const d = (rawDetail || '').toUpperCase();
  for (const t of financeTags) {
    if (!t.pattern) continue;
    try { if (new RegExp(t.pattern, 'i').test(d)) return t.id; }
    catch { if (d.includes(t.pattern.toUpperCase())) return t.id; }
  }
  return 'autre';
}

// tag is re-applied from patterns (even on user_overridden rows, since former CHARGE/PERSO has no meaning)
const rows = db.prepare('SELECT id, raw_detail, type, subtype, subscription_id, user_overridden FROM bank_outflows').all();
const updAll = db.prepare('UPDATE bank_outflows SET nature = ?, category = ?, subscription_id = ?, tag = ? WHERE id = ?');
const updTagOnly = db.prepare('UPDATE bank_outflows SET tag = ? WHERE id = ?');

let n = 0, nTagOnly = 0;
for (const r of rows) {
  const newTag = matchTagId(r.raw_detail);
  if (r.user_overridden) {
    updTagOnly.run(newTag, r.id);
    nTagOnly++;
    continue;
  }
  const rawUpper = (r.raw_detail || '').toUpperCase();
  const matchedSub = subs.find(s => rawUpper.includes(s.match_pattern.toUpperCase()));
  let nature, category, subId;
  if (matchedSub) {
    nature = matchedSub.nature;
    category = matchedSub.category;
    subId = matchedSub.id;
  } else {
    [nature, category] = classify(r.raw_detail, r.type, r.subtype);
    subId = null;
  }
  updAll.run(nature, category, subId, newTag, r.id);
  n++;
}

// Stats
const statsNat = db.prepare(`SELECT nature, COUNT(*) as count, ROUND(SUM(amount), 2) as total FROM bank_outflows GROUP BY nature`).all();
const statsTag = db.prepare(`SELECT tag, COUNT(*) as count, ROUND(SUM(amount), 2) as total FROM bank_outflows GROUP BY tag ORDER BY total ASC`).all();
console.log(`Re-classified ${n} outflows (+${nTagOnly} tag-only on overridden rows)`);
statsNat.forEach(s => console.log(`  [nature] ${s.nature}: ${s.count} ops, ${s.total} €`));
statsTag.forEach(s => console.log(`  [tag]    ${s.tag}: ${s.count} ops, ${s.total} €`));

db.close();

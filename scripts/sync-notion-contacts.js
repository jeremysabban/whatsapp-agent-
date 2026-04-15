require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Client } = require('@notionhq/client');
const Database = require('better-sqlite3');
const path = require('path');

const NOTION_API_KEY = process.env.NOTION_API_KEY || process.env.NOTION_KEY;
const CONTACTS_DB_ID = process.env.NOTION_CONTACTS_DB_ID || 'c812f778-cd65-413f-8feb-5cbc4fbb5dd8';
const DOSSIERS_DB_ID = process.env.NOTION_DOSSIERS_DB_ID || '8f32e57f-ff6a-4d26-b5ab-502142e8f8d6';

if (!NOTION_API_KEY) {
  console.error('❌ NOTION_API_KEY manquant dans .env.local');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });
const db = new Database(path.join(__dirname, '..', 'data', 'whatsapp-agent.db'));

function normalizePhone(phone) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = '33' + digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits;
}

function formatPhoneForNotion(phone) {
  // Format: +33 6 12 34 56 78
  if (!phone) return null;
  const digits = normalizePhone(phone);
  if (digits.length === 11 && digits.startsWith('33')) {
    return '+' + digits.slice(0,2) + ' ' + digits.slice(2,3) + ' ' + digits.slice(3,5) + ' ' + digits.slice(5,7) + ' ' + digits.slice(7,9) + ' ' + digits.slice(9);
  }
  return '+' + digits;
}

async function getDossierInfo(dossierId) {
  try {
    const page = await notion.pages.retrieve({ page_id: dossierId });
    const props = page.properties;
    const title = props['Nom du dossier']?.title?.[0]?.plain_text
      || props['Name']?.title?.[0]?.plain_text
      || props['Nom']?.title?.[0]?.plain_text
      || props['Titre']?.title?.[0]?.plain_text;
    return { id: dossierId, name: title || 'Dossier', url: page.url };
  } catch (e) {
    return null;
  }
}

async function fetchNotionContacts() {
  const contacts = [];
  let cursor;
  do {
    const response = await notion.databases.query({
      database_id: CONTACTS_DB_ID,
      start_cursor: cursor,
      page_size: 100,
      filter: { property: '*Téléphone', phone_number: { is_not_empty: true } }
    });
    for (const page of response.results) {
      const name = page.properties['Nom_Prénom']?.title?.[0]?.plain_text;
      const phone = page.properties['*Téléphone']?.phone_number;
      const dossierRelation = page.properties['💬 Dossier']?.relation;
      if (name && phone) {
        let dossier = null;
        if (dossierRelation?.length > 0) dossier = await getDossierInfo(dossierRelation[0].id);
        contacts.push({ name, phone: normalizePhone(phone), contactId: page.id, contactUrl: page.url, dossier });
      }
    }
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);
  return contacts;
}

async function createNotionContact(name, phone, dossierId) {
  const properties = {
    'Nom_Prénom': { title: [{ text: { content: name } }] },
    '*Téléphone': { phone_number: formatPhoneForNotion(phone) },
    'Statut contact': { multi_select: [{ name: 'Client' }] },
    'Whatsapp': { checkbox: true }
  };
  if (dossierId) {
    properties['💬 Dossier'] = { relation: [{ id: dossierId }] };
  }
  const page = await notion.pages.create({
    parent: { database_id: CONTACTS_DB_ID },
    properties
  });
  console.log('📝 Contact Notion créé: ' + name + ' (' + phone + ')');
  return { id: page.id, url: page.url };
}

async function syncNotionToWhatsApp() {
  console.log('\n=== NOTION → WHATSAPP ===');
  const notionContacts = await fetchNotionContacts();
  console.log('Found ' + notionContacts.length + ' contacts Notion avec téléphone');

  const waConversations = db.prepare('SELECT jid, name FROM conversations').all();
  const phoneToNotion = {};
  for (const c of notionContacts) if (c.phone) phoneToNotion[c.phone] = c;

  let updatedName = 0, linkedDossier = 0;
  const updateAll = db.prepare('UPDATE conversations SET name = ?, avatar_initials = ?, notion_dossier_id = ?, notion_dossier_name = ?, notion_dossier_url = ?, updated_at = ? WHERE jid = ?');
  const updateDossier = db.prepare('UPDATE conversations SET notion_dossier_id = ?, notion_dossier_name = ?, notion_dossier_url = ?, updated_at = ? WHERE jid = ?');

  for (const wa of waConversations) {
    const waPhone = wa.jid.split('@')[0];
    const nc = phoneToNotion[waPhone];
    if (nc) {
      const initials = nc.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      if (!wa.name || wa.name.match(/^\+?\d{6,}$/) || wa.name === 'Inconnu') {
        updateAll.run(nc.name, initials, nc.dossier?.id || null, nc.dossier?.name || null, nc.dossier?.url || null, Date.now(), wa.jid);
        console.log('✓ ' + waPhone + ' -> ' + nc.name + (nc.dossier ? ' (📁 ' + nc.dossier.name + ')' : ''));
        updatedName++;
        if (nc.dossier) linkedDossier++;
      } else if (nc.dossier) {
        updateDossier.run(nc.dossier.id, nc.dossier.name, nc.dossier.url, Date.now(), wa.jid);
        console.log('🔗 ' + wa.name + ' -> 📁 ' + nc.dossier.name);
        linkedDossier++;
      }
    }
  }
  console.log('Noms mis à jour: ' + updatedName + ', Dossiers liés: ' + linkedDossier);
}

async function syncWhatsAppToNotion() {
  console.log('\n=== WHATSAPP → NOTION ===');
  const notionContacts = await fetchNotionContacts();
  const notionPhones = new Set(notionContacts.map(c => c.phone));

  // Get WA conversations with dossier linked but no Notion contact
  const waWithDossier = db.prepare(`
    SELECT jid, name, notion_dossier_id, notion_dossier_name
    FROM conversations
    WHERE notion_dossier_id IS NOT NULL
    AND name IS NOT NULL
    AND name != 'Inconnu'
    AND name NOT GLOB '[0-9]*'
  `).all();

  let created = 0;
  for (const wa of waWithDossier) {
    const waPhone = wa.jid.split('@')[0];
    if (!notionPhones.has(waPhone)) {
      try {
        await createNotionContact(wa.name, waPhone, wa.notion_dossier_id);
        created++;
      } catch (e) {
        console.log('⚠️ Erreur création contact ' + wa.name + ': ' + e.message);
      }
    }
  }
  console.log('Contacts Notion créés: ' + created);
}

async function sync() {
  await syncNotionToWhatsApp();
  await syncWhatsAppToNotion();
  console.log('\n✅ Sync terminé!');
}

module.exports = { createNotionContact, getDossierInfo, normalizePhone, NOTION_API_KEY, CONTACTS_DB_ID, DOSSIERS_DB_ID };

sync().catch(console.error);

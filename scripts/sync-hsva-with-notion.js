const Database = require('better-sqlite3');
const path = require('path');

const NOTION_API_KEY = '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';
const CONTACTS_DB_ID = 'c812f778-cd65-413f-8feb-5cbc4fbb5dd8';
const DB_PATH = path.join(process.cwd(), 'data', 'whatsapp-agent.db');

const db = new Database(DB_PATH);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkNotionContact(phone) {
  const digits = phone?.replace(/\D/g, '') || '';
  const lastDigits = digits.slice(-9);

  if (!lastDigits || lastDigits.length < 9) return null;

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${CONTACTS_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        filter: { property: '*Téléphone', phone_number: { contains: lastDigits } }
      }),
    });

    const data = await res.json();
    const contact = data.results?.[0];

    if (!contact) return null;

    const statutContact = contact.properties?.['Statut contact']?.multi_select || [];
    const isClient = statutContact.some(s => s.name === 'Client');

    return { found: true, isClient, statuts: statutContact.map(s => s.name) };
  } catch (err) {
    console.error(`Error checking ${phone}:`, err.message);
    return null;
  }
}

async function main() {
  // Get all HSVA contacts without tags
  const hsvaContacts = db.prepare(`
    SELECT jid, name, phone, status, tags
    FROM conversations
    WHERE status = 'hsva' AND (tags IS NULL OR tags = '[]' OR tags = '')
  `).all();

  console.log(`Found ${hsvaContacts.length} HSVA contacts without tags\n`);

  const updateClient = db.prepare('UPDATE conversations SET status = ? WHERE jid = ?');

  let clientCount = 0;
  let nullCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (let i = 0; i < hsvaContacts.length; i++) {
    const contact = hsvaContacts[i];
    const phone = contact.phone || contact.jid.replace('@s.whatsapp.net', '').replace('@lid', '');

    // Skip LID contacts (no valid phone)
    if (contact.jid.includes('@lid')) {
      console.log(`[${i+1}/${hsvaContacts.length}] SKIP LID: ${contact.name}`);
      continue;
    }

    const result = await checkNotionContact(phone);

    if (!result) {
      // Not found in Notion -> set to NULL
      updateClient.run(null, contact.jid);
      notFoundCount++;
      console.log(`[${i+1}/${hsvaContacts.length}] NOT IN NOTION: ${contact.name} (${phone}) -> NULL`);
    } else if (result.isClient) {
      // Is Client in Notion -> set to 'client'
      updateClient.run('client', contact.jid);
      clientCount++;
      console.log(`[${i+1}/${hsvaContacts.length}] CLIENT: ${contact.name} (${phone}) -> client`);
    } else {
      // In Notion but not Client -> set to NULL
      updateClient.run(null, contact.jid);
      nullCount++;
      console.log(`[${i+1}/${hsvaContacts.length}] NOT CLIENT: ${contact.name} (${phone}) [${result.statuts.join(', ')}] -> NULL`);
    }

    // Rate limit: ~3 requests per second
    await sleep(350);

    // Progress every 50
    if ((i + 1) % 50 === 0) {
      console.log(`\n--- Progress: ${i+1}/${hsvaContacts.length} ---`);
      console.log(`Clients: ${clientCount}, Not in Notion: ${notFoundCount}, Other: ${nullCount}\n`);
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Total processed: ${hsvaContacts.length}`);
  console.log(`Set to 'client': ${clientCount}`);
  console.log(`Set to NULL (not in Notion): ${notFoundCount}`);
  console.log(`Set to NULL (in Notion but not Client): ${nullCount}`);
}

main().catch(console.error);

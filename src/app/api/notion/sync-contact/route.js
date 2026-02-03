import { NextResponse } from 'next/server';

const NOTION_API_KEY = process.env.NOTION_API_KEY || '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';
const CONTACTS_DB_ID = 'c812f778-cd65-413f-8feb-5cbc4fbb5dd8';

function formatPhone(phone) {
  let digits = phone?.replace(/\D/g, '') || '';
  // French number starting with 0 -> convert to 33
  if (digits.length === 10 && digits.startsWith('0')) {
    digits = '33' + digits.slice(1);
  }
  // Format as +33 X XX XX XX XX
  if (digits.length === 11 && digits.startsWith('33')) {
    return '+' + digits.slice(0,2) + ' ' + digits.slice(2,3) + ' ' + digits.slice(3,5) + ' ' + digits.slice(5,7) + ' ' + digits.slice(7,9) + ' ' + digits.slice(9);
  }
  // International format
  if (digits.length > 0) {
    return '+' + digits;
  }
  return phone;
}

export async function POST(req) {
  try {
    const { name, phone, email, dossierId } = await req.json();

    if (!name || !phone) {
      return NextResponse.json({ error: 'name and phone required' }, { status: 400 });
    }

    const formattedPhone = formatPhone(phone);
    const digits = phone?.replace(/\D/g, '') || '';
    const lastDigits = digits.slice(-9); // Last 9 digits for matching

    console.log(`[Notion Sync] Name: ${name}, Phone: ${phone} -> ${formattedPhone}, Search: ${lastDigits}`);

    // Check if contact already exists (search by last 9 digits to handle format differences)
    const searchRes = await fetch(`https://api.notion.com/v1/databases/${CONTACTS_DB_ID}/query`, {
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

    const searchData = await searchRes.json();
    const existingContact = searchData.results?.[0];
    console.log(`[Notion Sync] Search found: ${searchData.results?.length || 0} contacts, existing: ${existingContact?.id || 'none'}`);

    const properties = {
      'Nom_Prénom': { title: [{ text: { content: name } }] },
      '*Téléphone': { phone_number: formattedPhone },
      'Whatsapp': { checkbox: true },
    };

    if (email) {
      properties['*E-mail'] = { email: email };
    }

    if (dossierId) {
      properties['💬 Dossier'] = { relation: [{ id: dossierId }] };
    }

    let result;
    if (existingContact) {
      // Update existing contact
      const updateRes = await fetch(`https://api.notion.com/v1/pages/${existingContact.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({ properties }),
      });
      result = await updateRes.json();
      return NextResponse.json({ success: true, action: 'updated', contactId: result.id, url: result.url });
    } else {
      // Create new contact
      const createRes = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: CONTACTS_DB_ID },
          properties,
        }),
      });
      result = await createRes.json();
      console.log(`[Notion Sync] Create result:`, result.id ? 'SUCCESS' : 'FAILED', result.id || result.message || JSON.stringify(result));
      if (result.object === 'error') {
        return NextResponse.json({ success: false, error: result.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, action: 'created', contactId: result.id, url: result.url });
    }
  } catch (err) {
    console.error('Sync contact error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

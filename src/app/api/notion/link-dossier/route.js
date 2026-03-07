import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { linkNotionDossier, getConversation } from '@/lib/database';
import { NOTION_API_KEY, NOTION_CONTACTS_DB_ID } from '@/lib/notion-config';

const notion = new Client({ auth: NOTION_API_KEY });

function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('33')) {
    return '+' + digits.slice(0,2) + ' ' + digits.slice(2,3) + ' ' + digits.slice(3,5) + ' ' + digits.slice(5,7) + ' ' + digits.slice(7,9) + ' ' + digits.slice(9);
  }
  return '+' + digits;
}

export async function POST(req) {
  try {
    const { jid, dossierId, dossierName, dossierUrl, createContact } = await req.json();

    // Link dossier to conversation in local DB
    linkNotionDossier(jid, dossierId, dossierName, dossierUrl);

    // Optionally create contact in Notion
    if (createContact) {
      const conv = getConversation(jid);
      if (conv && conv.name && !conv.name.match(/^\+?\d{6,}$/)) {
        const phone = jid.split('@')[0];

        // Check if contact already exists
        const existing = await notion.databases.query({
          database_id: NOTION_CONTACTS_DB_ID,
          filter: { property: '*Téléphone', phone_number: { equals: formatPhone(phone) } }
        });

        if (existing.results.length === 0) {
          await notion.pages.create({
            parent: { database_id: NOTION_CONTACTS_DB_ID },
            properties: {
              'Nom_Prénom': { title: [{ text: { content: conv.name } }] },
              '*Téléphone': { phone_number: formatPhone(phone) },
              'Statut contact': { multi_select: [{ name: 'Client' }] },
              'Whatsapp': { checkbox: true },
              '💬 Dossier': { relation: [{ id: dossierId }] }
            }
          });
          return NextResponse.json({ success: true, contactCreated: true });
        }
      }
    }

    return NextResponse.json({ success: true, contactCreated: false });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { notionHeaders } from '@/lib/notion-config';

export async function POST(request) {
  try {
    const { contact_id, dossier_id } = await request.json();

    if (!contact_id || !dossier_id) {
      return NextResponse.json({ error: 'contact_id and dossier_id required' }, { status: 400 });
    }

    // Update the contact's "💬 Dossier" relation in Notion
    const res = await fetch(`https://api.notion.com/v1/pages/${contact_id}`, {
      method: 'PATCH',
      headers: notionHeaders(),
      body: JSON.stringify({
        properties: {
          '💬 Dossier': {
            relation: [{ id: dossier_id }],
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.message || `Notion ${res.status}` }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update contact dossier error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

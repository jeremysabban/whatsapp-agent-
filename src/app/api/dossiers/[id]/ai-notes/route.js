import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare('SELECT ai_notes, ai_notes_updated_at FROM dossiers WHERE id = ?').get(id);
    if (!row) return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });
    return NextResponse.json({ notes: row.ai_notes || '', updated_at: row.ai_notes_updated_at || null });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { notes } = await request.json();
    if (notes == null) return NextResponse.json({ error: 'notes required' }, { status: 400 });
    const db = getDb();
    const now = Date.now();
    db.prepare('UPDATE dossiers SET ai_notes = ?, ai_notes_updated_at = ? WHERE id = ?').run(notes, now, id);
    return NextResponse.json({ success: true, updated_at: now });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

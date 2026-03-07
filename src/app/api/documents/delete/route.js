import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function POST(request) {
  try {
    const { docId } = await request.json();

    if (!docId) {
      return NextResponse.json({ error: 'docId requis' }, { status: 400 });
    }

    const db = getDb();
    db.prepare('DELETE FROM documents WHERE id = ?').run(docId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Delete document error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

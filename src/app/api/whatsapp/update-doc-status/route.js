import { NextResponse } from 'next/server';
import { updateDocumentStatus } from '@/lib/database';

export async function POST(request) {
  try {
    const { docId, status } = await request.json();
    if (!docId || !status) return NextResponse.json({ error: 'docId and status required' }, { status: 400 });
    updateDocumentStatus(docId, status);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

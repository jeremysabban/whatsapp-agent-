import { NextResponse } from 'next/server';
import { getDocuments } from '@/lib/database';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const jid = searchParams.get('jid');
    const documents = getDocuments(jid, status);
    return NextResponse.json({ documents });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

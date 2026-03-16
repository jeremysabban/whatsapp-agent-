import { NextResponse } from 'next/server';
import { disconnect } from '@/lib/whatsapp-client';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await disconnect();
    return NextResponse.json({ status: 'disconnected' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

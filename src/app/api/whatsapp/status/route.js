import { NextResponse } from 'next/server';
import { getStatus } from '@/lib/whatsapp-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(getStatus());
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

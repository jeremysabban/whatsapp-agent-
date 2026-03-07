import { NextResponse } from 'next/server';
import { reconnect } from '@/lib/whatsapp-client';

export async function POST() {
  try {
    const result = await reconnect();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

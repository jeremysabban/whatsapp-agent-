import { NextResponse } from 'next/server';
import { connect } from '@/lib/whatsapp-client';

export async function POST() {
  try {
    const result = await connect();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

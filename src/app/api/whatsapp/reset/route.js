import { NextResponse } from 'next/server';
import { logout } from '@/lib/whatsapp-client';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Full logout - clears session and requires new QR scan
    const result = await logout();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Reset] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

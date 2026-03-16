import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getQR, getStatus } from '@/lib/whatsapp-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const qr = getQR();
    if (!qr) return NextResponse.json({ qr: null, status: getStatus().status });
    const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
    return NextResponse.json({ qr: qrDataUrl, status: 'connecting' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

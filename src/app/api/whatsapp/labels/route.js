import { NextResponse } from 'next/server';
import { getAllLabels, getLabelStats } from '@/lib/database';

export async function GET() {
  try {
    const labels = getAllLabels();
    const stats = getLabelStats();
    return NextResponse.json({ labels, stats });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

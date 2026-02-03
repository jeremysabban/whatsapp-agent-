import { NextResponse } from 'next/server';
import { getConversations, getTaggedConversations, getStats, getLabelStats, getAllLabels } from '@/lib/database';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const label = searchParams.get('label');       // Client, Assurance, Prospect
    const time = searchParams.get('time');          // 1h, 1j, 1sem, 1mois, 3mois
    const tagged = searchParams.get('tagged');      // 'true' = only tagged convs

    let conversations;
    if (label) {
      conversations = getConversations({ labelName: label, timePeriod: time || undefined });
    } else if (tagged === 'true') {
      conversations = getTaggedConversations({ timePeriod: time || undefined });
    } else {
      conversations = getConversations({ timePeriod: time || undefined });
    }

    const stats = getStats();
    const labelStats = getLabelStats();
    const allLabels = getAllLabels();

    return NextResponse.json({ conversations, stats, labelStats, allLabels });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

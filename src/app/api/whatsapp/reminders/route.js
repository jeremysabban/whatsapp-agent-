import { NextResponse } from 'next/server';
import { getUpcomingReminders, getDueReminders } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const due = searchParams.get('due') === 'true';

    const reminders = due ? getDueReminders() : getUpcomingReminders();

    return NextResponse.json({ reminders });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

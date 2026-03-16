import { NextResponse } from 'next/server';
import { isCalendarConfigured, getEventsForDateRange, getEventsForDay } from '@/lib/calendar-client';

export async function GET(request) {
  try {
    // Check if calendar is configured
    if (!isCalendarConfigured()) {
      return NextResponse.json({
        configured: false,
        message: 'Google Calendar not configured. Please re-authorize with calendar scope.',
        events: []
      });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const date = searchParams.get('date'); // Single day

    let events;

    if (date) {
      // Get events for a specific day
      events = await getEventsForDay(date);
    } else if (start && end) {
      // Get events for a date range
      events = await getEventsForDateRange(start, end);
    } else {
      // Default: get events for today
      events = await getEventsForDay(new Date().toISOString().split('T')[0]);
    }

    return NextResponse.json({
      configured: true,
      events,
      count: events.length
    });

  } catch (error) {
    console.error('Calendar API error:', error);

    // Check if it's an auth error (needs re-authorization)
    if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired')) {
      return NextResponse.json({
        configured: false,
        message: 'Google Calendar token expired. Please re-authorize.',
        events: []
      });
    }

    return NextResponse.json({
      error: error.message,
      events: []
    }, { status: 500 });
  }
}

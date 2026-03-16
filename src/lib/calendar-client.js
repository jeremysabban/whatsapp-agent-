// Google Calendar Client
// Uses existing Google OAuth credentials from Gmail integration

import { google } from 'googleapis';

// Check if calendar credentials are configured
export function isCalendarConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

// Get authenticated Google Calendar client
export function getCalendarClient() {
  if (!isCalendarConfigured()) {
    throw new Error('Google Calendar credentials not configured');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Get events for a date range
export async function getEventsForDateRange(startDate, endDate) {
  const calendar = getCalendarClient();

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date(startDate).toISOString(),
      timeMax: new Date(endDate).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100
    });

    return (response.data.items || []).map(event => ({
      id: event.id,
      title: event.summary || 'Sans titre',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      allDay: !event.start?.dateTime,
      location: event.location || '',
      htmlLink: event.htmlLink,
      status: event.status,
      attendees: (event.attendees || []).map(a => ({
        email: a.email,
        name: a.displayName,
        response: a.responseStatus
      }))
    }));
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

// Get events for a specific day
export async function getEventsForDay(date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return getEventsForDateRange(dayStart.toISOString(), dayEnd.toISOString());
}

// Get events for current week
export async function getEventsForWeek() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
  endOfWeek.setHours(23, 59, 59, 999);

  return getEventsForDateRange(startOfWeek.toISOString(), endOfWeek.toISOString());
}

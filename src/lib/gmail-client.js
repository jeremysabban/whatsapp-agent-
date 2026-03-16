import { google } from 'googleapis';

/**
 * Gmail client using OAuth2
 * Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in .env
 */

/**
 * Check if Gmail OAuth is configured
 */
export function isGmailConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

/**
 * Get authenticated Gmail client
 */
export function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Fetch pending emails from the last N hours
 * Filters out newsletters, promotions, and automated emails
 * @param {number} hoursBack - Hours to look back
 * @returns {Array} List of emails with from, subject, date, snippet
 */
export async function getRecentEmails(maxEmails = 10, hoursBack = 6) {
  if (!isGmailConfigured()) {
    console.log('[GMAIL] Not configured (missing GOOGLE_REFRESH_TOKEN)');
    return [];
  }

  try {
    const gmail = getGmailClient();
    const after = Math.floor(Date.now() / 1000) - (hoursBack * 3600);

    // Search for recent emails, excluding automated/promotional
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${after} -from:noreply -from:no-reply -from:notification -category:promotions -category:social -category:updates`,
      maxResults: 20
    });

    if (!res.data.messages) {
      console.log('[GMAIL] No emails found');
      return [];
    }

    const emails = [];
    for (const msg of res.data.messages.slice(0, maxEmails)) {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        const headers = detail.data.payload.headers;
        const fromHeader = headers.find(h => h.name === 'From')?.value || 'Unknown';

        // Extract name from "Name <email>" format
        const fromMatch = fromHeader.match(/^(.+?)\s*<.+>$/);
        const fromName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : fromHeader.split('@')[0];

        emails.push({
          id: msg.id,
          from: fromHeader,
          fromName: fromName,
          subject: headers.find(h => h.name === 'Subject')?.value || '(Sans sujet)',
          date: new Date(headers.find(h => h.name === 'Date')?.value || Date.now()),
          snippet: detail.data.snippet || ''
        });
      } catch (e) {
        console.error('[GMAIL] Error fetching message:', e.message);
      }
    }

    console.log(`[GMAIL] Found ${emails.length} emails`);
    return emails;

  } catch (error) {
    console.error('[GMAIL] Error:', error.message);
    return [];
  }
}

/**
 * Get count of unread emails
 */
export async function getUnreadCount() {
  if (!isGmailConfigured()) {
    return 0;
  }

  try {
    const gmail = getGmailClient();
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread -category:promotions -category:social',
      maxResults: 100
    });
    return res.data.messages?.length || 0;
  } catch (error) {
    console.error('[GMAIL] Error getting unread count:', error.message);
    return 0;
  }
}

/**
 * Search emails by contact name or email address
 * Returns full email content for context
 * @param {string} searchQuery - Name or email to search for
 * @param {number} maxEmails - Maximum emails to fetch
 * @param {number} hoursBack - Hours to look back
 */
export async function searchEmailsByContact(searchQuery, maxEmails = 5, hoursBack = 72) {
  if (!isGmailConfigured() || !searchQuery) {
    return [];
  }

  try {
    const gmail = getGmailClient();
    const after = Math.floor(Date.now() / 1000) - (hoursBack * 3600);

    // Search for emails from/to this contact
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: `(from:${searchQuery} OR to:${searchQuery}) after:${after}`,
      maxResults: maxEmails
    });

    if (!res.data.messages) {
      return [];
    }

    const emails = [];
    for (const msg of res.data.messages) {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });

        const headers = detail.data.payload.headers;
        const fromHeader = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const toHeader = headers.find(h => h.name === 'To')?.value || '';

        // Extract name from "Name <email>" format
        const fromMatch = fromHeader.match(/^(.+?)\s*<.+>$/);
        const fromName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : fromHeader.split('@')[0];

        // Get email body
        let body = '';
        const payload = detail.data.payload;

        if (payload.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload.parts) {
          // Find text/plain or text/html part
          const textPart = payload.parts.find(p => p.mimeType === 'text/plain') ||
                          payload.parts.find(p => p.mimeType === 'text/html');
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        }

        // Clean HTML if present
        body = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        // Limit body size
        body = body.substring(0, 2000);

        emails.push({
          id: msg.id,
          from: fromHeader,
          fromName: fromName,
          to: toHeader,
          subject: headers.find(h => h.name === 'Subject')?.value || '(Sans sujet)',
          date: new Date(headers.find(h => h.name === 'Date')?.value || Date.now()),
          body: body,
          snippet: detail.data.snippet || ''
        });
      } catch (e) {
        console.error('[GMAIL] Error fetching message detail:', e.message);
      }
    }

    console.log(`[GMAIL] Found ${emails.length} emails for "${searchQuery}"`);
    return emails;

  } catch (error) {
    console.error('[GMAIL] Search error:', error.message);
    return [];
  }
}

import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  // Check if credentials are configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({
      error: 'Google credentials not configured',
      missing: {
        GOOGLE_CLIENT_ID: !process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI: !process.env.GOOGLE_REDIRECT_URI
      }
    }, { status: 500 });
  }

  // Use the current URL as redirect URI if not configured
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${new URL(req.url).origin}/api/auth/gmail/callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  if (!code) {
    // Step 1: Redirect to Google OAuth
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/drive'
      ]
    });
    return NextResponse.redirect(url);
  }

  try {
    // Step 2: Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Display refresh token for manual copy to .env.local
    return NextResponse.json({
      success: true,
      message: 'Copie ce refresh_token dans .env.local sous GOOGLE_REFRESH_TOKEN=',
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ? '[present]' : null,
      scopes: tokens.scope
    });
  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.response?.data || null,
      hint: 'Vérifie que le redirect URI dans Google Cloud Console correspond à: ' + (process.env.GOOGLE_REDIRECT_URI || `${new URL(req.url).origin}/api/auth/gmail/callback`)
    }, { status: 500 });
  }
}

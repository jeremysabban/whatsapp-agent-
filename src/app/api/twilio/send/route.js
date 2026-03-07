import { NextResponse } from 'next/server';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'; // Sandbox number

export async function POST(request) {
  try {
    const { to, message } = await request.json();

    if (!to || !message) {
      return NextResponse.json({ error: 'Missing to or message' }, { status: 400 });
    }

    // Format phone number
    let phone = to.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    if (!phone.startsWith('+')) phone = '+' + phone;

    // Send via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
        To: `whatsapp:${phone}`,
        Body: message,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[TWILIO] Send error:', result);
      return NextResponse.json({ error: result.message || 'Send failed' }, { status: 500 });
    }

    console.log(`[TWILIO] Message sent to ${phone}: ${message.substring(0, 50)}...`);

    return NextResponse.json({
      success: true,
      sid: result.sid,
      status: result.status,
    });
  } catch (error) {
    console.error('[TWILIO] Send error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

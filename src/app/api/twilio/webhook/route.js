import { NextResponse } from 'next/server';
import { upsertConversation, insertMessage, updateConversationLastMessage, incrementUnread } from '@/lib/database';

// Twilio WhatsApp Webhook
export async function POST(request) {
  try {
    const formData = await request.formData();

    // Extract Twilio message data
    const from = formData.get('From')?.replace('whatsapp:', '') || '';
    const to = formData.get('To')?.replace('whatsapp:', '') || '';
    const body = formData.get('Body') || '';
    const messageSid = formData.get('MessageSid') || '';
    const numMedia = parseInt(formData.get('NumMedia') || '0');
    const profileName = formData.get('ProfileName') || '';

    console.log(`[TWILIO] 📥 Message from ${from} (${profileName}): ${body}`);

    // Format phone number as JID (WhatsApp ID format)
    const phone = from.replace('+', '');
    const jid = phone + '@s.whatsapp.net';

    // Create or update conversation
    upsertConversation(jid, profileName || from, from);

    // Handle media if present
    let mediaUrl = null;
    let mediaType = 'text';
    if (numMedia > 0) {
      mediaUrl = formData.get('MediaUrl0');
      const contentType = formData.get('MediaContentType0') || '';
      if (contentType.startsWith('image/')) mediaType = 'image';
      else if (contentType.startsWith('video/')) mediaType = 'video';
      else if (contentType.startsWith('audio/')) mediaType = 'audio';
      else mediaType = 'document';
    }

    // Save message to database
    const timestamp = Date.now();
    insertMessage(
      messageSid,           // id
      jid,                  // jid
      false,                // fromMe
      profileName || from,  // senderName
      body,                 // text
      timestamp,            // timestamp
      mediaType,            // msgType
      false,                // isDoc
      null,                 // docId
      JSON.stringify({ twilio: true, mediaUrl })  // raw
    );

    // Update conversation
    updateConversationLastMessage(jid, body || `[${mediaType}]`, timestamp);
    incrementUnread(jid);

    console.log(`[TWILIO] ✅ Message saved for ${jid}`);

    // Return TwiML response (empty response = no auto-reply)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: { 'Content-Type': 'application/xml' },
      }
    );
  } catch (error) {
    console.error('[TWILIO] ❌ Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Twilio sends GET for verification
export async function GET() {
  return NextResponse.json({ status: 'Twilio webhook ready' });
}

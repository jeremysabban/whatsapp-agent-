import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sendMessage, findGroupByName } from '@/lib/whatsapp-client';

const DB_PATH = path.join(process.cwd(), 'data', 'reminders.json');

function getReminders() {
  if (!fs.existsSync(DB_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return []; }
}

function saveReminders(reminders) {
  fs.writeFileSync(DB_PATH, JSON.stringify(reminders, null, 2));
}

// Cache the alarm group JID to avoid fetching every 30s
let cachedAlarmJid = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

export async function POST() {
  try {
    const reminders = getReminders();
    const now = new Date();
    const due = reminders.filter(r => new Date(r.time) <= now);

    if (due.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Find ALARME group (cached)
    let alarmJid = null;
    if (cachedAlarmJid && (Date.now() - cacheTime) < CACHE_TTL) {
      alarmJid = cachedAlarmJid;
    } else {
      const group = await findGroupByName('ALARME');
      if (group) {
        alarmJid = group.id;
        cachedAlarmJid = group.id;
        cacheTime = Date.now();
      }
    }

    let sent = 0;
    const sentIds = new Set();
    for (const r of due) {
      const targetJid = alarmJid || (r.phone.includes('@') ? r.phone : `${r.phone}@s.whatsapp.net`);
      try {
        console.log(`[ALARM] Sending to ${targetJid}: ${r.text}`);
        await sendMessage(targetJid, `🚨 DRING ! RAPPEL : ${r.text}`);
        sentIds.add(r.id);
        sent++;
        console.log(`[ALARM] ✅ Sent OK to ${targetJid}`);
      } catch (e) {
        console.error(`[ALARM] ❌ Send failed to ${targetJid}:`, e.message);
      }
    }

    // Only remove successfully sent reminders
    const remaining = reminders.filter(r => new Date(r.time) > now || (!sentIds.has(r.id)));
    saveReminders(remaining);

    return NextResponse.json({ sent, target: alarmJid ? 'group:ALARME' : 'fallback:personal' });
  } catch (error) {
    console.error('Reminder check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

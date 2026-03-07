import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'reminders.json');

// Création dossier data si inexistant
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function getReminders() {
  if (!fs.existsSync(DB_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return []; }
}

export async function GET() {
  return NextResponse.json(getReminders());
}

export async function POST(req) {
  const { text, time, phone } = await req.json();
  const reminders = getReminders();
  const newReminder = { id: Date.now().toString(), text, time, phone };
  reminders.push(newReminder);
  fs.writeFileSync(DB_PATH, JSON.stringify(reminders, null, 2));
  return NextResponse.json({ success: true });
}

export async function DELETE(req) {
  const { id } = await req.json();
  let reminders = getReminders();
  reminders = reminders.filter(r => r.id !== id);
  fs.writeFileSync(DB_PATH, JSON.stringify(reminders, null, 2));
  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    const cwd = process.cwd();
    const dbPath = path.join(cwd, 'data', 'whatsapp-agent.db');
    const dbExists = fs.existsSync(dbPath);

    // List all db files in cwd
    const dataDir = path.join(cwd, 'data');
    const dataFiles = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter(f => f.endsWith('.db')) : [];

    // List db files in root
    const rootDbFiles = fs.readdirSync(cwd).filter(f => f.endsWith('.db'));

    let dbInfo = null;
    if (dbExists) {
      const db = new Database(dbPath, { readonly: true });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      let messagesSchema = [];
      let messagesCount = 'N/A';
      if (tables.some(t => t.name === 'messages')) {
        messagesSchema = db.prepare("PRAGMA table_info(messages)").all();
        messagesCount = db.prepare("SELECT COUNT(*) as c FROM messages").get()?.c || 0;
      }
      dbInfo = {
        tables: tables.map(t => t.name),
        messagesSchema,
        messagesCount
      };
      db.close();
    }

    return NextResponse.json({
      cwd,
      dbPath,
      dbExists,
      dataFiles,
      rootDbFiles,
      dbInfo
    });
  } catch (error) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

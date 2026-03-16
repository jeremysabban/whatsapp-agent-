import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'whatsapp-agent.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let _db = null;

export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        jid TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'Inconnu', phone TEXT,
        avatar_initials TEXT DEFAULT '??', avatar_color TEXT DEFAULT 'bg-gray-500',
        status TEXT DEFAULT NULL, category TEXT NOT NULL DEFAULT 'Autre',
        tags TEXT DEFAULT '[]',
        priority TEXT NOT NULL DEFAULT 'medium', notes TEXT DEFAULT '',
        unread_count INTEGER DEFAULT 0, last_message TEXT, last_message_time INTEGER,
        last_activity_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, conversation_jid TEXT NOT NULL, from_me INTEGER NOT NULL DEFAULT 0,
        sender_name TEXT, text TEXT, timestamp INTEGER NOT NULL,
        message_type TEXT DEFAULT 'text', is_document INTEGER DEFAULT 0,
        document_id TEXT, raw_data TEXT,
        FOREIGN KEY (conversation_jid) REFERENCES conversations(jid) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, conversation_jid TEXT NOT NULL, message_id TEXT,
        filename TEXT NOT NULL DEFAULT 'unknown', mimetype TEXT, file_size INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'recu', local_path TEXT, thumbnail_path TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
        FOREIGN KEY (conversation_jid) REFERENCES conversations(jid) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS wa_labels (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, color INTEGER DEFAULT 0, predefined_id TEXT
      );
      CREATE TABLE IF NOT EXISTS wa_label_associations (
        label_id TEXT NOT NULL, chat_jid TEXT NOT NULL,
        PRIMARY KEY (label_id, chat_jid),
        FOREIGN KEY (label_id) REFERENCES wa_labels(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS agent_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        description TEXT NOT NULL,
        conversation_jid TEXT,
        conversation_name TEXT,
        metadata TEXT DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_messages_jid ON messages(conversation_jid);
      CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_documents_jid ON documents(conversation_jid);
      CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
      CREATE INDEX IF NOT EXISTS idx_label_assoc_jid ON wa_label_associations(chat_jid);
      CREATE INDEX IF NOT EXISTS idx_label_assoc_label ON wa_label_associations(label_id);
      CREATE INDEX IF NOT EXISTS idx_agent_log_time ON agent_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_agent_log_type ON agent_log(action_type);
    `);
    const addCol = (table, col, def) => { try { _db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch {} };
    addCol('conversations', 'notion_dossier_id', 'TEXT DEFAULT NULL');
    addCol('conversations', 'notion_dossier_name', 'TEXT DEFAULT NULL');
    addCol('conversations', 'notion_dossier_url', 'TEXT DEFAULT NULL');
    addCol('conversations', 'wa_labels', "TEXT DEFAULT '[]'");
    addCol('conversations', 'tags', "TEXT DEFAULT '[]'");
    addCol('messages', 'media_url', 'TEXT DEFAULT NULL');
    addCol('messages', 'media_mimetype', 'TEXT DEFAULT NULL');
    addCol('conversations', 'starred', 'INTEGER DEFAULT 0');
    addCol('conversations', 'tag_projects', "TEXT DEFAULT '{}'");
    addCol('conversations', 'email', 'TEXT DEFAULT NULL');
    addCol('conversations', 'whatsapp_name', 'TEXT DEFAULT NULL');
    addCol('conversations', 'custom_name', 'TEXT DEFAULT NULL');
    addCol('conversations', 'notion_contact_id', 'TEXT DEFAULT NULL');
    addCol('conversations', 'notion_contact_name', 'TEXT DEFAULT NULL');
    addCol('conversations', 'notion_contact_url', 'TEXT DEFAULT NULL');
    addCol('conversations', 'name_source', "TEXT DEFAULT 'whatsapp'");
    addCol('conversations', 'reminder_at', 'INTEGER DEFAULT NULL'); // Timestamp for reminder
    addCol('conversations', 'reminder_note', 'TEXT DEFAULT NULL'); // Optional note for reminder
    // Migrate existing 'name' to 'whatsapp_name' if whatsapp_name is null
    _db.exec(`UPDATE conversations SET whatsapp_name = name WHERE whatsapp_name IS NULL AND name IS NOT NULL`);
    // Set name_source based on existing data
    _db.exec(`UPDATE conversations SET name_source = 'dossier' WHERE notion_dossier_name IS NOT NULL AND name_source IS NULL`);
    _db.exec(`UPDATE conversations SET name_source = 'manual' WHERE custom_name IS NOT NULL AND notion_dossier_name IS NULL AND name_source IS NULL`);
    _db.exec(`UPDATE conversations SET name_source = 'whatsapp' WHERE name_source IS NULL`);
    // Notion cache table
    _db.exec(`CREATE TABLE IF NOT EXISTS notion_cache (
      dossier_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    // Knowledge base table
    _db.exec(`CREATE TABLE IF NOT EXISTS knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      titre TEXT NOT NULL,
      contenu TEXT NOT NULL,
      assureur TEXT,
      produit TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    )`);
    // Dossier conversations table (for Claude context)
    _db.exec(`CREATE TABLE IF NOT EXISTS dossier_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_notion_id TEXT UNIQUE NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      context_360 TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    )`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_assureur ON knowledge(assureur)`);
    // Migrate old/null statuses to inbox (default) — never touch hsva or existing valid statuses
    _db.exec(`UPDATE conversations SET status = 'inbox' WHERE status NOT IN ('client', 'assurance', 'prospect', 'apporteur', 'hsva', 'inbox') OR status IS NULL`);
    // Move orphan prospects (no linked Notion contact) to inbox
    _db.exec(`UPDATE conversations SET status = 'inbox' WHERE status = 'prospect' AND notion_contact_id IS NULL`);
  }
  return _db;
}

const AVATAR_COLORS = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500','bg-pink-500','bg-teal-500','bg-orange-500'];

function getInitials(name) {
  if (!name) return '??';
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
}

function getAvatarColor(jid) {
  let h = 0;
  for (let i = 0; i < jid.length; i++) { h = ((h << 5) - h) + jid.charCodeAt(i); h |= 0; }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// Display name based on source: contact > dossier > manual > whatsapp
export function getDisplayName(conv) {
  // Utiliser 'name' s'il existe et n'est pas un numéro de téléphone
  const nameIsValid = conv.name && !/^\+?\d{6,}$/.test(conv.name) && conv.name !== 'Inconnu';
  const fallback = (nameIsValid ? conv.name : null) || conv.whatsapp_name || conv.phone || conv.jid?.split('@')[0] || 'Inconnu';

  switch (conv.name_source) {
    case 'contact':
      return conv.notion_contact_name || conv.notion_dossier_name || conv.custom_name || fallback;
    case 'dossier':
      return conv.notion_dossier_name || conv.custom_name || fallback;
    case 'manual':
      return conv.custom_name || fallback;
    case 'whatsapp':
    default:
      return fallback;
  }
}

// Normalize tag_projects: old {Lead: {id,name,url}} → new {Lead: [{id,name,url}]}
function normalizeTagProjects(tp) {
  if (!tp || typeof tp !== 'object') return {};
  const result = {};
  for (const [key, val] of Object.entries(tp)) {
    if (Array.isArray(val)) {
      result[key] = val;
    } else if (val && typeof val === 'object' && val.id) {
      result[key] = [val];
    } else {
      result[key] = [];
    }
  }
  return result;
}

// Enrich conversation with display_name for frontend
function enrichConversation(r) {
  if (!r) return r;
  r.tags = r.tags ? JSON.parse(r.tags) : [];
  r.tag_projects = normalizeTagProjects(r.tag_projects ? JSON.parse(r.tag_projects) : {});
  r.starred = r.starred === 1;
  r.display_name = getDisplayName(r);
  r.display_initials = getInitials(r.display_name);
  return r;
}

export function upsertConversation(jid, name, phone) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM conversations WHERE jid = ?').get(jid);
  if (existing) {
    // Only update whatsapp_name from WhatsApp push name (never touch custom_name or notion_dossier_name)
    if (name && name !== existing.whatsapp_name && !name.match(/^\+?\d{6,}/)) {
      db.prepare('UPDATE conversations SET whatsapp_name = ?, updated_at = ? WHERE jid = ?')
        .run(name, Date.now(), jid);
    }
    return enrichConversation(db.prepare('SELECT * FROM conversations WHERE jid = ?').get(jid));
  }
  const waName = name || null;
  const phoneNum = phone || jid.split('@')[0];
  const displayName = waName || phoneNum;
  db.prepare('INSERT INTO conversations (jid,name,whatsapp_name,phone,avatar_initials,avatar_color,created_at,updated_at,last_activity_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(jid, displayName, waName, phoneNum, getInitials(displayName), getAvatarColor(jid), Date.now(), Date.now(), Date.now());
  return enrichConversation(db.prepare('SELECT * FROM conversations WHERE jid = ?').get(jid));
}

// ==================== CONVERSATIONS ====================
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function timeCutoff(period) {
  const now = Date.now();
  switch (period) {
    case '1h': return now - 3600000;
    case '1j': return now - 86400000;
    case '1sem': return now - 604800000;
    case '1mois': return now - 2592000000;
    case '3mois': return now - 7776000000;
    default: return null;
  }
}

export function getConversations({ labelName, timePeriod } = {}) {
  const db = getDb();
  const cutoff = Date.now() - SIX_MONTHS_MS;
  let q = `SELECT c.*,
    (SELECT COUNT(*) FROM documents d WHERE d.conversation_jid=c.jid) as document_count,
    (SELECT COUNT(*) FROM documents d WHERE d.conversation_jid=c.jid AND d.status!='traite') as pending_docs,
    (SELECT GROUP_CONCAT(wl.name,'||') FROM wa_label_associations wla JOIN wa_labels wl ON wla.label_id=wl.id WHERE wla.chat_jid=c.jid) as label_names,
    (SELECT m.text FROM messages m WHERE m.conversation_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) as last_msg_text,
    (SELECT m.timestamp FROM messages m WHERE m.conversation_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) as last_msg_time,
    (SELECT m.from_me FROM messages m WHERE m.conversation_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) as last_msg_from_me,
    (SELECT m.message_type FROM messages m WHERE m.conversation_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) as last_msg_type
    FROM conversations c WHERE (c.last_message_time >= ? OR c.last_message_time IS NULL)`;
  const p = [cutoff];
  if (labelName) {
    q += ` AND EXISTS (SELECT 1 FROM wa_label_associations wla JOIN wa_labels wl ON wla.label_id=wl.id WHERE wla.chat_jid=c.jid AND LOWER(wl.name)=LOWER(?))`;
    p.push(labelName);
  }
  const tc = timeCutoff(timePeriod);
  if (tc) { q += ` AND c.last_message_time >= ?`; p.push(tc); }
  q += ` ORDER BY COALESCE(last_msg_time, c.last_message_time) DESC NULLS LAST`;
  return db.prepare(q).all(...p).map(r => {
    const conv = enrichConversation(r);
    conv.labels = r.label_names ? r.label_names.split('||').filter(Boolean) : [];
    if (r.last_msg_time) {
      conv.last_message = r.last_msg_text;
      conv.last_message_time = r.last_msg_time;
      conv.last_message_from_me = r.last_msg_from_me === 1;
      conv.last_message_type = r.last_msg_type || 'text';
    }
    return conv;
  });
}

export function getTaggedConversations({ timePeriod } = {}) {
  const db = getDb();
  const cutoff = Date.now() - SIX_MONTHS_MS;
  let q = `SELECT c.*,
    (SELECT COUNT(*) FROM documents d WHERE d.conversation_jid=c.jid) as document_count,
    (SELECT COUNT(*) FROM documents d WHERE d.conversation_jid=c.jid AND d.status!='traite') as pending_docs,
    (SELECT GROUP_CONCAT(wl.name,'||') FROM wa_label_associations wla JOIN wa_labels wl ON wla.label_id=wl.id WHERE wla.chat_jid=c.jid) as label_names,
    (SELECT m.text FROM messages m WHERE m.conversation_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) as last_msg_text,
    (SELECT m.timestamp FROM messages m WHERE m.conversation_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) as last_msg_time,
    (SELECT m.from_me FROM messages m WHERE m.conversation_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) as last_msg_from_me,
    (SELECT m.message_type FROM messages m WHERE m.conversation_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) as last_msg_type
    FROM conversations c WHERE (c.last_message_time >= ? OR c.last_message_time IS NULL)
    AND EXISTS (SELECT 1 FROM wa_label_associations wla JOIN wa_labels wl ON wla.label_id=wl.id WHERE wla.chat_jid=c.jid AND LOWER(wl.name) IN ('client','assurance','prospect'))`;
  const p = [cutoff];
  const tc = timeCutoff(timePeriod);
  if (tc) { q += ` AND c.last_message_time >= ?`; p.push(tc); }
  q += ` ORDER BY COALESCE(last_msg_time, c.last_message_time) DESC NULLS LAST`;
  return db.prepare(q).all(...p).map(r => {
    const conv = enrichConversation(r);
    conv.labels = r.label_names ? r.label_names.split('||').filter(Boolean) : [];
    if (r.last_msg_time) {
      conv.last_message = r.last_msg_text;
      conv.last_message_time = r.last_msg_time;
      conv.last_message_from_me = r.last_msg_from_me === 1;
      conv.last_message_type = r.last_msg_type || 'text';
    }
    return conv;
  });
}

export function getConversation(jid) {
  const r = getDb().prepare('SELECT * FROM conversations WHERE jid=?').get(jid);
  return enrichConversation(r);
}
export function updateConversationStatus(jid, s) { getDb().prepare('UPDATE conversations SET status=?,updated_at=? WHERE jid=?').run(s, Date.now(), jid); }
export function updateConversationCategory(jid, c) { getDb().prepare('UPDATE conversations SET category=?,updated_at=? WHERE jid=?').run(c, Date.now(), jid); }
export function updateConversationTags(jid, tags) { getDb().prepare('UPDATE conversations SET tags=?,updated_at=? WHERE jid=?').run(JSON.stringify(tags), Date.now(), jid); }
export function updateConversationPriority(jid, p) { getDb().prepare('UPDATE conversations SET priority=?,updated_at=? WHERE jid=?').run(p, Date.now(), jid); }
export function updateConversationNotes(jid, n) { getDb().prepare('UPDATE conversations SET notes=?,updated_at=? WHERE jid=?').run(n, Date.now(), jid); }
export function updateConversationLastMessage(jid, text, ts) { getDb().prepare('UPDATE conversations SET last_message=?,last_message_time=?,last_activity_at=?,updated_at=? WHERE jid=?').run(text, ts, Date.now(), Date.now(), jid); }
export function incrementUnread(jid) { getDb().prepare('UPDATE conversations SET unread_count=unread_count+1 WHERE jid=?').run(jid); }
export function resetUnread(jid) { getDb().prepare('UPDATE conversations SET unread_count=0 WHERE jid=?').run(jid); }
export function updateStarred(jid, starred) { getDb().prepare('UPDATE conversations SET starred=?,updated_at=? WHERE jid=?').run(starred ? 1 : 0, Date.now(), jid); }
export function updateTagProjects(jid, tagProjects) { getDb().prepare('UPDATE conversations SET tag_projects=?,updated_at=? WHERE jid=?').run(JSON.stringify(tagProjects), Date.now(), jid); }
export function getStarredConversations() {
  const db = getDb();
  return db.prepare('SELECT * FROM conversations WHERE starred=1 ORDER BY last_message_time DESC').all().map(r => {
    const conv = enrichConversation(r);
    conv.labels = [];
    return conv;
  });
}

export function insertMessage(id, jid, fromMe, senderName, text, ts, msgType, isDoc, docId, raw) {
  const db = getDb();
  if (db.prepare('SELECT id FROM messages WHERE id=?').get(id)) return;
  db.prepare('INSERT INTO messages (id,conversation_jid,from_me,sender_name,text,timestamp,message_type,is_document,document_id,raw_data) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, jid, fromMe?1:0, senderName, text, ts, msgType, isDoc?1:0, docId, raw);
}

export function getMessages(jid, limit=200, offset=0) {
  // Get the most recent messages, then reverse for chronological display
  const messages = getDb().prepare('SELECT * FROM messages WHERE conversation_jid=? ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(jid, limit, offset);
  return messages.reverse();
}

export function insertDocument(id, jid, msgId, filename, mimetype, fileSize, localPath) {
  getDb().prepare('INSERT OR IGNORE INTO documents (id,conversation_jid,message_id,filename,mimetype,file_size,local_path,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id, jid, msgId, filename, mimetype, fileSize, localPath, Date.now());
}

export function getDocuments(jid=null, status=null, excludeProcessed=true) {
  let q = `SELECT d.*,
    COALESCE(c.notion_dossier_name, c.notion_contact_name, c.custom_name, c.whatsapp_name, c.name) as conversation_name,
    c.notion_dossier_name, c.notion_contact_name,
    c.avatar_initials, c.avatar_color, c.status as contact_status
    FROM documents d JOIN conversations c ON d.conversation_jid=c.jid`;
  const conds=[], params=[];
  if (jid) { conds.push('d.conversation_jid=?'); params.push(jid); }
  if (status) { conds.push('d.status=?'); params.push(status); }
  // Exclude processed documents and HSVA contacts by default
  if (excludeProcessed) {
    conds.push("d.status != 'traite'");
    conds.push("c.status != 'hsva'");
  }
  // Always exclude audio files (voice notes, music, etc.)
  conds.push("d.mimetype NOT LIKE '%audio%'");
  conds.push("d.filename NOT LIKE '%.ogg'");
  if (conds.length) q += ' WHERE ' + conds.join(' AND ');
  q += ' ORDER BY d.created_at DESC';
  return getDb().prepare(q).all(...params);
}

export function updateDocumentStatus(docId, status) { getDb().prepare('UPDATE documents SET status=? WHERE id=?').run(status, docId); }

export function linkNotionDossier(jid, dossierId, dossierName, dossierUrl) {
  // Only update notion_dossier fields - do NOT overwrite name/whatsapp_name/custom_name
  // The display_name will be computed at query time with priority: notion_dossier_name > custom_name > whatsapp_name
  getDb().prepare('UPDATE conversations SET notion_dossier_id=?, notion_dossier_name=?, notion_dossier_url=?, updated_at=? WHERE jid=?')
    .run(dossierId, dossierName, dossierUrl, Date.now(), jid);
}

export function getLinkedDossier(jid) {
  const row = getDb().prepare('SELECT notion_dossier_id, notion_dossier_name, notion_dossier_url FROM conversations WHERE jid=?').get(jid);
  if (!row || !row.notion_dossier_id) return null;
  return { id: row.notion_dossier_id, name: row.notion_dossier_name, url: row.notion_dossier_url };
}

export function getStats() {
  const db = getDb();
  const c = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='client' THEN 1 ELSE 0 END) as client, SUM(CASE WHEN status='assurance' THEN 1 ELSE 0 END) as assurance, SUM(CASE WHEN status='prospect' THEN 1 ELSE 0 END) as prospect, SUM(CASE WHEN status='apporteur' THEN 1 ELSE 0 END) as apporteur, SUM(CASE WHEN status='hsva' THEN 1 ELSE 0 END) as hsva, SUM(CASE WHEN status='inbox' THEN 1 ELSE 0 END) as inbox, SUM(CASE WHEN priority='high' AND status!='hsva' THEN 1 ELSE 0 END) as urgents, SUM(unread_count) as total_unread FROM conversations`).get();
  const d = db.prepare(`SELECT COUNT(*) as total_docs, SUM(CASE WHEN status!='traite' THEN 1 ELSE 0 END) as pending_docs FROM documents`).get();
  return { ...c, ...d };
}

export function updateMessageMedia(msgId, mediaUrl, mediaMimetype) {
  getDb().prepare('UPDATE messages SET media_url=?, media_mimetype=? WHERE id=?').run(mediaUrl, mediaMimetype, msgId);
  getDb().prepare('UPDATE documents SET local_path=? WHERE message_id=?').run(mediaUrl, msgId);
}

// ==================== LABELS ====================
export function upsertLabel(id, name, color, predefinedId) {
  getDb().prepare(`INSERT INTO wa_labels (id,name,color,predefined_id) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,predefined_id=excluded.predefined_id`)
    .run(id, name, color || 0, predefinedId || null);
}
export function deleteLabel(id) {
  const db = getDb();
  db.prepare('DELETE FROM wa_label_associations WHERE label_id=?').run(id);
  db.prepare('DELETE FROM wa_labels WHERE id=?').run(id);
}
export function addLabelAssociation(labelId, chatJid) {
  getDb().prepare('INSERT OR IGNORE INTO wa_label_associations (label_id,chat_jid) VALUES (?,?)').run(labelId, chatJid);
}
export function removeLabelAssociation(labelId, chatJid) {
  getDb().prepare('DELETE FROM wa_label_associations WHERE label_id=? AND chat_jid=?').run(labelId, chatJid);
}
export function getAllLabels() {
  return getDb().prepare('SELECT wl.*, COUNT(wla.chat_jid) as chat_count FROM wa_labels wl LEFT JOIN wa_label_associations wla ON wl.id=wla.label_id GROUP BY wl.id ORDER BY wl.name').all();
}
export function getLabelStats() {
  const labels = getDb().prepare(`SELECT wl.name, COUNT(wla.chat_jid) as count FROM wa_labels wl JOIN wa_label_associations wla ON wl.id=wla.label_id WHERE LOWER(wl.name) IN ('client','assurance','prospect') GROUP BY wl.id`).all();
  const r = { client: 0, assurance: 0, prospect: 0 };
  for (const l of labels) r[l.name.toLowerCase()] = l.count;
  return r;
}

// ==================== AGENT LOG ====================
export function insertAgentLog(actionType, description, jid, convName, metadata) {
  getDb().prepare('INSERT INTO agent_log (timestamp,action_type,description,conversation_jid,conversation_name,metadata) VALUES (?,?,?,?,?,?)')
    .run(Date.now(), actionType, description, jid || null, convName || null, JSON.stringify(metadata || {}));
}
export function getAgentLogs(limit=50, offset=0, actionType=null) {
  if (actionType) {
    return getDb().prepare('SELECT * FROM agent_log WHERE action_type=? ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(actionType, limit, offset);
  }
  return getDb().prepare('SELECT * FROM agent_log ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset);
}
export function getAgentLogCount(actionType=null) {
  if (actionType) return getDb().prepare('SELECT COUNT(*) as count FROM agent_log WHERE action_type=?').get(actionType).count;
  return getDb().prepare('SELECT COUNT(*) as count FROM agent_log').get().count;
}

// ==================== CONTACT ====================
export function forceUpdateName(jid, name) {
  if (!name || name.match(/^\+?\d{6,}/)) return;
  getDb().prepare('UPDATE conversations SET name=?, avatar_initials=?, updated_at=? WHERE jid=?')
    .run(name, getInitials(name), Date.now(), jid);
}

export function setCustomName(jid, name, setAsSource = true) {
  if (!name) return;
  if (setAsSource) {
    getDb().prepare('UPDATE conversations SET custom_name=?, name_source=?, updated_at=? WHERE jid=?')
      .run(name.trim(), 'manual', Date.now(), jid);
  } else {
    getDb().prepare('UPDATE conversations SET custom_name=?, updated_at=? WHERE jid=?')
      .run(name.trim(), Date.now(), jid);
  }
}

export function setEmail(jid, email) {
  getDb().prepare('UPDATE conversations SET email=?, updated_at=? WHERE jid=?')
    .run(email?.trim() || null, Date.now(), jid);
}

export function setPhone(jid, phone) {
  getDb().prepare('UPDATE conversations SET phone=?, updated_at=? WHERE jid=?')
    .run(phone?.trim() || null, Date.now(), jid);
}

export function setReminder(jid, reminderAt, note = null) {
  getDb().prepare('UPDATE conversations SET reminder_at=?, reminder_note=?, updated_at=? WHERE jid=?')
    .run(reminderAt, note, Date.now(), jid);
}

export function clearReminder(jid) {
  getDb().prepare('UPDATE conversations SET reminder_at=NULL, reminder_note=NULL, updated_at=? WHERE jid=?')
    .run(Date.now(), jid);
}

export function getUpcomingReminders(limit = 50) {
  const db = getDb();
  const now = Date.now();
  return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM documents d WHERE d.conversation_jid=c.jid) as document_count
    FROM conversations c
    WHERE c.reminder_at IS NOT NULL AND c.reminder_at > 0
    ORDER BY c.reminder_at ASC
    LIMIT ?
  `).all(limit).map(r => enrichConversation(r));
}

export function getDueReminders() {
  const db = getDb();
  const now = Date.now();
  return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM documents d WHERE d.conversation_jid=c.jid) as document_count
    FROM conversations c
    WHERE c.reminder_at IS NOT NULL AND c.reminder_at <= ?
    ORDER BY c.reminder_at ASC
  `).all(now).map(r => enrichConversation(r));
}

export function setNameSource(jid, source) {
  if (!['contact', 'dossier', 'manual', 'whatsapp'].includes(source)) return;
  getDb().prepare('UPDATE conversations SET name_source=?, updated_at=? WHERE jid=?')
    .run(source, Date.now(), jid);
}

export function linkNotionContact(jid, contactId, contactName, contactUrl) {
  const db = getDb();
  db.prepare(`UPDATE conversations SET notion_contact_id=?, notion_contact_name=?, notion_contact_url=?, name_source=?, status = CASE WHEN status = 'inbox' THEN 'prospect' ELSE status END, updated_at=? WHERE jid=?`)
    .run(contactId, contactName, contactUrl, 'contact', Date.now(), jid);
}

export function findJidByNotionContactId(notionContactId) {
  const row = getDb().prepare('SELECT jid FROM conversations WHERE notion_contact_id = ?').get(notionContactId);
  return row ? row.jid : null;
}

export function unlinkNotionContact(jid) {
  getDb().prepare('UPDATE conversations SET notion_contact_id=NULL, notion_contact_name=NULL, notion_contact_url=NULL, updated_at=? WHERE jid=?')
    .run(Date.now(), jid);
}

// ==================== NOTION CACHE ====================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getNotionCache(dossierId) {
  const row = getDb().prepare('SELECT data, updated_at FROM notion_cache WHERE dossier_id = ?').get(dossierId);
  if (!row) return null;
  return {
    data: JSON.parse(row.data),
    updatedAt: row.updated_at,
    isStale: Date.now() - row.updated_at > CACHE_TTL,
  };
}

export function setNotionCache(dossierId, data) {
  getDb().prepare('INSERT OR REPLACE INTO notion_cache (dossier_id, data, updated_at) VALUES (?, ?, ?)')
    .run(dossierId, JSON.stringify(data), Date.now());
}

export function invalidateNotionCache(dossierId) {
  getDb().prepare('DELETE FROM notion_cache WHERE dossier_id = ?').run(dossierId);
}

// ==================== KNOWLEDGE BASE ====================
export function insertKnowledge(type, titre, contenu, assureur = null, produit = null) {
  const db = getDb();
  const result = db.prepare('INSERT INTO knowledge (type, titre, contenu, assureur, produit, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(type, titre, contenu, assureur, produit, Date.now());
  return result.lastInsertRowid;
}

export function searchKnowledge(query, type = null, limit = 10) {
  const db = getDb();
  const searchTerm = `%${query}%`;
  if (type) {
    return db.prepare(`
      SELECT * FROM knowledge
      WHERE type = ? AND (titre LIKE ? OR contenu LIKE ?)
      ORDER BY created_at DESC LIMIT ?
    `).all(type, searchTerm, searchTerm, limit);
  }
  return db.prepare(`
    SELECT * FROM knowledge
    WHERE titre LIKE ? OR contenu LIKE ?
    ORDER BY created_at DESC LIMIT ?
  `).all(searchTerm, searchTerm, limit);
}

export function getAllKnowledge(type = null, limit = 100) {
  const db = getDb();
  if (type) {
    return db.prepare('SELECT * FROM knowledge WHERE type = ? ORDER BY created_at DESC LIMIT ?').all(type, limit);
  }
  return db.prepare('SELECT * FROM knowledge ORDER BY created_at DESC LIMIT ?').all(limit);
}

export function deleteKnowledge(id) {
  getDb().prepare('DELETE FROM knowledge WHERE id = ?').run(id);
}

// ==================== DOSSIER CONVERSATIONS (Claude Context) ====================
export function upsertDossierConversation(dossierId, messages, context360 = {}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO dossier_conversations (dossier_notion_id, messages, context_360, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(dossier_notion_id) DO UPDATE SET
      messages = excluded.messages,
      context_360 = excluded.context_360,
      updated_at = excluded.updated_at
  `).run(dossierId, JSON.stringify(messages), JSON.stringify(context360), Date.now());
}

export function getDossierConversation(dossierId) {
  const row = getDb().prepare('SELECT * FROM dossier_conversations WHERE dossier_notion_id = ?').get(dossierId);
  if (!row) return null;
  return {
    id: row.id,
    dossierId: row.dossier_notion_id,
    messages: JSON.parse(row.messages || '[]'),
    context360: JSON.parse(row.context_360 || '{}'),
    updatedAt: row.updated_at
  };
}

export function appendDossierMessage(dossierId, role, content) {
  const existing = getDossierConversation(dossierId);
  const messages = existing?.messages || [];
  messages.push({ role, content, timestamp: Date.now() });
  // Keep only last 50 messages
  const trimmed = messages.slice(-50);
  upsertDossierConversation(dossierId, trimmed, existing?.context360 || {});
}

export function clearDossierConversation(dossierId) {
  getDb().prepare('DELETE FROM dossier_conversations WHERE dossier_notion_id = ?').run(dossierId);
}

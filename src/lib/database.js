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
    addCol('conversations', 'linked_jid', 'TEXT DEFAULT NULL'); // JID of linked (primary) conversation for dedup
    addCol('conversations', 'gemini_url', 'TEXT DEFAULT NULL');
    addCol('projects', 'notes', "TEXT DEFAULT ''");
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
    // ==================== LOCAL-FIRST TABLES ====================
    _db.exec(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Sans nom',
      type TEXT DEFAULT 'Lead',
      level TEXT DEFAULT '',
      priority TEXT DEFAULT '',
      value REAL DEFAULT NULL,
      dossier_id TEXT DEFAULT NULL,
      dossier_name TEXT DEFAULT NULL,
      date TEXT DEFAULT NULL,
      completed INTEGER DEFAULT 0,
      url TEXT DEFAULT NULL,
      notion_synced INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    )`);
    _db.exec(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Sans nom',
      completed INTEGER DEFAULT 0,
      project_id TEXT DEFAULT NULL,
      dossier_id TEXT DEFAULT NULL,
      dossier_name TEXT DEFAULT NULL,
      date TEXT DEFAULT NULL,
      assignee TEXT DEFAULT NULL,
      comments TEXT DEFAULT '',
      ordre INTEGER DEFAULT NULL,
      url TEXT DEFAULT NULL,
      notion_synced INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    )`);
    // Migration : ajouter task_type si manquant
    try {
      _db.exec(`ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT NULL`);
    } catch (e) {
      // Colonne existe déjà, ignorer
    }
    // Migration : ajouter task_time si manquant
    try {
      _db.exec(`ALTER TABLE tasks ADD COLUMN task_time TEXT DEFAULT NULL`);
    } catch (e) {}
    // Migration : ajouter task_duration si manquant (en minutes, défaut 20)
    try {
      _db.exec(`ALTER TABLE tasks ADD COLUMN task_duration INTEGER DEFAULT 20`);
    } catch (e) {}
    // Migration : renommer task types
    try {
      _db.prepare("UPDATE tasks SET task_type = 'Message WhatsApp' WHERE task_type = 'Call WhatsApp'").run();
      _db.prepare("UPDATE tasks SET task_type = 'Attente du client' WHERE task_type = 'Relance'").run();
    } catch (e) {}

    _db.exec(`CREATE TABLE IF NOT EXISTS dossiers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Sans nom',
      drive_url TEXT DEFAULT NULL,
      gemini_url TEXT DEFAULT NULL,
      phone TEXT DEFAULT NULL,
      email TEXT DEFAULT NULL,
      status TEXT DEFAULT NULL,
      url TEXT DEFAULT NULL,
      notion_synced INTEGER DEFAULT 1,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    )`);
    _db.exec(`CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      error_message TEXT DEFAULT NULL,
      retries INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      processed_at INTEGER DEFAULT NULL
    )`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_level ON projects(level)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_dossier ON projects(dossier_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_dossier ON tasks(dossier_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`);
    _db.exec(`CREATE TABLE IF NOT EXISTS broker_codes (
      id TEXT PRIMARY KEY,
      compagnie TEXT DEFAULT '',
      type TEXT DEFAULT '',
      identifiant TEXT DEFAULT '',
      mot_de_passe TEXT DEFAULT '',
      url TEXT DEFAULT '',
      commentaires TEXT DEFAULT '',
      notion_url TEXT DEFAULT '',
      notion_synced INTEGER DEFAULT 1,
      updated_at INTEGER DEFAULT (strftime('%s','now')*1000)
    )`);

    _db.exec(`CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Inconnu',
      email TEXT DEFAULT NULL,
      phone TEXT DEFAULT NULL,
      company TEXT DEFAULT NULL,
      tags TEXT DEFAULT '[]',
      status TEXT DEFAULT NULL,
      dossier_id TEXT DEFAULT NULL,
      url TEXT DEFAULT NULL,
      notion_synced INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    )`);

    _db.exec(`CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Sans nom',
      type_assurance TEXT DEFAULT NULL,
      cie_details TEXT DEFAULT NULL,
      product_type TEXT DEFAULT NULL,
      date_effet TEXT DEFAULT NULL,
      date_signature TEXT DEFAULT NULL,
      date_resiliation TEXT DEFAULT NULL,
      desactive INTEGER DEFAULT 0,
      details TEXT DEFAULT NULL,
      dossier_id TEXT DEFAULT NULL,
      url TEXT DEFAULT NULL,
      notion_synced INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    )`);

    _db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_dossier ON contacts(dossier_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_contracts_dossier ON contracts(dossier_id)`);

    // Migration: add new contract columns
    addCol('contracts', 'compagnie_id', 'TEXT DEFAULT NULL');
    addCol('contracts', 'compagnie_name', 'TEXT DEFAULT NULL');
    addCol('contracts', 'code_assurance_id', 'TEXT DEFAULT NULL');
    addCol('contracts', 'souscripteur_id', 'TEXT DEFAULT NULL');
    addCol('contracts', 'filiale_id', 'TEXT DEFAULT NULL');
    addCol('contracts', 'project_id', 'TEXT DEFAULT NULL');
    addCol('contracts', 'commission_2026', 'REAL DEFAULT NULL');
    addCol('contracts', 'gdrive_url', 'TEXT DEFAULT NULL');
    addCol('contracts', 'cotisation_annuelle', 'REAL DEFAULT NULL');
    addCol('contracts', 'last_edited', 'TEXT DEFAULT NULL');

    _db.exec(`CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id TEXT,
      contract_number TEXT NOT NULL,
      client_name TEXT,
      ref_cie TEXT,
      entity TEXT,
      nature TEXT,
      nature_code TEXT,
      echeance TEXT,
      period_date TEXT,
      prime REAL DEFAULT 0,
      assiette REAL DEFAULT 0,
      commission REAL DEFAULT 0,
      net_du REAL DEFAULT 0,
      bordereau_file TEXT,
      bordereau_date TEXT,
      code_support TEXT,
      matched INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    )`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_commissions_contract ON commissions(contract_number)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_commissions_period ON commissions(period_date)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_commissions_contract_id ON commissions(contract_id)`);

    // Migration: add new commission columns for v2 multi-source
    addCol('commissions', 'bordereau_hash', 'TEXT DEFAULT NULL');
    addCol('commissions', 'source', 'TEXT DEFAULT NULL');
    addCol('commissions', 'compagnie', 'TEXT DEFAULT NULL');
    addCol('commissions', 'type_commission', 'TEXT DEFAULT NULL');
    addCol('commissions', 'taux_commission', 'REAL DEFAULT NULL');
    addCol('commissions', 'period_start', 'TEXT DEFAULT NULL');
    addCol('commissions', 'period_end', 'TEXT DEFAULT NULL');

    _db.exec(`CREATE TABLE IF NOT EXISTS bordereau_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      content_hash TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      nb_lines INTEGER,
      total_commission REAL,
      period_start TEXT,
      period_end TEXT,
      imported_at INTEGER
    )`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_bordereau_hash ON bordereau_imports(content_hash)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_commissions_hash ON commissions(bordereau_hash)`);

    _db.exec(`CREATE TABLE IF NOT EXISTS import_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      source TEXT,
      files_uploaded TEXT,
      files_stored TEXT,
      nb_files INTEGER DEFAULT 0,
      nb_lines INTEGER DEFAULT 0,
      total_commission REAL DEFAULT 0,
      matched_contracts INTEGER DEFAULT 0,
      unmatched_contracts INTEGER DEFAULT 0,
      proposed_bank_matches TEXT,
      status TEXT DEFAULT 'pending',
      report_json TEXT,
      created_at INTEGER,
      validated_at INTEGER
    )`);

    _db.exec(`CREATE TABLE IF NOT EXISTS bank_commission_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      month TEXT NOT NULL,
      amount REAL NOT NULL,
      source TEXT NOT NULL,
      source_detail TEXT,
      reference TEXT,
      detail TEXT,
      matched_bordereau_id INTEGER,
      matched_amount REAL,
      status TEXT DEFAULT 'unmatched',
      imported_at INTEGER DEFAULT (strftime('%s','now')*1000)
    )`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_bank_comm_source ON bank_commission_payments(source)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_bank_comm_month ON bank_commission_payments(month)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_bank_comm_status ON bank_commission_payments(status)`);
    _db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_comm_unique ON bank_commission_payments(date, amount, source, reference)`);

    // ==================== FINANCE MODULE TABLES ====================
    _db.exec(`CREATE TABLE IF NOT EXISTS bank_outflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      bank_account TEXT,
      type TEXT,
      subtype TEXT,
      raw_detail TEXT NOT NULL,
      short_label TEXT,
      amount REAL NOT NULL,
      nature TEXT NOT NULL DEFAULT 'PRO',
      category TEXT NOT NULL,
      subscription_id INTEGER,
      user_overridden INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, amount, raw_detail)
    )`);

    _db.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant TEXT NOT NULL UNIQUE,
      match_pattern TEXT NOT NULL,
      nature TEXT NOT NULL DEFAULT 'PRO',
      category TEXT NOT NULL,
      cadence TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIF',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    _db.exec(`CREATE INDEX IF NOT EXISTS idx_outflows_date ON bank_outflows(date)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_outflows_nature_cat ON bank_outflows(nature, category)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_outflows_sub ON bank_outflows(subscription_id)`);

    addCol('dossiers', 'ai_notes', "TEXT DEFAULT ''");
    addCol('dossiers', 'ai_notes_updated_at', 'INTEGER');

    addCol('bank_outflows', 'tag', "TEXT NOT NULL DEFAULT 'autre'");

    // Finance tags (dynamic, user-manageable)
    _db.exec(`CREATE TABLE IF NOT EXISTS finance_tags (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'slate',
      pattern TEXT DEFAULT NULL,
      position INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')*1000),
      updated_at INTEGER DEFAULT (strftime('%s','now')*1000)
    )`);
    const tagsCount = _db.prepare('SELECT COUNT(*) AS n FROM finance_tags').get().n;
    if (tagsCount === 0) {
      const TAGS_SEED = [
        { id:'salaire',      label:'Salaire',            color:'emerald', pattern:'SABBAN' },
        { id:'loyer',        label:'Loyer',              color:'blue',    pattern:'SDC 190 BD BINEAU|SDC 190 BINEAU' },
        { id:'honoraires',   label:'Honoraires',         color:'indigo',  pattern:'LUMAY|LUMA AVOCAT|KODSI|SARINA|COACHING' },
        { id:'logiciel',     label:'Logiciel',           color:'violet',  pattern:'CLAUDE\\.AI|ANTHROPIC|NOTION|USENOTION|LEMSQZY|NOTEFORMS|APPLE\\.COM|ADOBE|OPENAI|CHATGPT|ECILIA' },
        { id:'telecom-it',   label:'Telecom/IT',         color:'cyan',    pattern:'BOUYGUES|FREE TELECOM|FREE MOBILE|GOOGLE WORKSPAC|GANDI|CONTABO|DIGIDOM' },
        { id:'achat',        label:'Achat',              color:'amber',   pattern:'AMAZON|AMZN|AMZ DIGITAL|UNIQLO|FNAC|TEMU|JIUHAOK|ZARA|H&M|BEAUX TITRE|JRMC|PAYPAL' },
        { id:'alimentation', label:'Alimentation',       color:'orange',  pattern:'FRANPRIX|CARREFOUR|CARREF|PICARD|MONOP|ALDI|POINCARE DISTRI|CHANTHI|BDB |AFRIKA|BUDDIE|92 DISTRIB|YBRY KASH|KAYSER|BOULANGERIE|CHEZ MEUNIER|BEKEF|MISSADA|B\\.L\\.S|STARBUCKS|CHINA LEE|CHARLES ET DAN|GABRIEL PARIS|MAISON GABRIEL|LE VERGER|ABRAHAM|SHINZZO|PHARMACIE|LAPOSTE|TABAC|TALIROULE|MF00|VILLENEUVE LA|SUSHI|KOSHER' },
        { id:'transport',    label:'Transport',          color:'slate',   pattern:'COFIROUTE|AREAS|ASF |TOTAL |SARGE LES|PARK FOCH|MINIT|RELAIS ST BRICE|ESSENCE|STATION ESSO|SHELL|BP FRANCE|UBER' },
        { id:'assurance',    label:'Assurance/Mutuelle', color:'rose',    pattern:'HENNER|AIG - FRANCE|AIG FRANCE|AIG-FRANCE' },
        { id:'don',          label:'Don',                color:'yellow',  pattern:'CONSISTOIRE|ALLODONS|JUDAIC|CHARIDY|TZEDAKA' },
        { id:'finance',      label:'Finance',            color:'zinc',    pattern:'AL HOLDING|ALHOLDING|COMMISSIONS FACTURE|COMMISSION INTERVENT|CNCEF|AM&JT|AMJT|ORIAS|INFOGREFFE' },
        { id:'autre',        label:'Autre',              color:'stone',   pattern:null },
      ];
      const insTag = _db.prepare('INSERT INTO finance_tags (id, label, color, pattern, position) VALUES (?, ?, ?, ?, ?)');
      TAGS_SEED.forEach((t, i) => insTag.run(t.id, t.label, t.color, t.pattern, i));
    }
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_outflows_tag ON bank_outflows(tag)`);

    // Seed subscriptions
    const SUBS_SEED = [
      { match: 'CLAUDE.AI', merchant: 'Claude.ai', nature:'PRO', category:'Logiciels', cadence:'Mensuel' },
      { match: 'NOTION LABS', merchant: 'Notion', nature:'PRO', category:'Logiciels', cadence:'Mensuel' },
      { match: 'USENOTION', merchant: 'Notion (Usenotion)', nature:'PRO', category:'Logiciels', cadence:'Mensuel' },
      { match: 'LEMSQZY* NOTION', merchant: 'Notion (Lemonsqzy)', nature:'PRO', category:'Logiciels', cadence:'Mensuel' },
      { match: 'NOTEFORMS', merchant: 'Noteforms', nature:'PRO', category:'Logiciels', cadence:'Mensuel' },
      { match: 'APPLE.COM', merchant: 'Apple iCloud', nature:'PRO', category:'Logiciels', cadence:'Mensuel' },
      { match: 'ADOBE', merchant: 'Adobe', nature:'PRO', category:'Logiciels', cadence:'Mensuel' },
      { match: 'OPENAI', merchant: 'OpenAI ChatGPT', nature:'PRO', category:'Logiciels', cadence:'Mensuel' },
      { match: 'CHATGPT', merchant: 'OpenAI ChatGPT (alt)', nature:'PRO', category:'Logiciels', cadence:'Mensuel' },
      { match: 'ECILIA', merchant: 'Ecilia', nature:'PRO', category:'Logiciels', cadence:'Trimestriel' },
      { match: 'GOOGLE WORKSPAC', merchant: 'Google Workspace', nature:'PRO', category:'IT / Hébergement', cadence:'Mensuel' },
      { match: 'GANDI', merchant: 'Gandi (domaines)', nature:'PRO', category:'IT / Hébergement', cadence:'Variable' },
      { match: 'CONTABO', merchant: 'Contabo (VPS)', nature:'PRO', category:'IT / Hébergement', cadence:'Mensuel' },
      { match: 'BOUYGUES', merchant: 'Bouygues Telecom', nature:'PRO', category:'Telecom', cadence:'Mensuel' },
      { match: 'FREE TELECOM', merchant: 'Free Telecom', nature:'PRO', category:'Telecom', cadence:'Mensuel' },
      { match: 'DIGIDOM', merchant: 'DigiDom', nature:'PRO', category:'Domiciliation', cadence:'Mensuel' },
      { match: 'HENNER', merchant: 'Henner GMC', nature:'PRO', category:'Mutuelle', cadence:'Mensuel' },
      { match: 'AIG - FRANCE', merchant: 'AIG France (RC Pro)', nature:'PRO', category:'Assurance Pro', cadence:'Annuel' },
      { match: 'DISNEY', merchant: 'Disney+', nature:'PERSO', category:'Divers perso', cadence:'Mensuel' },
      { match: 'UBER', merchant: 'Uber', nature:'PERSO', category:'Divers perso', cadence:'Mensuel' },
      { match: 'AMAZON PAYMENTS', merchant: 'Amazon (abonnements)', nature:'PERSO', category:'Amazon', cadence:'Variable' },
      { match: 'AMAZON EU', merchant: 'Amazon EU', nature:'PERSO', category:'Amazon', cadence:'Variable' },
      { match: 'AMZ DIGITAL', merchant: 'Amazon Digital', nature:'PERSO', category:'Amazon', cadence:'Variable' },
    ];
    const seedSub = _db.prepare('INSERT OR IGNORE INTO subscriptions (merchant, match_pattern, nature, category, cadence) VALUES (?, ?, ?, ?, ?)');
    for (const s of SUBS_SEED) {
      seedSub.run(s.merchant, s.match, s.nature, s.category, s.cadence);
    }

    addCol('bordereau_imports', 'bank_payment_id', 'INTEGER DEFAULT NULL');
    addCol('bordereau_imports', 'bank_confirmed', 'INTEGER DEFAULT 0');
    addCol('bordereau_imports', 'original_filename', 'TEXT DEFAULT NULL');
    addCol('bordereau_imports', 'stored_filename', 'TEXT DEFAULT NULL');
    addCol('bordereau_imports', 'stored_path', 'TEXT DEFAULT NULL');
    addCol('bordereau_imports', 'import_report', 'TEXT DEFAULT NULL');
    addCol('bordereau_imports', 'validated', 'INTEGER DEFAULT 0');
    addCol('bordereau_imports', 'validated_at', 'INTEGER DEFAULT NULL');

    _db.exec(`CREATE TABLE IF NOT EXISTS pense_betes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      completed_at INTEGER
    )`);

    _db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_assureur ON knowledge(assureur)`);

    // ==================== EMAIL ANALYSIS TABLES ====================
    _db.exec(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER
    )`);

    _db.exec(`CREATE TABLE IF NOT EXISTS email_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
      thread_id TEXT,
      from_email TEXT,
      from_name TEXT,
      to_email TEXT,
      subject TEXT,
      snippet TEXT,
      date INTEGER,
      category TEXT,
      action_required TEXT,
      summary TEXT,
      has_attachments INTEGER DEFAULT 0,
      attachment_summary TEXT,
      project_id TEXT DEFAULT NULL,
      project_name TEXT DEFAULT NULL,
      is_read INTEGER DEFAULT 0,
      analysis_batch INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    )`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_email_analyses_date ON email_analyses(date DESC)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_email_analyses_category ON email_analyses(category)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_email_analyses_batch ON email_analyses(analysis_batch)`);
    try { _db.exec(`ALTER TABLE email_analyses ADD COLUMN dossier_id TEXT DEFAULT NULL`); } catch (e) {}
    try { _db.exec(`ALTER TABLE email_analyses ADD COLUMN dossier_name TEXT DEFAULT NULL`); } catch (e) {}
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

// Link two conversations (dedup): source becomes a duplicate of target
export function linkConversation(sourceJid, targetJid) {
  const db = getDb();
  const target = db.prepare('SELECT * FROM conversations WHERE jid = ?').get(targetJid);
  if (!target) return null;
  // Set linked_jid on source
  db.prepare('UPDATE conversations SET linked_jid = ? WHERE jid = ?').run(targetJid, sourceJid);
  // Copy Notion links from target to source if source doesn't have them
  const source = db.prepare('SELECT * FROM conversations WHERE jid = ?').get(sourceJid);
  if (target.notion_dossier_id && !source.notion_dossier_id) {
    db.prepare('UPDATE conversations SET notion_dossier_id = ?, notion_dossier_name = ?, notion_dossier_url = ? WHERE jid = ?')
      .run(target.notion_dossier_id, target.notion_dossier_name, target.notion_dossier_url, sourceJid);
  }
  if (target.notion_contact_id && !source.notion_contact_id) {
    db.prepare('UPDATE conversations SET notion_contact_id = ?, notion_contact_name = ?, notion_contact_url = ? WHERE jid = ?')
      .run(target.notion_contact_id, target.notion_contact_name, target.notion_contact_url, sourceJid);
  }
  return { source: getConversation(sourceJid), target: getConversation(targetJid) };
}

export function unlinkConversation(jid) {
  getDb().prepare('UPDATE conversations SET linked_jid = NULL WHERE jid = ?').run(jid);
}

export function getLinkedConversation(jid) {
  const row = getDb().prepare('SELECT linked_jid FROM conversations WHERE jid = ?').get(jid);
  if (!row?.linked_jid) return null;
  return getConversation(row.linked_jid);
}

export function getReverseLinkedJids(jid) {
  return getDb().prepare('SELECT jid FROM conversations WHERE linked_jid = ?').all(jid).map(r => r.jid);
}

// ==================== LOCAL-FIRST: PROJECTS ====================

export function getLocalProjects(filter = {}) {
  const db = getDb();
  let q = 'SELECT * FROM projects WHERE 1=1';
  const params = [];
  if (filter.type) { q += ' AND type = ?'; params.push(filter.type); }
  if (filter.level) { q += ' AND level = ?'; params.push(filter.level); }
  if (filter.dossier_id) { q += ' AND dossier_id = ?'; params.push(filter.dossier_id); }
  if (filter.completed !== undefined) { q += ' AND completed = ?'; params.push(filter.completed ? 1 : 0); }
  q += ' ORDER BY updated_at DESC';
  return db.prepare(q).all(...params);
}

export function getLocalProjectById(id) {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) || null;
}

export function upsertProject(project) {
  const db = getDb();
  const now = Date.now();
  db.prepare(`INSERT OR REPLACE INTO projects (id, name, type, level, priority, value, dossier_id, dossier_name, date, completed, url, notion_synced, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1,
      COALESCE((SELECT created_at FROM projects WHERE id = ?), ?), ?)`)
    .run(
      project.id,
      project.name || 'Sans nom',
      project.type || 'Lead',
      project.level || '',
      project.priority || '',
      project.value ?? null,
      project.dossier_id || project.dossierId || null,
      project.dossier_name || project.dossierName || null,
      project.date || null,
      project.completed ? 1 : 0,
      project.url || null,
      project.id, now, now
    );
}

export function updateProjectField(id, field, value) {
  const db = getDb();
  const now = Date.now();
  const allowedFields = ['name', 'type', 'level', 'priority', 'value', 'dossier_id', 'dossier_name', 'date', 'completed', 'url'];
  if (!allowedFields.includes(field)) throw new Error(`Field not allowed: ${field}`);
  db.prepare(`UPDATE projects SET ${field} = ?, notion_synced = 0, updated_at = ? WHERE id = ?`).run(value, now, id);
  addToSyncQueue(`update_project_${field}`, 'project', id, { field, value });
}

export function createProjectLocal(project) {
  const db = getDb();
  const now = Date.now();
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(`INSERT INTO projects (id, name, type, level, priority, value, dossier_id, dossier_name, url, notion_synced, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)`)
    .run(id, project.name, project.type || 'Lead', project.level || 'Prise de connaissance', project.priority || '', project.value || null,
      project.dossier_id || null, project.dossier_name || null, now, now);
  addToSyncQueue('create_project', 'project', id, project);
  return getLocalProjectById(id);
}

// ==================== LOCAL-FIRST: TASKS ====================

export function getLocalTasks(filter = {}) {
  const db = getDb();
  let q = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  if (filter.project_id) { q += ' AND project_id = ?'; params.push(filter.project_id); }
  if (filter.dossier_id) { q += ' AND dossier_id = ?'; params.push(filter.dossier_id); }
  if (filter.completed !== undefined) { q += ' AND completed = ?'; params.push(filter.completed ? 1 : 0); }
  if (filter.assignee) { q += ' AND assignee = ?'; params.push(filter.assignee); }
  q += ' ORDER BY COALESCE(ordre, 999999) ASC, created_at ASC';
  return db.prepare(q).all(...params);
}

export function getLocalTaskById(id) {
  return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) || null;
}

export function createTaskLocal(task) {
  const db = getDb();
  const now = Date.now();
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(`INSERT INTO tasks (id, name, completed, project_id, dossier_id, dossier_name, date, assignee, comments, ordre, task_type, task_time, task_duration, url, notion_synced, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)`)
    .run(
      id,
      task.name || 'Sans nom',
      task.project_id || task.projectId || null,
      task.dossier_id || task.dossierId || null,
      task.dossier_name || task.dossierName || null,
      task.date || null,
      task.assignee || null,
      task.comments || '',
      task.ordre ?? null,
      task.task_type || task.taskType || null,
      task.task_time || task.taskTime || null,
      task.task_duration || task.taskDuration || 20,
      now, now
    );
  addToSyncQueue('create_task', 'task', id, {
    name: task.name,
    project_id: task.project_id || task.projectId || null,
    dossier_id: task.dossier_id || task.dossierId || null,
    date: task.date || null,
    assignee: task.assignee || null,
    comments: task.comments || '',
    ordre: task.ordre ?? null,
    task_type: task.task_type || task.taskType || null,
    task_time: task.task_time || task.taskTime || null,
  });
  return getLocalTaskById(id);
}

export function updateTaskLocal(id, updates) {
  const db = getDb();
  const now = Date.now();
  const allowedFields = ['name', 'completed', 'project_id', 'dossier_id', 'dossier_name', 'date', 'assignee', 'comments', 'ordre', 'task_type', 'task_time', 'task_duration'];
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      sets.push(`${key} = ?`);
      params.push(val);
    }
  }
  if (sets.length === 0) return null;
  sets.push('notion_synced = 0', 'updated_at = ?');
  params.push(now, id);
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  addToSyncQueue('update_task', 'task', id, updates);
  return getLocalTaskById(id);
}

export function completeTaskLocal(id) {
  const db = getDb();
  const now = Date.now();
  const task = getLocalTaskById(id);
  if (!task) return null;
  db.prepare('UPDATE tasks SET completed = 1, notion_synced = 0, updated_at = ? WHERE id = ?').run(now, id);
  addToSyncQueue('complete_task', 'task', id, { completed: true });
  return task.name;
}

export function upsertTask(task) {
  const db = getDb();
  const now = Date.now();
  // Skip if local changes not yet pushed (notion_synced=0)
  const existing = db.prepare('SELECT notion_synced FROM tasks WHERE id = ?').get(task.id);
  if (existing && existing.notion_synced === 0) return;
  db.prepare(`INSERT OR REPLACE INTO tasks (id, name, completed, project_id, dossier_id, dossier_name, date, assignee, comments, ordre, url, notion_synced, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1,
      COALESCE((SELECT created_at FROM tasks WHERE id = ?), ?), ?)`)
    .run(
      task.id,
      task.name || 'Sans nom',
      task.completed ? 1 : 0,
      task.project_id || task.projectId || null,
      task.dossier_id || task.dossierId || null,
      task.dossier_name || task.dossierName || null,
      task.date || null,
      task.assignee || null,
      task.comments || task.note || '',
      task.ordre ?? null,
      task.url || null,
      task.id, now, now
    );
}

// ==================== LOCAL-FIRST: DOSSIERS ====================

export function getLocalDossiers() {
  return getDb().prepare('SELECT * FROM dossiers ORDER BY name ASC').all();
}

export function getLocalDossierById(id) {
  return getDb().prepare('SELECT * FROM dossiers WHERE id = ?').get(id) || null;
}

export function upsertDossier(dossier) {
  const db = getDb();
  const now = Date.now();
  db.prepare(`INSERT OR REPLACE INTO dossiers (id, name, drive_url, gemini_url, phone, email, status, url, notion_synced, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
    .run(
      dossier.id,
      dossier.name || 'Sans nom',
      dossier.drive_url || dossier.driveUrl || null,
      dossier.gemini_url || dossier.geminiUrl || null,
      dossier.phone || null,
      dossier.email || null,
      dossier.status || null,
      dossier.url || null,
      now
    );
}

// ==================== LOCAL-FIRST: SYNC QUEUE ====================

export function addToSyncQueue(operation, entityType, entityId, payload = {}) {
  getDb().prepare('INSERT INTO sync_queue (operation, entity_type, entity_id, payload, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(operation, entityType, entityId, JSON.stringify(payload), 'pending', Date.now());
}

export function getPendingSyncItems(limit = 10) {
  return getDb().prepare('SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC LIMIT ?').all('pending', limit);
}

export function markSyncDone(id) {
  getDb().prepare('UPDATE sync_queue SET status = ?, processed_at = ? WHERE id = ?').run('done', Date.now(), id);
}

export function markSyncError(id, errorMessage) {
  getDb().prepare('UPDATE sync_queue SET status = ?, error_message = ?, retries = retries + 1 WHERE id = ?').run('error', errorMessage, id);
}

export function retryFailedSync() {
  getDb().prepare("UPDATE sync_queue SET status = 'pending' WHERE status = 'error' AND retries < 5").run();
}

export function getSyncQueueStats() {
  const db = getDb();
  const pending = db.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'").get().count;
  const error = db.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'error'").get().count;
  const done = db.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'done'").get().count;
  return { pending, error, done };
}

// ==================== LOCAL-FIRST: BROKER CODES ====================

export function getLocalBrokerCodes() {
  return getDb().prepare('SELECT * FROM broker_codes ORDER BY compagnie ASC').all();
}

export function getLocalBrokerCodeById(id) {
  return getDb().prepare('SELECT * FROM broker_codes WHERE id = ?').get(id) || null;
}

export function upsertBrokerCode(code) {
  const db = getDb();
  const now = Date.now();
  db.prepare(`INSERT OR REPLACE INTO broker_codes (id, compagnie, type, identifiant, mot_de_passe, url, commentaires, notion_url, notion_synced, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
    .run(
      code.id,
      code.compagnie || code.company || '',
      code.type || '',
      code.identifiant || code.login || '',
      code.mot_de_passe || code.password || '',
      code.url || '',
      code.commentaires || code.comments || '',
      code.notion_url || code.notionUrl || '',
      now
    );
}

export function createBrokerCodeLocal(code) {
  const db = getDb();
  const now = Date.now();
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(`INSERT INTO broker_codes (id, compagnie, type, identifiant, mot_de_passe, url, commentaires, notion_url, notion_synced, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '', 0, ?)`)
    .run(id, code.compagnie || '', code.type || '', code.identifiant || '', code.mot_de_passe || '', code.url || '', code.commentaires || '', now);
  addToSyncQueue('create_broker_code', 'broker_code', id, {
    compagnie: code.compagnie, type: code.type, identifiant: code.identifiant,
    mot_de_passe: code.mot_de_passe, url: code.url, commentaires: code.commentaires
  });
  return getLocalBrokerCodeById(id);
}

export function updateBrokerCodeLocal(id, updates) {
  const db = getDb();
  const now = Date.now();
  const allowedFields = ['compagnie', 'type', 'identifiant', 'mot_de_passe', 'url', 'commentaires'];
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(updates)) {
    if (allowedFields.includes(key)) { sets.push(`${key} = ?`); params.push(val); }
  }
  if (sets.length === 0) return null;
  sets.push('notion_synced = 0', 'updated_at = ?');
  params.push(now, id);
  db.prepare(`UPDATE broker_codes SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  addToSyncQueue('update_broker_code', 'broker_code', id, updates);
  return getLocalBrokerCodeById(id);
}

export function deleteBrokerCodeLocal(id) {
  getDb().prepare('DELETE FROM broker_codes WHERE id = ?').run(id);
  addToSyncQueue('delete_broker_code', 'broker_code', id, { archived: true });
}

// ==================== PROJECT NOTES ====================

export function addProjectNote(projectId, note) {
  const db = getDb();
  const project = db.prepare('SELECT notes FROM projects WHERE id = ?').get(projectId);
  const existing = project?.notes || '';
  const newNotes = existing ? `${existing}\n${note}` : note;
  db.prepare('UPDATE projects SET notes = ?, notion_synced = 0, updated_at = ? WHERE id = ?')
    .run(newNotes, Date.now(), projectId);
  addToSyncQueue('update_project_notes', 'project', projectId, { notes: newNotes });
  return newNotes;
}

export function getProjectNotes(projectId) {
  const project = getDb().prepare('SELECT notes FROM projects WHERE id = ?').get(projectId);
  return project?.notes || '';
}

// ==================== LOCAL-FIRST: CONTACTS ====================

export function getLocalContacts(filter = {}) {
  const db = getDb();
  let q = 'SELECT * FROM contacts WHERE 1=1';
  const params = [];
  if (filter.dossier_id) { q += ' AND dossier_id = ?'; params.push(filter.dossier_id); }
  if (filter.status) { q += ' AND status = ?'; params.push(filter.status); }
  q += ' ORDER BY name ASC';
  return db.prepare(q).all(...params);
}

export function getLocalContactById(id) {
  return getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(id) || null;
}

export function upsertContact(contact) {
  const db = getDb();
  const now = Date.now();
  db.prepare(`INSERT OR REPLACE INTO contacts (id, name, email, phone, company, tags, status, dossier_id, url, notion_synced, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1,
      COALESCE((SELECT created_at FROM contacts WHERE id = ?), ?), ?)`)
    .run(contact.id, contact.name || 'Inconnu', contact.email || null, contact.phone || null,
      contact.company || null, JSON.stringify(contact.tags || []), contact.status || null,
      contact.dossier_id || contact.dossierId || null, contact.url || null,
      contact.id, now, now);
}

// ==================== LOCAL-FIRST: CONTRACTS ====================

export function getLocalContracts(filter = {}) {
  const db = getDb();
  let q = 'SELECT * FROM contracts WHERE 1=1';
  const params = [];
  if (filter.dossier_id) { q += ' AND dossier_id = ?'; params.push(filter.dossier_id); }
  if (filter.desactive !== undefined) { q += ' AND desactive = ?'; params.push(filter.desactive ? 1 : 0); }
  q += ' ORDER BY name ASC';
  return db.prepare(q).all(...params);
}

export function getLocalContractById(id) {
  return getDb().prepare('SELECT * FROM contracts WHERE id = ?').get(id) || null;
}

export function getLocalContractsByDossier(dossierId) {
  return getDb().prepare('SELECT * FROM contracts WHERE dossier_id = ? ORDER BY name ASC').all(dossierId);
}

export function getLocalContractsByProject(projectId) {
  return getDb().prepare('SELECT * FROM contracts WHERE project_id = ? ORDER BY name ASC').all(projectId);
}

// ==================== PENSE-BÊTES ====================

export function addPenseBete(content) {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO pense_betes (content, created_at) VALUES (?, ?)');
  return stmt.run(content, Date.now());
}

export function getPenseBetes(includeCompleted = false) {
  const db = getDb();
  if (includeCompleted) {
    return db.prepare('SELECT * FROM pense_betes ORDER BY completed ASC, created_at DESC').all();
  }
  return db.prepare('SELECT * FROM pense_betes WHERE completed = 0 ORDER BY created_at DESC').all();
}

export function completePenseBete(id) {
  const db = getDb();
  return db.prepare('UPDATE pense_betes SET completed = 1, completed_at = ? WHERE id = ?').run(Date.now(), id);
}

export function deletePenseBete(id) {
  const db = getDb();
  return db.prepare('DELETE FROM pense_betes WHERE id = ?').run(id);
}

// ==================== SETTINGS & EMAIL ANALYSES ====================
export function getSetting(key) {
  return getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || null;
}

export function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, value, Date.now());
}

export function getEmailAnalyses({ limit = 100, offset = 0, category = null, unreadOnly = false, batchId = null, contactEmail = null }) {
  let query = 'SELECT * FROM email_analyses WHERE 1=1';
  const params = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (unreadOnly) { query += ' AND is_read = 0'; }
  if (batchId) { query += ' AND analysis_batch = ?'; params.push(batchId); }
  if (contactEmail) {
    query += ` AND (LOWER(from_email) LIKE ? OR LOWER(to_email) LIKE ?)`;
    const emailFilter = `%${contactEmail.toLowerCase()}%`;
    params.push(emailFilter, emailFilter);
  }
  query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return getDb().prepare(query).all(...params);
}

export function insertEmailAnalysis(data) {
  return getDb().prepare(`
    INSERT OR IGNORE INTO email_analyses
    (message_id, thread_id, from_email, from_name, to_email, subject, snippet, date,
     category, action_required, summary, has_attachments, attachment_summary, analysis_batch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.message_id, data.thread_id, data.from_email, data.from_name, data.to_email,
    data.subject, data.snippet, data.date, data.category, data.action_required,
    data.summary, data.has_attachments ? 1 : 0, data.attachment_summary, data.analysis_batch
  );
}

export function markEmailRead(messageId) {
  getDb().prepare('UPDATE email_analyses SET is_read = 1 WHERE message_id = ?').run(messageId);
}

export function assignEmailToProject(messageId, projectId, projectName) {
  getDb().prepare('UPDATE email_analyses SET project_id = ?, project_name = ? WHERE message_id = ?').run(projectId, projectName, messageId);
}

export function assignEmailToDossier(messageId, dossierId, dossierName) {
  getDb().prepare('UPDATE email_analyses SET dossier_id = ?, dossier_name = ? WHERE message_id = ?').run(dossierId, dossierName, messageId);
}

export function deleteEmailAnalysis(messageId) {
  getDb().prepare('DELETE FROM email_analyses WHERE message_id = ?').run(messageId);
}

export function addKnowledgeFromEmail(data) {
  const db = getDb();
  return db.prepare('INSERT INTO knowledge (type, titre, contenu, assureur, produit, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(data.type || 'email_assureur', data.titre, data.contenu, data.assureur || null, data.produit || null, Date.now());
}

export function upsertContract(contract) {
  const db = getDb();
  const now = Date.now();
  db.prepare(`INSERT OR REPLACE INTO contracts (id, name, type_assurance, cie_details, product_type, date_effet, date_signature, date_resiliation, desactive, details, dossier_id, project_id, compagnie_id, code_assurance_id, souscripteur_id, last_edited, url, notion_synced, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1,
      COALESCE((SELECT created_at FROM contracts WHERE id = ?), ?), ?)`)
    .run(contract.id, contract.name || 'Sans nom', contract.type_assurance || contract.typeAssurance || null,
      contract.cie_details || contract.cieDetails || null, contract.product_type || contract.productType || null,
      contract.date_effet || contract.dateEffet || null, contract.date_signature || contract.dateSignature || null,
      contract.date_resiliation || contract.dateResiliation || null, contract.desactive ? 1 : 0,
      contract.details || null, contract.dossier_id || contract.dossierId || null,
      contract.project_id || contract.projectId || null,
      contract.compagnie_id || contract.compagnieId || null,
      contract.code_assurance_id || contract.codeAssuranceId || null,
      contract.souscripteur_id || contract.souscripteurId || null,
      contract.last_edited || contract.lastEdited || null,
      contract.url || null, contract.id, now, now);
}

export function createContractLocal(data) {
  const db = getDb();
  const now = Date.now();
  const localId = `local_${now}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`INSERT INTO contracts (id, name, type_assurance, date_effet, date_signature, desactive, details, dossier_id, compagnie_id, compagnie_name, code_assurance_id, souscripteur_id, filiale_id, project_id, commission_2026, cotisation_annuelle, gdrive_url, url, notion_synced, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)`)
    .run(localId, data.name || 'Sans nom', data.type_assurance || null,
      data.date_effet || null, data.date_signature || null,
      data.details || null, data.dossier_id || null,
      data.compagnie_id || null, data.compagnie_name || null,
      data.code_assurance_id || null, data.souscripteur_id || null,
      data.filiale_id || null,
      data.project_id || null, data.commission_2026 || null,
      data.cotisation_annuelle || null, data.gdrive_url || null,
      now, now);

  // Enqueue sync to Notion
  db.prepare(`INSERT INTO sync_queue (operation, entity_type, entity_id, payload, status, created_at)
    VALUES ('create_contract', 'contract', ?, ?, 'pending', ?)`)
    .run(localId, JSON.stringify(data), now);

  return db.prepare('SELECT * FROM contracts WHERE id = ?').get(localId);
}

// ==================== COMMISSIONS (BORDEREAUX) ====================

export function insertCommission(data) {
  const db = getDb();
  return db.prepare(`INSERT INTO commissions
    (contract_id, contract_number, client_name, ref_cie, entity, nature, nature_code, echeance, period_date, prime, assiette, commission, net_du, bordereau_file, bordereau_date, code_support, matched, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(data.contract_id || null, data.contract_number, data.client_name || null,
      data.ref_cie || null, data.entity || null, data.nature || null, data.nature_code || null,
      data.echeance || null, data.period_date || null,
      data.prime || 0, data.assiette || 0, data.commission || 0, data.net_du || 0,
      data.bordereau_file || null, data.bordereau_date || null, data.code_support || null,
      data.matched ? 1 : 0, Date.now());
}

export function insertCommissionsBatch(rows) {
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO commissions
    (contract_id, contract_number, client_name, ref_cie, entity, nature, nature_code, echeance, period_date, prime, assiette, commission, net_du, bordereau_file, bordereau_date, code_support, matched, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const now = Date.now();
  const insertMany = db.transaction((rows) => {
    for (const d of rows) {
      stmt.run(d.contract_id || null, d.contract_number, d.client_name || null,
        d.ref_cie || null, d.entity || null, d.nature || null, d.nature_code || null,
        d.echeance || null, d.period_date || null,
        d.prime || 0, d.assiette || 0, d.commission || 0, d.net_du || 0,
        d.bordereau_file || null, d.bordereau_date || null, d.code_support || null,
        d.matched ? 1 : 0, now);
    }
  });
  insertMany(rows);
}

export function getCommissions({ contractId, contractNumber, entity, source, periodFrom, periodTo, matchedOnly, limit = 500, offset = 0 } = {}) {
  const db = getDb();
  let q = `SELECT cm.*, c.dossier_id, c.type_assurance, c.compagnie_name, d.name as dossier_name
    FROM commissions cm
    LEFT JOIN contracts c ON cm.contract_id = c.id
    LEFT JOIN dossiers d ON c.dossier_id = d.id
    WHERE 1=1`;
  const params = [];
  if (contractId) { q += ' AND cm.contract_id = ?'; params.push(contractId); }
  if (contractNumber) { q += ' AND cm.contract_number LIKE ?'; params.push(`%${contractNumber}%`); }
  if (entity) { q += ' AND cm.entity = ?'; params.push(entity); }
  if (source) { q += ' AND cm.source = ?'; params.push(source); }
  if (periodFrom) { q += ' AND cm.period_date >= ?'; params.push(periodFrom); }
  if (periodTo) { q += ' AND cm.period_date <= ?'; params.push(periodTo); }
  if (matchedOnly !== undefined) { q += ' AND cm.matched = ?'; params.push(matchedOnly ? 1 : 0); }
  q += ' ORDER BY cm.period_date DESC, cm.commission DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return db.prepare(q).all(...params);
}

export function getCommissionStats({ periodFrom, periodTo, source, confirmedOnly } = {}) {
  const db = getDb();
  let q = `SELECT
    COUNT(*) as total_lines,
    COUNT(DISTINCT cm.contract_number) as unique_contracts,
    COUNT(DISTINCT cm.client_name) as unique_clients,
    COUNT(DISTINCT cm.source) as nb_sources,
    ROUND(SUM(cm.commission), 2) as total_commission,
    ROUND(SUM(cm.prime), 2) as total_prime,
    ROUND(SUM(CASE WHEN bi.bank_confirmed = 1 THEN cm.commission ELSE 0 END), 2) as confirmed_commission,
    ROUND(SUM(CASE WHEN bi.bank_confirmed = 0 OR bi.bank_confirmed IS NULL THEN cm.commission ELSE 0 END), 2) as unconfirmed_commission,
    SUM(CASE WHEN cm.matched = 1 THEN 1 ELSE 0 END) as matched_contracts_count,
    SUM(CASE WHEN cm.matched = 0 THEN 1 ELSE 0 END) as unmatched_contracts_count
    FROM commissions cm
    LEFT JOIN bordereau_imports bi ON cm.bordereau_hash = bi.content_hash
    WHERE 1=1`;
  const params = [];
  if (source) { q += ' AND cm.source = ?'; params.push(source); }
  if (periodFrom) { q += ' AND cm.period_start >= ?'; params.push(periodFrom); }
  if (periodTo) { q += ' AND cm.period_start <= ?'; params.push(periodTo); }
  if (confirmedOnly) { q += ' AND bi.bank_confirmed = 1'; }
  return db.prepare(q).get(...params);
}

export function getCommissionsBySource({ periodFrom, periodTo, confirmedOnly } = {}) {
  const db = getDb();
  let q = `SELECT
    COALESCE(cm.source, 'unknown') as source,
    ROUND(SUM(cm.commission), 2) as total_commission,
    ROUND(SUM(cm.prime), 2) as total_prime,
    COUNT(*) as nb_lines,
    COUNT(DISTINCT cm.contract_number) as nb_contracts,
    ROUND(SUM(CASE WHEN bi.bank_confirmed = 1 THEN cm.commission ELSE 0 END), 2) as confirmed_commission,
    ROUND(SUM(CASE WHEN bi.bank_confirmed = 0 OR bi.bank_confirmed IS NULL THEN cm.commission ELSE 0 END), 2) as unconfirmed_commission,
    SUM(CASE WHEN bi.bank_confirmed = 1 THEN 1 ELSE 0 END) as confirmed_lines,
    SUM(CASE WHEN bi.bank_confirmed = 0 OR bi.bank_confirmed IS NULL THEN 1 ELSE 0 END) as unconfirmed_lines
    FROM commissions cm
    LEFT JOIN bordereau_imports bi ON cm.bordereau_hash = bi.content_hash
    WHERE 1=1`;
  const params = [];
  if (periodFrom) { q += ' AND cm.period_start >= ?'; params.push(periodFrom); }
  if (periodTo) { q += ' AND cm.period_start <= ?'; params.push(periodTo); }
  if (confirmedOnly) { q += ' AND bi.bank_confirmed = 1'; }
  q += ' GROUP BY cm.source ORDER BY confirmed_commission DESC';
  return db.prepare(q).all(...params);
}

export function getCommissionsByMonth({ year, source } = {}) {
  const db = getDb();
  let q = `SELECT
    substr(period_date, 4, 2) as month,
    COALESCE(source, entity) as source,
    SUM(commission) as total_commission,
    SUM(prime) as total_prime,
    COUNT(*) as nb_lines,
    COUNT(DISTINCT contract_number) as nb_contracts
    FROM commissions WHERE 1=1`;
  const params = [];
  if (year) { q += ' AND period_date LIKE ?'; params.push(`%/${year}`); }
  if (source) { q += ' AND (source = ? OR entity = ?)'; params.push(source, source); }
  q += ' GROUP BY month, source ORDER BY month ASC';
  return db.prepare(q).all(...params);
}

export function getCommissionsByContract({ periodFrom, periodTo, source, confirmedOnly } = {}) {
  const db = getDb();
  let q = `SELECT
    cm.contract_number, cm.client_name, cm.entity, cm.matched, cm.contract_id,
    COALESCE(cm.source, cm.entity) as source, cm.compagnie,
    c.type_assurance, c.commission_2026 as estimated_commission, c.dossier_id,
    c.date_resiliation, c.desactive,
    d.name as dossier_name,
    ROUND(SUM(cm.commission), 2) as real_commission,
    ROUND(SUM(cm.prime), 2) as real_prime,
    COUNT(*) as nb_lines,
    MIN(cm.period_start) as first_period,
    MAX(cm.period_start) as last_period,
    ROUND(SUM(CASE WHEN cm.period_start >= '2025-01-01' AND cm.period_start < '2026-01-01' THEN cm.commission ELSE 0 END), 2) as total_2025,
    ROUND(SUM(CASE WHEN cm.period_start >= '2026-01-01' AND cm.period_start < '2027-01-01' THEN cm.commission ELSE 0 END), 2) as total_2026
    FROM commissions cm
    LEFT JOIN contracts c ON cm.contract_id = c.id
    LEFT JOIN dossiers d ON c.dossier_id = d.id
    LEFT JOIN bordereau_imports bi ON cm.bordereau_hash = bi.content_hash
    WHERE 1=1`;
  const params = [];
  if (confirmedOnly) { q += ' AND bi.bank_confirmed = 1'; }
  if (periodFrom) { q += ' AND cm.period_start >= ?'; params.push(periodFrom); }
  if (periodTo) { q += ' AND cm.period_start <= ?'; params.push(periodTo); }
  if (source) { q += ' AND cm.source = ?'; params.push(source); }
  q += ` GROUP BY cm.contract_number ORDER BY real_commission DESC`;
  return db.prepare(q).all(...params);
}

export function getCommissionsByContractMonth(contractNumber) {
  const db = getDb();
  return db.prepare(`SELECT
    substr(period_start, 1, 7) as month,
    COALESCE(source, entity) as source,
    compagnie,
    ROUND(SUM(commission), 2) as total_commission,
    ROUND(SUM(prime), 2) as total_prime,
    COUNT(*) as nb_lines
    FROM commissions
    WHERE contract_number = ?
    GROUP BY month
    ORDER BY month ASC
  `).all(contractNumber);
}

export function deleteCommissionsByBordereau(contentHash) {
  const db = getDb();
  const delCommissions = db.prepare('DELETE FROM commissions WHERE bordereau_hash = ?');
  const delImport = db.prepare('DELETE FROM bordereau_imports WHERE content_hash = ?');
  const txn = db.transaction((hash) => {
    const r = delCommissions.run(hash);
    delImport.run(hash);
    return r;
  });
  return txn(contentHash);
}

export function getUnconfirmedBordereaux({ source } = {}) {
  const db = getDb();
  let q = `SELECT
    bi.*,
    ROUND(bi.total_commission, 2) as total_commission,
    COUNT(cm.id) as nb_detail_lines
    FROM bordereau_imports bi
    LEFT JOIN commissions cm ON cm.bordereau_hash = bi.content_hash
    WHERE bi.bank_confirmed = 0`;
  const params = [];
  if (source) { q += ' AND bi.source = ?'; params.push(source); }
  q += ' GROUP BY bi.id ORDER BY bi.source, bi.period_start ASC';
  return db.prepare(q).all(...params);
}

export function getOrphanContracts({ source } = {}) {
  const db = getDb();
  let q = `SELECT
    cm.contract_number,
    cm.client_name,
    COALESCE(cm.source, cm.entity) as source,
    cm.compagnie,
    COUNT(*) as nb_lines,
    ROUND(SUM(cm.commission), 2) as total_commission,
    ROUND(SUM(cm.prime), 2) as total_prime,
    MIN(cm.period_start) as first_period,
    MAX(cm.period_start) as last_period,
    ROUND(SUM(CASE WHEN cm.period_start >= '2025-01-01' AND cm.period_start < '2026-01-01' THEN cm.commission ELSE 0 END), 2) as total_2025,
    ROUND(SUM(CASE WHEN cm.period_start >= '2026-01-01' AND cm.period_start < '2027-01-01' THEN cm.commission ELSE 0 END), 2) as total_2026
    FROM commissions cm
    WHERE cm.matched = 0
    AND cm.contract_number IS NOT NULL
    AND cm.contract_number != ''
    AND cm.contract_number NOT IN ('ENCOURS_GLOBAL', 'TOTAL')`;
  const params = [];
  if (source) { q += ' AND cm.source = ?'; params.push(source); }
  q += ` GROUP BY cm.contract_number ORDER BY total_commission DESC`;
  return db.prepare(q).all(...params);
}

export function getImportedBordereaux() {
  const db = getDb();
  // Try bordereau_imports table first (v2), fallback to commissions aggregation
  const hasTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bordereau_imports'").get();
  if (hasTable) {
    const fromTable = db.prepare(`SELECT * FROM bordereau_imports ORDER BY imported_at DESC`).all();
    if (fromTable.length > 0) return fromTable;
  }
  return db.prepare(`SELECT bordereau_file as filename, bordereau_file as content_hash, entity as source, bordereau_date,
    COUNT(*) as nb_lines, SUM(commission) as total_commission,
    COUNT(DISTINCT contract_number) as nb_contracts,
    MIN(created_at) as imported_at
    FROM commissions GROUP BY bordereau_file ORDER BY bordereau_date DESC`).all();
}

export function getImportReports() {
  const db = getDb();
  const hasTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='import_reports'").get();
  if (!hasTable) return [];
  return db.prepare('SELECT * FROM import_reports ORDER BY created_at DESC').all();
}

// ==================== RELEVÉS BANCAIRES / BORDEREAUX MANQUANTS ====================

export function getMissingBordereaux({ source } = {}) {
  const db = getDb();
  const hasTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bank_commission_payments'").get();
  if (!hasTable) return [];
  let q = `SELECT
    bcp.*,
    bi.filename as matched_filename,
    bi.nb_lines as matched_nb_lines
    FROM bank_commission_payments bcp
    LEFT JOIN bordereau_imports bi ON bcp.matched_bordereau_id = bi.id
    WHERE 1=1`;
  const params = [];
  if (source) { q += ' AND bcp.source = ?'; params.push(source); }
  q += ' ORDER BY bcp.source, bcp.date ASC';
  return db.prepare(q).all(...params);
}

export function getBankPaymentsByMonth() {
  const db = getDb();
  const hasTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bank_commission_payments'").get();
  if (!hasTable) return [];
  return db.prepare(`
    SELECT
      substr(date, 1, 7) as month,
      source,
      SUM(amount) as total,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'matched' THEN amount ELSE 0 END) as matched,
      SUM(CASE WHEN status = 'unmatched' THEN amount ELSE 0 END) as unmatched
    FROM bank_commission_payments
    GROUP BY month, source
    ORDER BY month, source
  `).all();
}

export function getMissingBordereauxStats() {
  const db = getDb();
  const hasTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bank_commission_payments'").get();
  if (!hasTable) return [];
  return db.prepare(`SELECT
    source,
    COUNT(*) as total_payments,
    ROUND(SUM(amount), 2) as total_amount,
    SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched_count,
    ROUND(SUM(CASE WHEN status = 'matched' THEN amount ELSE 0 END), 2) as matched_amount,
    SUM(CASE WHEN status = 'unmatched' THEN 1 ELSE 0 END) as missing_count,
    ROUND(SUM(CASE WHEN status = 'unmatched' THEN amount ELSE 0 END), 2) as missing_amount
    FROM bank_commission_payments
    GROUP BY source
    ORDER BY missing_amount DESC
  `).all();
}

export function runAutoMatch() {
  const db = getDb();

  const unmatched = db.prepare(`
    SELECT id, date, month, amount, source, source_detail
    FROM bank_commission_payments
    WHERE status = 'unmatched'
  `).all();

  if (unmatched.length === 0) return { matched: 0, total: 0 };

  const updatePayment = db.prepare(`
    UPDATE bank_commission_payments
    SET status = 'matched', matched_bordereau_id = ?, matched_amount = ?
    WHERE id = ?
  `);
  const updateBordereau = db.prepare(`
    UPDATE bordereau_imports SET bank_payment_id = ?, bank_confirmed = 1 WHERE id = ?
  `);

  function normalizeMonth(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
    if (/^\d{2}\/\d{2}$/.test(s)) { const [m, y] = s.split('/'); return `20${y}-${m}`; }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const p = s.split('/'); return `${p[2]}-${p[1]}`; }
    if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}`;
    return s.slice(0, 7);
  }

  const allBordereaux = db.prepare(`
    SELECT id, filename, stored_filename, source, total_commission, period_start, bank_confirmed
    FROM bordereau_imports
    WHERE bank_confirmed = 0
  `).all();

  let matched = 0;

  for (const pay of unmatched) {
    const payMonth = normalizeMonth(pay.month || pay.date);
    if (!payMonth) continue;

    const [y, m] = payMonth.split('-').map(Number);
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    const prevMonth = `${py}-${String(pm).padStart(2, '0')}`;

    let candidates = allBordereaux.filter(b => {
      if (b.bank_confirmed === 1) return false;
      if (b.source?.toLowerCase() !== pay.source?.toLowerCase()) return false;
      const bMonth = normalizeMonth(b.period_start);
      return bMonth === payMonth || bMonth === prevMonth;
    });

    if (pay.source?.toLowerCase() === 'abeille' && pay.source_detail && candidates.length > 1) {
      const isRetraite = pay.source_detail.toLowerCase().includes('retraite');
      const preferred = candidates.filter(c => {
        const fn = (c.stored_filename || c.filename || '').toLowerCase();
        return isRetraite ? fn.includes('retraite') : (fn.includes('epargne') || fn.includes('vie'));
      });
      if (preferred.length > 0) candidates = preferred;
    }

    candidates.sort((a, b) => Math.abs(a.total_commission - pay.amount) - Math.abs(b.total_commission - pay.amount));

    if (candidates.length > 0) {
      const best = candidates[0];
      const diff = Math.abs(best.total_commission - pay.amount);
      const pctDiff = pay.amount > 0 ? (diff / pay.amount) * 100 : 100;
      if (pctDiff < 10 || diff < 5) {
        updatePayment.run(best.id, best.total_commission, pay.id);
        updateBordereau.run(pay.id, best.id);
        best.bank_confirmed = 1;
        matched++;
      }
    }
  }

  return { matched, total: unmatched.length };
}

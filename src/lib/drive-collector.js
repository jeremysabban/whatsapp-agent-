/**
 * Drive Collector — Module central de collecte de documents vers le dossier A TRIER
 *
 * 3 sources : WhatsApp, Email (Gmail), Ordi (Downloads)
 * Toutes les pièces atterrissent dans le dossier A TRIER du Drive
 * Un tracking en base SQLite empêche les doublons
 */

import { google } from 'googleapis';
import { getGmailClient, isGmailConfigured } from './gmail-client.js';
import { getDb } from './database.js';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// === CONFIGURATION ===
const A_TRIER_FOLDER_ID = '1ADASs_pIx0j5hhJvrA8xUZl0t4rFyhJs';

// Extensions acceptées pour le scan Downloads
const ACCEPTED_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.csv',
  '.zip', '.rar', '.7z',
  '.txt', '.rtf', '.odt'
]);

// Domaines email à surveiller pour les PJ
const WATCHED_EMAIL_DOMAINS = [
  'april-partenaires.fr',
  'altima-assurances.fr',
  'april.fr',
  'hiscox.fr',
  'hiscox.com',
  'abeille-assurances.fr',
  'aviva.fr',
  'groupama.fr',
  'allianz.fr',
  'axa.fr',
  'generali.fr',
  'swisslife.fr',
  'maif.fr',
  'macif.fr',
  'matmut.fr',
  'mma.fr',
  'thelem-assurances.fr',
  'solucia-pj.fr',
  'noteforms.com',
  'april-on.fr'
];

// === DRIVE CLIENT ===
function getDriveClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth });
}

// === TRACKING TABLE ===
function ensureCollectorTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS collector_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      drive_file_id TEXT,
      drive_link TEXT,
      mimetype TEXT,
      file_size INTEGER DEFAULT 0,
      status TEXT DEFAULT 'uploaded',
      conversation_jid TEXT,
      conversation_name TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
      UNIQUE(source, source_id)
    )
  `);
}

function isAlreadyCollected(source, sourceId) {
  ensureCollectorTable();
  const db = getDb();
  const row = db.prepare('SELECT id FROM collector_log WHERE source = ? AND source_id = ?').get(source, sourceId);
  return !!row;
}

function logCollection(entry) {
  ensureCollectorTable();
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO collector_log (source, source_id, filename, drive_file_id, drive_link, mimetype, file_size, status, conversation_jid, conversation_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.source, entry.sourceId, entry.filename,
    entry.driveFileId || null, entry.driveLink || null,
    entry.mimetype || null, entry.fileSize || 0,
    entry.status || 'uploaded',
    entry.conversationJid || null, entry.conversationName || null
  );
}

// === UPLOAD TO A TRIER ===
async function uploadToDriveATrier(filename, mimeType, fileBuffer) {
  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [A_TRIER_FOLDER_ID],
    },
    media: {
      mimeType: mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, webViewLink, size',
  });

  return {
    driveFileId: res.data.id,
    driveLink: res.data.webViewLink,
    size: res.data.size,
  };
}

// ============================================================
// SOURCE 1 : WHATSAPP — Bulk upload tous les docs d'un contact
// ============================================================
export async function collectWhatsAppDocs(conversationJid) {
  ensureCollectorTable();
  const db = getDb();

  // Get all documents for this conversation (excluding audio and already processed)
  const docs = db.prepare(`
    SELECT d.*,
      COALESCE(c.notion_dossier_name, c.custom_name, c.whatsapp_name, c.name) as conversation_name
    FROM documents d
    JOIN conversations c ON d.conversation_jid = c.jid
    WHERE d.conversation_jid = ?
    AND d.mimetype NOT LIKE '%audio%'
    AND d.mimetype NOT LIKE '%ogg%'
    AND d.local_path IS NOT NULL
  `).all(conversationJid);

  const results = { uploaded: [], skipped: [], errors: [] };

  for (const doc of docs) {
    const sourceId = `wa_${doc.message_id || doc.id}`;

    // Skip if already collected
    if (isAlreadyCollected('whatsapp', sourceId)) {
      results.skipped.push({ filename: doc.filename, reason: 'already_collected' });
      continue;
    }

    try {
      // Resolve file path
      const fullPath = path.isAbsolute(doc.local_path)
        ? doc.local_path
        : path.join(process.cwd(), doc.local_path);

      if (!fs.existsSync(fullPath)) {
        results.errors.push({ filename: doc.filename, error: 'file_not_found' });
        continue;
      }

      const fileBuffer = fs.readFileSync(fullPath);
      const uploadName = doc.filename || path.basename(fullPath);
      const mimetype = doc.mimetype || 'application/octet-stream';

      const driveResult = await uploadToDriveATrier(uploadName, mimetype, fileBuffer);

      logCollection({
        source: 'whatsapp',
        sourceId,
        filename: uploadName,
        driveFileId: driveResult.driveFileId,
        driveLink: driveResult.driveLink,
        mimetype,
        fileSize: fileBuffer.length,
        conversationJid,
        conversationName: doc.conversation_name,
      });

      // Update document status in the documents table
      db.prepare("UPDATE documents SET status = 'telecharge' WHERE id = ?").run(doc.id);

      results.uploaded.push({
        filename: uploadName,
        driveLink: driveResult.driveLink,
        size: fileBuffer.length,
      });
    } catch (err) {
      console.error(`[COLLECTOR] WhatsApp upload error for ${doc.filename}:`, err.message);
      results.errors.push({ filename: doc.filename, error: err.message });
    }
  }

  console.log(`[COLLECTOR] WhatsApp: ${results.uploaded.length} uploaded, ${results.skipped.length} skipped, ${results.errors.length} errors`);
  return results;
}

// ============================================================
// SOURCE 2 : EMAIL — Scan Gmail pour les PJ des compagnies
// ============================================================
export async function collectEmailAttachments() {
  if (!isGmailConfigured()) {
    console.log('[COLLECTOR] Gmail not configured, skipping email scan');
    return { uploaded: [], skipped: [], errors: [] };
  }

  ensureCollectorTable();
  const gmail = getGmailClient();
  const results = { uploaded: [], skipped: [], errors: [] };

  try {
    // Search for emails with attachments from watched domains (last 60 min to cover 30min cron overlap)
    const after = Math.floor(Date.now() / 1000) - (60 * 60);
    const domainQuery = WATCHED_EMAIL_DOMAINS.map(d => `from:${d}`).join(' OR ');
    const query = `(${domainQuery}) has:attachment after:${after} -label:PJ_Drive`;

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 30,
    });

    if (!res.data.messages) {
      console.log('[COLLECTOR] Email: no new messages with attachments');
      return results;
    }

    // Ensure label exists
    let label = null;
    try {
      const labels = await gmail.users.labels.list({ userId: 'me' });
      label = labels.data.labels.find(l => l.name === 'PJ_Drive');
      if (!label) {
        const created = await gmail.users.labels.create({
          userId: 'me',
          requestBody: { name: 'PJ_Drive', labelListVisibility: 'labelShow', messageListVisibility: 'show' },
        });
        label = created.data;
      }
    } catch (e) {
      console.error('[COLLECTOR] Label creation error:', e.message);
    }

    for (const msg of res.data.messages) {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = detail.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const dateStr = headers.find(h => h.name === 'Date')?.value;
        const emailDate = dateStr ? new Date(dateStr) : new Date();
        const datePrefix = emailDate.toISOString().slice(0, 10);

        // Extract domain for prefix
        const domainMatch = from.match(/@([^>\s]+)/);
        const domainPrefix = domainMatch ? domainMatch[1].split('.')[0] : 'email';

        // Find attachments
        const attachments = findAttachmentParts(detail.data.payload.parts || [detail.data.payload]);

        for (const att of attachments) {
          const sourceId = `gmail_${msg.id}_${att.partId}`;

          if (isAlreadyCollected('email', sourceId)) {
            results.skipped.push({ filename: att.filename, reason: 'already_collected' });
            continue;
          }

          // Skip tiny files (signatures, logos)
          if (att.size < 5000 && /\.(jpg|jpeg|png|gif)$/i.test(att.filename)) {
            continue;
          }

          try {
            const attachmentData = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: msg.id,
              id: att.attachmentId,
            });

            const buffer = Buffer.from(attachmentData.data.data, 'base64url');
            const uploadName = `${datePrefix}_${domainPrefix}_${att.filename}`;

            const driveResult = await uploadToDriveATrier(uploadName, att.mimeType, buffer);

            logCollection({
              source: 'email',
              sourceId,
              filename: uploadName,
              driveFileId: driveResult.driveFileId,
              driveLink: driveResult.driveLink,
              mimetype: att.mimeType,
              fileSize: buffer.length,
            });

            results.uploaded.push({
              filename: uploadName,
              driveLink: driveResult.driveLink,
              size: buffer.length,
              emailSubject: subject,
              emailFrom: from,
            });
          } catch (attErr) {
            results.errors.push({ filename: att.filename, error: attErr.message });
          }
        }

        // Label the email as processed
        if (label) {
          try {
            await gmail.users.messages.modify({
              userId: 'me',
              id: msg.id,
              requestBody: { addLabelIds: [label.id] },
            });
          } catch (labelErr) {
            console.error('[COLLECTOR] Label apply error:', labelErr.message);
          }
        }
      } catch (msgErr) {
        console.error('[COLLECTOR] Email message error:', msgErr.message);
        results.errors.push({ error: msgErr.message });
      }
    }
  } catch (err) {
    console.error('[COLLECTOR] Email scan error:', err.message);
    results.errors.push({ error: err.message });
  }

  console.log(`[COLLECTOR] Email: ${results.uploaded.length} uploaded, ${results.skipped.length} skipped, ${results.errors.length} errors`);
  return results;
}

// Helper: find attachments recursively in email parts
function findAttachmentParts(parts, result = []) {
  if (!parts) return result;
  for (const part of parts) {
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      result.push({
        partId: part.partId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
      });
    }
    if (part.parts) findAttachmentParts(part.parts, result);
  }
  return result;
}

// ============================================================
// SOURCE 3 : ORDI — Scan du dossier Downloads
// ============================================================
const DOWNLOADS_DIR = path.join(process.env.HOME || '/Users/jeremysabban', 'Downloads');

export async function collectDownloadsFolder(customDir = null) {
  ensureCollectorTable();
  const downloadsDir = customDir || DOWNLOADS_DIR;
  const results = { uploaded: [], skipped: [], errors: [] };

  if (!fs.existsSync(downloadsDir)) {
    console.log(`[COLLECTOR] Downloads dir not found: ${downloadsDir}`);
    return results;
  }

  try {
    const files = fs.readdirSync(downloadsDir);

    for (const filename of files) {
      const ext = path.extname(filename).toLowerCase();
      if (!ACCEPTED_EXTENSIONS.has(ext)) continue;

      const filePath = path.join(downloadsDir, filename);
      const stat = fs.statSync(filePath);

      // Skip directories
      if (stat.isDirectory()) continue;

      // Skip files older than 24h (only scan recent downloads)
      const fileAge = Date.now() - stat.mtimeMs;
      if (fileAge > 24 * 60 * 60 * 1000) continue;

      // Skip tiny files
      if (stat.size < 1000) continue;

      const sourceId = `dl_${filename}_${stat.mtimeMs}`;

      if (isAlreadyCollected('downloads', sourceId)) {
        results.skipped.push({ filename, reason: 'already_collected' });
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(filePath);
        const mimetype = getMimeType(ext);
        const datePrefix = new Date(stat.mtimeMs).toISOString().slice(0, 10);
        const uploadName = `${datePrefix}_ordi_${filename}`;

        const driveResult = await uploadToDriveATrier(uploadName, mimetype, fileBuffer);

        logCollection({
          source: 'downloads',
          sourceId,
          filename: uploadName,
          driveFileId: driveResult.driveFileId,
          driveLink: driveResult.driveLink,
          mimetype,
          fileSize: stat.size,
        });

        results.uploaded.push({
          filename: uploadName,
          driveLink: driveResult.driveLink,
          size: stat.size,
          originalPath: filePath,
        });
      } catch (uploadErr) {
        console.error(`[COLLECTOR] Downloads upload error for ${filename}:`, uploadErr.message);
        results.errors.push({ filename, error: uploadErr.message });
      }
    }
  } catch (err) {
    console.error('[COLLECTOR] Downloads scan error:', err.message);
    results.errors.push({ error: err.message });
  }

  console.log(`[COLLECTOR] Downloads: ${results.uploaded.length} uploaded, ${results.skipped.length} skipped, ${results.errors.length} errors`);
  return results;
}

function getMimeType(ext) {
  const map = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.txt': 'text/plain',
    '.rtf': 'application/rtf',
    '.odt': 'application/vnd.oasis.opendocument.text',
  };
  return map[ext] || 'application/octet-stream';
}

// ============================================================
// TRI SEMI-AUTO : Lister A TRIER + proposer classement
// ============================================================
export async function listATrier() {
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: `'${A_TRIER_FOLDER_ID}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, createdTime, webViewLink)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });

  return res.data.files || [];
}

export async function moveFileToDriveFolder(fileId, targetFolderId) {
  const drive = getDriveClient();

  // Get current parents to remove
  const file = await drive.files.get({
    fileId,
    fields: 'parents',
  });

  const previousParents = (file.data.parents || []).join(',');

  await drive.files.update({
    fileId,
    addParents: targetFolderId,
    removeParents: previousParents,
    fields: 'id, webViewLink',
  });

  // Update collector_log status
  const db = getDb();
  db.prepare("UPDATE collector_log SET status = 'classified' WHERE drive_file_id = ?").run(fileId);
}

export async function renameFileOnDrive(fileId, newName) {
  const drive = getDriveClient();
  await drive.files.update({
    fileId,
    requestBody: { name: newName },
  });
}

export async function deleteFileFromDrive(fileId) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });

  // Update collector_log
  const db = getDb();
  db.prepare("UPDATE collector_log SET status = 'deleted' WHERE drive_file_id = ?").run(fileId);
}

// ============================================================
// STATS
// ============================================================
export function getCollectorStats() {
  ensureCollectorTable();
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM collector_log').get();
  const bySource = db.prepare('SELECT source, COUNT(*) as count FROM collector_log GROUP BY source').all();
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM collector_log GROUP BY status').all();
  const recent = db.prepare('SELECT * FROM collector_log ORDER BY created_at DESC LIMIT 10').all();

  return { total: total.count, bySource, byStatus, recent };
}

export { A_TRIER_FOLDER_ID };

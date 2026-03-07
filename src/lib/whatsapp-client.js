import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, makeCacheableSignalKeyStore, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { upsertConversation, insertMessage, updateConversationLastMessage, incrementUnread, insertDocument, updateMessageMedia, forceUpdateName, upsertLabel, addLabelAssociation, removeLabelAssociation, deleteLabel, insertAgentLog, getConversations, getDb } from './database.js';
import { processSmartInput } from './gemini-brain.js';
import { scheduleReminder, addNoteToDossier, createTask, createProject, createTaskOnProject, getTasksReport, findProjectAndCreateTask, getCategoryReport, getDailyReport, completeTaskById } from './gemini-tools.js';

const AUTH_DIR = path.join(process.cwd(), 'data', 'auth');
const MEDIA_DIR = path.join(process.cwd(), 'data', 'media');
const DOCS_DIR = path.join(process.cwd(), 'data', 'documents');
const NOTIFICATIONS_PATH = path.join(process.cwd(), 'data', 'wa-notifications.json');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

const SIX_MONTHS_SEC = 6 * 30 * 24 * 60 * 60;
const SYNC_CUTOFF = Math.floor(Date.now() / 1000) - SIX_MONTHS_SEC;

const logger = pino({ level: 'info' });

// Use globalThis to persist state across Next.js hot reloads in development
const g = globalThis;
if (!g.__waState) {
  g.__waState = {
    sock: null,
    currentQR: null,
    connectionStatus: 'disconnected',
    isIntentionalDisconnect: false,
    listeners: [],
    syncProgress: { syncing: false, messagesLoaded: 0, labelsLoaded: 0 },
    mediaQueue: [],
    activeDownloads: 0,
    pendingFollowUps: new Map(), // Pour le Brain - conversations en attente de réponse
    // === STABILITY IMPROVEMENTS ===
    reconnectAttempts: 0,
    reconnectBackoff: 3000, // Start at 3s, max 60s
    lastActivity: Date.now(),
    lastPong: Date.now(),
    heartbeatInterval: null,
    connectionCheckInterval: null,
    consecutiveFailures: 0,
    maxConsecutiveFailures: 5,
    isReconnecting: false
  };
}

// === STABILITY: Backoff calculation ===
function getReconnectDelay() {
  const baseDelay = 3000;
  const maxDelay = 60000;
  const attempt = wa.reconnectAttempts;
  // Exponential backoff: 3s, 6s, 12s, 24s, 48s, 60s max
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay;
}

function resetReconnectState() {
  wa.reconnectAttempts = 0;
  wa.reconnectBackoff = 3000;
  wa.consecutiveFailures = 0;
  wa.isReconnecting = false;
  wa.lastActivity = Date.now();
  wa.lastPong = Date.now();
}

// === STABILITY: Session backup ===
const AUTH_BACKUP_DIR = path.join(process.cwd(), 'data', 'auth_backup');
if (!fs.existsSync(AUTH_BACKUP_DIR)) fs.mkdirSync(AUTH_BACKUP_DIR, { recursive: true });

function backupSession() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    for (const file of files) {
      const src = path.join(AUTH_DIR, file);
      const dest = path.join(AUTH_BACKUP_DIR, file);
      fs.copyFileSync(src, dest);
    }
    console.log('[WA] 💾 Session backup créé');
  } catch (err) {
    console.error('[WA] Backup error:', err.message);
  }
}

function restoreSession() {
  try {
    if (!fs.existsSync(AUTH_BACKUP_DIR)) return false;
    const files = fs.readdirSync(AUTH_BACKUP_DIR);
    if (files.length === 0) return false;

    // Clear auth dir first
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(AUTH_DIR, { recursive: true });

    for (const file of files) {
      const src = path.join(AUTH_BACKUP_DIR, file);
      const dest = path.join(AUTH_DIR, file);
      fs.copyFileSync(src, dest);
    }
    console.log('[WA] 🔄 Session restaurée depuis backup');
    return true;
  } catch (err) {
    console.error('[WA] Restore error:', err.message);
    return false;
  }
}

// === STABILITY: Connection monitoring ===
function startConnectionMonitoring() {
  // Clear existing intervals
  if (wa.heartbeatInterval) clearInterval(wa.heartbeatInterval);
  if (wa.connectionCheckInterval) clearInterval(wa.connectionCheckInterval);

  // Heartbeat: update activity timestamp regularly
  wa.heartbeatInterval = setInterval(() => {
    if (wa.sock && wa.connectionStatus === 'connected') {
      wa.lastActivity = Date.now();
    }
  }, 30000); // Every 30s

  // Connection check: detect stuck connections
  wa.connectionCheckInterval = setInterval(() => {
    if (wa.connectionStatus !== 'connected') return;
    if (wa.isReconnecting) return;

    const now = Date.now();
    const inactiveTime = now - wa.lastActivity;

    // If no activity for 5 minutes, force reconnect
    if (inactiveTime > 5 * 60 * 1000) {
      console.log('[WA] ⚠️ Connection stale detected (5min inactivity), forcing reconnect...');
      forceReconnect();
    }
  }, 60000); // Check every minute

  console.log('[WA] 🔍 Connection monitoring started');
}

function stopConnectionMonitoring() {
  if (wa.heartbeatInterval) {
    clearInterval(wa.heartbeatInterval);
    wa.heartbeatInterval = null;
  }
  if (wa.connectionCheckInterval) {
    clearInterval(wa.connectionCheckInterval);
    wa.connectionCheckInterval = null;
  }
}

async function forceReconnect() {
  if (wa.isReconnecting) {
    console.log('[WA] Already reconnecting, skipping...');
    return;
  }

  wa.isReconnecting = true;
  console.log('[WA] 🔄 Force reconnect initiated...');

  try {
    // Clean up existing socket
    if (wa.sock) {
      try {
        wa.sock.ev.removeAllListeners();
        wa.sock.end();
      } catch {}
      wa.sock = null;
    }

    wa.connectionStatus = 'connecting';
    broadcast({ type: 'status', data: { status: 'connecting', reason: 'force_reconnect' }, timestamp: Date.now() });

    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 2000));

    await initSocket();
  } catch (err) {
    console.error('[WA] Force reconnect error:', err.message);
    wa.isReconnecting = false;
    wa.consecutiveFailures++;

    if (wa.consecutiveFailures >= wa.maxConsecutiveFailures) {
      console.error('[WA] ❌ Too many consecutive failures, stopping reconnection attempts');
      wa.connectionStatus = 'disconnected';
      broadcast({ type: 'status', data: { status: 'disconnected', reason: 'max_failures' }, timestamp: Date.now() });
    } else {
      // Schedule another attempt
      const delay = getReconnectDelay();
      wa.reconnectAttempts++;
      console.log(`[WA] Scheduling reconnect in ${delay/1000}s (attempt ${wa.reconnectAttempts})...`);
      setTimeout(() => forceReconnect(), delay);
    }
  }
}

// Référence directe pour le Brain
const pendingFollowUps = g.__waState.pendingFollowUps;

// Auto-expiration des pending après 5 minutes
if (!g.__waPendingCleanup) {
  g.__waPendingCleanup = setInterval(() => {
    const now = Date.now();
    for (const [jid, pending] of pendingFollowUps.entries()) {
      if (now - pending.timestamp > 5 * 60 * 1000) {
        console.log(`[BRAIN] ⏰ Pending expiré pour ${jid}`);
        pendingFollowUps.delete(jid);
      }
    }
  }, 60 * 1000);
}

// Direct reference to global state
const wa = g.__waState;

// Track module version for hot reload detection
const MODULE_VERSION = Date.now();
if (!g.__waModuleVersion || g.__waModuleVersion !== MODULE_VERSION) {
  const previousVersion = g.__waModuleVersion;
  g.__waModuleVersion = MODULE_VERSION;
  if (previousVersion && wa.sock) {
    console.log('[WA] 🔄 Hot reload detected, re-registering event handlers...');
    // Remove all old listeners and re-register
    try {
      wa.sock.ev.removeAllListeners('messages.upsert');
      wa.sock.ev.removeAllListeners('messaging-history.set');
      wa.sock.ev.removeAllListeners('contacts.upsert');
      wa.sock.ev.removeAllListeners('contacts.update');
      wa.sock.ev.removeAllListeners('labels.edit');
      wa.sock.ev.removeAllListeners('labels.association');
      // Note: We keep connection.update and creds.update as they're critical
    } catch (e) {
      console.log('[WA] Could not remove listeners:', e.message);
    }
    // Schedule re-registration after module finishes loading
    setTimeout(() => registerEventHandlers(wa.sock), 100);
  }
}

// ==================== MEDIA DOWNLOAD QUEUE ====================
const mediaQueue = g.__waState.mediaQueue;
const MAX_CONCURRENT = 2;

function queueMediaDownload(msg, msgId, convName, jid) {
  mediaQueue.push({ msg, msgId, convName, jid });
  processMediaQueue();
}

async function processMediaQueue() {
  if (g.__waState.activeDownloads >= MAX_CONCURRENT) return;
  while (mediaQueue.length > 0 && g.__waState.activeDownloads < MAX_CONCURRENT) {
    const item = mediaQueue.shift();
    g.__waState.activeDownloads++;
    downloadAndSaveMedia(item.msg, item.msgId, item.convName, item.jid).finally(() => {
      g.__waState.activeDownloads--;
      if (mediaQueue.length > 0) processMediaQueue();
    });
  }
}

async function downloadAndSaveMedia(msg, msgId, convName, jid) {
  try {
    const m = msg.message;
    if (!m) return;
    const docMsg = m.documentMessage || m.documentWithCaptionMessage?.message?.documentMessage;
    if (docMsg) {
      const mimetype = docMsg.mimetype || 'application/octet-stream';
      const origName = (docMsg.fileName || `doc_${msgId}`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const saveName = `${msgId}_${origName}`;
      const filePath = path.join(DOCS_DIR, saveName);
      if (fs.existsSync(filePath)) return;
      const buffer = await downloadMediaMessage(msg, 'buffer', {});
      fs.writeFileSync(filePath, buffer);
      updateMessageMedia(msgId, `/api/whatsapp/media/${saveName}`, mimetype);
      const sizeKb = Math.round(buffer.length / 1024);
      insertAgentLog('doc_downloaded', `Téléchargement ${origName} (${sizeKb} Ko) — ${convName || 'Inconnu'}`, jid, convName, { filename: origName, size: buffer.length, mimetype });
      return;
    }
    const mediaMsg = m.imageMessage || m.videoMessage || m.audioMessage || m.stickerMessage;
    if (!mediaMsg) return;
    const mimetype = mediaMsg.mimetype || 'application/octet-stream';
    const fileSize = Number(mediaMsg.fileLength || 0);
    if (mimetype.startsWith('video/') && fileSize > 20 * 1024 * 1024) return;
    const ext = mimeToExt(mimetype);
    const filename = `${msgId}${ext}`;
    const filePath = path.join(MEDIA_DIR, filename);
    if (fs.existsSync(filePath)) return;
    const buffer = await downloadMediaMessage(msg, 'buffer', {});
    fs.writeFileSync(filePath, buffer);
    updateMessageMedia(msgId, `/api/whatsapp/media/${filename}`, mimetype);
    const typeLabel = mimetype.startsWith('image/') ? 'Photo' : mimetype.startsWith('video/') ? 'Vidéo' : mimetype.startsWith('audio/') ? 'Audio' : 'Média';
    const sizeKb = Math.round(buffer.length / 1024);
    insertAgentLog('doc_downloaded', `Téléchargement ${typeLabel} (${sizeKb} Ko) — ${convName || 'Inconnu'}`, jid, convName, { filename, size: buffer.length, mimetype, type: typeLabel });
  } catch (err) { /* silent */ }
}

function mimeToExt(mimetype) {
  if (!mimetype) return '.bin';
  const map = { 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','video/mp4':'.mp4','video/3gpp':'.3gp','audio/ogg; codecs=opus':'.ogg','audio/ogg':'.ogg','audio/mpeg':'.mp3','audio/mp4':'.m4a','application/pdf':'.pdf' };
  return map[mimetype] || '.bin';
}

// ==================== TEXT HELPERS ====================
function getMessageText(msg) {
  if (!msg.message) return null;
  const m = msg.message;
  if (m.protocolMessage || m.pollUpdateMessage || m.reactionMessage || m.pollCreationMessage || m.senderKeyDistributionMessage || m.editedMessage?.message?.protocolMessage) return null;
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return `📷 ${m.imageMessage.caption}`;
  if (m.imageMessage) return '📷 Photo';
  if (m.videoMessage?.caption) return `🎥 ${m.videoMessage.caption}`;
  if (m.videoMessage) return '🎥 Vidéo';
  if (m.audioMessage) return m.audioMessage.ptt ? '🎤 Vocal' : '🎵 Audio';
  if (m.stickerMessage) return '🏷️ Sticker';
  if (m.contactMessage) return `👤 ${m.contactMessage.displayName || 'Contact'}`;
  if (m.contactsArrayMessage) return `👥 ${m.contactsArrayMessage.contacts?.length || 0} contacts`;
  if (m.locationMessage) return '📍 Position';
  if (m.liveLocationMessage) return '📍 Position en direct';
  if (m.documentMessage) return `📎 ${m.documentMessage.fileName || 'Document'}`;
  if (m.documentWithCaptionMessage?.message?.documentMessage) { const doc = m.documentWithCaptionMessage.message.documentMessage; return `📎 ${doc.fileName || 'Document'}${doc.caption ? ' - '+doc.caption : ''}`; }
  if (m.templateMessage) return m.templateMessage.hydratedTemplate?.hydratedContentText || 'Message template';
  if (m.buttonsResponseMessage) return m.buttonsResponseMessage.selectedDisplayText || 'Réponse bouton';
  if (m.listResponseMessage) return m.listResponseMessage.title || 'Réponse liste';
  if (m.viewOnceMessage?.message || m.viewOnceMessageV2?.message) return '👁️ Message éphémère';
  if (m.editedMessage?.message) return getMessageText({ message: m.editedMessage.message });
  return null;
}

function hasMedia(msg) { if (!msg.message) return false; const m = msg.message; return !!(m.imageMessage||m.videoMessage||m.audioMessage||m.stickerMessage||m.documentMessage||m.documentWithCaptionMessage?.message?.documentMessage); }
function isDocumentMessage(msg) { if (!msg.message) return false; const m = msg.message; return !!(m.documentMessage||m.documentWithCaptionMessage?.message?.documentMessage); }
function isImageMessage(msg) { if (!msg.message) return false; return !!msg.message.imageMessage; }
function isVideoMessage(msg) { if (!msg.message) return false; return !!msg.message.videoMessage; }
function getDocumentInfo(msg) { const m = msg.message; const doc = m.documentMessage||m.documentWithCaptionMessage?.message?.documentMessage; if (!doc) return null; return { filename: doc.fileName||'document', mimetype: doc.mimetype||'application/octet-stream', fileSize: doc.fileLength ? Number(doc.fileLength) : 0 }; }
function getImageInfo(msg, msgId) { const img = msg.message?.imageMessage; if (!img) return null; const ext = img.mimetype?.includes('png') ? 'png' : img.mimetype?.includes('webp') ? 'webp' : 'jpg'; return { filename: `photo_${msgId}.${ext}`, mimetype: img.mimetype || 'image/jpeg', fileSize: img.fileLength ? Number(img.fileLength) : 0 }; }
function getVideoInfo(msg, msgId) { const vid = msg.message?.videoMessage; if (!vid) return null; return { filename: `video_${msgId}.mp4`, mimetype: vid.mimetype || 'video/mp4', fileSize: vid.fileLength ? Number(vid.fileLength) : 0 }; }
function isMediaForDocuments(msg) { return isDocumentMessage(msg) || isImageMessage(msg) || isVideoMessage(msg); }
function getMediaInfo(msg, msgId) { if (isDocumentMessage(msg)) return getDocumentInfo(msg); if (isImageMessage(msg)) return getImageInfo(msg, msgId); if (isVideoMessage(msg)) return getVideoInfo(msg, msgId); return null; }
function getMsgType(msg) { if (!msg.message) return 'text'; const m = msg.message; if (m.documentMessage||m.documentWithCaptionMessage) return 'document'; if (m.imageMessage) return 'image'; if (m.videoMessage) return 'video'; if (m.audioMessage) return m.audioMessage.ptt?'ptt':'audio'; if (m.stickerMessage) return 'sticker'; return 'text'; }
function getContactName(msg) { return msg.pushName || msg.verifiedBizName || null; }
function isGroupJid(jid) { return jid?.endsWith('@g.us') || jid?.includes('-') && jid?.endsWith('@g.us'); }
function isLidJid(jid) { return jid?.endsWith('@lid'); }

function broadcast(event) { const data = JSON.stringify(event); wa.listeners.forEach(fn => { try { fn(data); } catch {} }); }

// ==================== EXPORTS ====================
export function addListener(fn) {
  wa.listeners.push(fn);
  return () => {
    const idx = wa.listeners.indexOf(fn);
    if (idx > -1) wa.listeners.splice(idx, 1);
  };
}
export function getQR() { return wa.currentQR; }
export function getStatus() {
  return {
    status: wa.connectionStatus,
    syncProgress: wa.syncProgress.syncing ? wa.syncProgress : null,
    mediaQueue: mediaQueue.length,
    // Stability info
    reconnectAttempts: wa.reconnectAttempts,
    consecutiveFailures: wa.consecutiveFailures,
    lastActivity: wa.lastActivity,
    isReconnecting: wa.isReconnecting
  };
}
export function getSyncProgress() { return wa.syncProgress; }

export async function sendMessage(jid, text) {
  if (!wa.sock || wa.connectionStatus !== 'connected') throw new Error('WhatsApp non connecté');
  const sent = await wa.sock.sendMessage(jid, { text });
  const msgId = sent.key.id || `sent_${Date.now()}`;
  const ts = Date.now();
  try {
    insertMessage(msgId, jid, true, 'Moi', text, ts, 'text', false, null, null);
    updateConversationLastMessage(jid, text, ts);
  } catch (dbErr) {
    // DB insert can fail for groups not in conversations table — message was already sent
    console.log(`[WA] DB log skipped for ${jid}: ${dbErr.message}`);
  }
  broadcast({ type: 'message_sent', data: { jid, text, timestamp: ts }, timestamp: ts });
  return { success: true, messageId: msgId };
}

export async function findGroupByName(keyword) {
  if (!wa.sock || wa.connectionStatus !== 'connected') return null;
  try {
    const groups = await wa.sock.groupFetchAllParticipating();
    const match = Object.values(groups).find(g => g.subject && g.subject.toUpperCase().includes(keyword.toUpperCase()));
    return match ? { id: match.id, name: match.subject } : null;
  } catch { return null; }
}

export async function disconnect() {
  wa.isIntentionalDisconnect = true;
  stopConnectionMonitoring();
  if (wa.sock) { try { wa.sock.end(); } catch {} wa.sock = null; }
  wa.connectionStatus = 'disconnected'; wa.currentQR = null;
  resetReconnectState();
  broadcast({ type: 'status', data: { status: 'disconnected' }, timestamp: Date.now() });
}

// Force reconnect - can be called from API
export async function reconnect() {
  console.log('[WA] 🔄 Manual reconnect requested...');
  await forceReconnect();
  return { status: 'reconnecting' };
}

// Full logout - clears session and requires new QR scan
export async function logout() {
  console.log('[WA] 🚪 Full logout requested - clearing session...');
  wa.isIntentionalDisconnect = true;
  stopConnectionMonitoring();

  // Try to properly logout from WhatsApp servers
  if (wa.sock) {
    try {
      await wa.sock.logout();
      console.log('[WA] ✅ Logged out from WhatsApp servers');
    } catch (e) {
      console.log('[WA] Logout call failed (continuing anyway):', e.message);
    }
    try { wa.sock.end(); } catch {}
    wa.sock = null;
  }

  // Clear auth directory
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    console.log('[WA] ✅ Auth directory deleted');
  } catch (e) {
    console.log('[WA] Could not delete auth dir:', e.message);
  }

  // Recreate empty auth dir
  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  } catch {}

  // Reset all state
  wa.connectionStatus = 'disconnected';
  wa.currentQR = null;
  resetReconnectState();

  broadcast({ type: 'status', data: { status: 'disconnected', reason: 'logout' }, timestamp: Date.now() });

  return { success: true, message: 'Session cleared. Scan QR to reconnect.' };
}

// Resync media for a specific conversation - re-queue media downloads
export async function resyncConversationMedia(jid) {
  if (!wa.sock || wa.connectionStatus !== 'connected') {
    return { success: false, error: 'WhatsApp non connecté' };
  }

  try {
    const db = getDb();

    // Get all messages with media for this conversation
    const messagesWithMedia = db.prepare(`
      SELECT id, message_type, media_url
      FROM messages
      WHERE conversation_jid = ?
      AND message_type IN ('image', 'video', 'document', 'audio', 'ptt')
    `).all(jid);

    let queued = 0;
    let alreadyDownloaded = 0;

    for (const msg of messagesWithMedia) {
      // Check if media file exists locally
      if (msg.media_url) {
        const filename = msg.media_url.split('/').pop();
        const localPath = path.join(MEDIA_DIR, filename);
        if (fs.existsSync(localPath)) {
          alreadyDownloaded++;
          // Make sure it's in documents table
          const ext = msg.message_type === 'image' ? 'jpg' : msg.message_type === 'video' ? 'mp4' : '';
          const docFilename = msg.message_type === 'image' ? `photo_${msg.id}.${ext}` :
                             msg.message_type === 'video' ? `video_${msg.id}.${ext}` : filename;
          const mimetype = msg.message_type === 'image' ? 'image/jpeg' :
                          msg.message_type === 'video' ? 'video/mp4' : 'application/octet-stream';

          db.prepare(`INSERT OR IGNORE INTO documents (id, conversation_jid, message_id, filename, mimetype, status, local_path, created_at)
            VALUES (?, ?, ?, ?, ?, 'recu', ?, ?)`).run(
            `doc_${msg.id}`, jid, msg.id, docFilename, mimetype, msg.media_url, Date.now()
          );
          continue;
        }
      }
      queued++;
    }

    // Also backfill documents table for any media messages not yet in documents
    db.prepare(`
      INSERT OR IGNORE INTO documents (id, conversation_jid, message_id, filename, mimetype, status, local_path, created_at)
      SELECT
        'doc_' || m.id,
        m.conversation_jid,
        m.id,
        CASE
          WHEN m.message_type = 'image' THEN 'photo_' || m.id || '.jpg'
          WHEN m.message_type = 'video' THEN 'video_' || m.id || '.mp4'
          ELSE 'document'
        END,
        CASE
          WHEN m.message_type = 'image' THEN 'image/jpeg'
          WHEN m.message_type = 'video' THEN 'video/mp4'
          ELSE 'application/octet-stream'
        END,
        'recu',
        m.media_url,
        m.timestamp
      FROM messages m
      WHERE m.conversation_jid = ?
      AND m.message_type IN ('image', 'video', 'document')
      AND m.media_url IS NOT NULL
    `).run(jid);

    return {
      success: true,
      message: `Resync terminé: ${alreadyDownloaded} médias présents, ${queued} en attente`,
      alreadyDownloaded,
      queued
    };
  } catch (err) {
    console.error('[WA] Resync error:', err);
    return { success: false, error: err.message };
  }
}

// Force resync messages - mark chat as read and update last message from DB
export async function resyncMessages(jid, count = 50) {
  if (!wa.sock || wa.connectionStatus !== 'connected') {
    return { success: false, error: 'WhatsApp non connecté' };
  }

  try {
    console.log(`[WA] 🔄 Resync messages for JID: "${jid}"`);
    const db = getDb();

    // Debug: check total messages and specific JID
    const totalMsgs = db.prepare('SELECT COUNT(*) as count FROM messages').get();
    const jidMsgs = db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_jid = ?').get(jid);
    const likeMsgs = db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_jid LIKE ?').get(`%${jid.split('@')[0]}%`);
    console.log(`[WA] DEBUG: Total msgs in DB: ${totalMsgs?.count}, For exact JID: ${jidMsgs?.count}, For LIKE: ${likeMsgs?.count}`);

    // Mark chat as read to trigger potential sync
    try {
      await wa.sock.readMessages([{ remoteJid: jid, id: undefined, participant: undefined }]);
    } catch (readErr) {
      console.log('[WA] Read mark skipped:', readErr.message);
    }

    // Get count of messages in DB
    const msgCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_jid=?').get(jid);

    // Update conversation's last_message from actual messages table
    const lastMsg = db.prepare('SELECT text, timestamp FROM messages WHERE conversation_jid=? ORDER BY timestamp DESC LIMIT 1').get(jid);
    if (lastMsg) {
      updateConversationLastMessage(jid, lastMsg.text, lastMsg.timestamp);
      console.log(`[WA] ✅ Last message updated: "${lastMsg.text?.substring(0, 30)}..."`);
    }

    // Check for any recent messages that might be missing (within last 24h)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_jid=? AND timestamp > ?').get(jid, oneDayAgo);

    return {
      success: true,
      message: `${msgCount?.count || 0} msgs (JID: ${jid?.substring(0,15)}...)`,
      synced: 0,
      total: msgCount?.count || 0
    };
  } catch (err) {
    console.error('[WA] Resync messages error:', err);
    return { success: false, error: err.message };
  }
}

export async function connect() {
  if (wa.connectionStatus === 'connected' && wa.sock) return { status: 'already_connected' };
  wa.isIntentionalDisconnect = false;
  wa.connectionStatus = 'connecting';
  broadcast({ type: 'status', data: { status: 'connecting' }, timestamp: Date.now() });
  try {
    await initSocket();
  } catch (err) {
    console.error('[WA] Connect error:', err.message);
  }
  return { status: 'connecting' };
}

// ==================== EVENT HANDLERS ====================
function registerEventHandlers(sock) {
  console.log('[WA] Registering event handlers...');

  // ---- CONTACTS ----
  sock.ev.on('contacts.upsert', (contacts) => {
    let n = 0;
    for (const c of contacts) {
      if (!c.id || isGroupJid(c.id)) continue;
      const name = c.name || c.notify || c.verifiedName || null;
      if (name && !name.match(/^\+?\d{6,}/)) { forceUpdateName(c.id, name); n++; }
    }
    if (n > 0) { console.log(`[WA] 📇 ${n} noms de contacts mis à jour`); broadcast({ type: 'contacts_updated', data: { count: n }, timestamp: Date.now() }); }
  });

  sock.ev.on('contacts.update', (updates) => {
    for (const u of updates) {
      if (u.id && !isGroupJid(u.id)) { const name = u.notify || u.verifiedName || null; if (name) forceUpdateName(u.id, name); }
    }
  });

  // ---- LABELS (WhatsApp Business) ----
  sock.ev.on('labels.edit', (label) => {
    console.log('🔴🔴🔴 LABELS.EDIT RECEIVED:', JSON.stringify(label));
    if (label) {
      upsertLabel(label.id, label.name, label.color, label.predefinedId);
      console.log('[WA] 🏷️ Label edited: ' + label.name);
      broadcast({ type: 'labels_updated', data: { label }, timestamp: Date.now() });
    }
  });

  sock.ev.on('labels.association', ({ association, type }) => {
    console.log('🔴🔴🔴 LABELS.ASSOCIATION RECEIVED:', type, JSON.stringify(association));
    if (!association) return;
    const labelId = association.labelId || association.label_id;
    const chatId = association.chatId || association.chat_id;
    if (!labelId || !chatId) return;
    if (type === 'add') addLabelAssociation(labelId, chatId);
    else if (type === 'remove') removeLabelAssociation(labelId, chatId);
    console.log('[WA] 🏷️ Label association: ' + type + ' labelId=' + labelId + ' chat=' + chatId);
    broadcast({ type: 'labels_updated', data: {}, timestamp: Date.now() });
  });

  // ---- HISTORY SYNC ----
  sock.ev.on('messaging-history.set', ({ messages, chats, contacts, isLatest }) => {
    // Update activity timestamp
    wa.lastActivity = Date.now();

    console.log(`[WA] Sync: ${messages?.length||0} msgs, ${chats?.length||0} chats, ${contacts?.length||0} contacts`);
    wa.syncProgress.syncing = true; wa.syncProgress.messagesLoaded += (messages?.length || 0);
    broadcast({ type: 'sync_progress', data: wa.syncProgress, timestamp: Date.now() });

    if (contacts?.length) {
      for (const c of contacts) {
        if (!c.id || isGroupJid(c.id)) continue;
        const name = c.name || c.notify || null;
        if (name && !name.match(/^\+?\d{6,}/)) forceUpdateName(c.id, name);
      }
    }
    if (chats?.length) {
      for (const chat of chats) {
        if (!chat.id || isGroupJid(chat.id)) continue;
        upsertConversation(chat.id, chat.name || null, chat.id.split('@')[0]);
      }
    }

    let processed = 0, mediaQueued = 0;
    if (messages?.length) {
      for (const msg of messages) {
        try {
          const jid = msg.key.remoteJid;
          if (!jid || isGroupJid(jid) || jid === 'status@broadcast') continue;
          const msgTs = typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp?.low || msg.messageTimestamp || 0);
          if (msgTs < SYNC_CUTOFF) continue;
          const text = getMessageText(msg);
          const fromMe = msg.key.fromMe || false;
          const pushName = getContactName(msg);
          const phone = jid.split('@')[0];
          if (pushName) upsertConversation(jid, pushName, phone); else upsertConversation(jid, null, phone);
          const msgId = msg.key.id || `h_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
          const tsMs = msgTs * 1000;
          const msgType = getMsgType(msg);
          const isDoc = isDocumentMessage(msg);
          const isMedia = isMediaForDocuments(msg);
          const senderName = fromMe ? 'Moi' : (pushName || phone);

          // Process media even without text
          if (isMedia) { const mi = getMediaInfo(msg, msgId); if (mi) insertDocument(`doc_${msgId}`, jid, msgId, mi.filename, mi.mimetype, mi.fileSize, null); }
          if (hasMedia(msg)) { queueMediaDownload(msg, msgId, pushName || phone, jid); mediaQueued++; }

          // Insert message (with placeholder for media-only)
          const displayText = text || (isMedia ? (isImageMessage(msg) ? '📷 Photo' : isVideoMessage(msg) ? '🎥 Vidéo' : '📎 Document') : null);
          if (!displayText) continue;
          insertMessage(msgId, jid, fromMe, senderName, displayText, tsMs, msgType, isDoc, null, null);
          updateConversationLastMessage(jid, displayText, tsMs);
          processed++;
        } catch {}
      }
    }
    console.log(`[WA] → ${processed} msgs traités, ${mediaQueued} médias en téléchargement`);
    if (isLatest) { wa.syncProgress.syncing = false; console.log(`[WA] ✅ Sync terminé!`); broadcast({ type: 'sync_complete', data: wa.syncProgress, timestamp: Date.now() }); }
  });

  // ---- REAL-TIME MESSAGES ----
  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    // Update activity timestamp for connection monitoring
    wa.lastActivity = Date.now();

    // IMPORTANT: Ignorer les messages de sync historique, seulement traiter les nouveaux
    if (type !== 'notify') {
      console.log(`[WA] ⏭️ Ignoré: type=${type} (pas notify)`);
      return;
    }

    console.log(`[WA] 📨 messages.upsert: ${msgs?.length || 0} messages, type=${type}`);
    for (const msg of msgs) {
      try {
        const jid = msg.key.remoteJid;
        const fromMe = msg.key.fromMe || false;
        console.log(`[WA] Processing msg from ${jid}, fromMe=${fromMe}`);
        if (!jid || isGroupJid(jid) || jid === 'status@broadcast') continue;

        // ===== BRAIN: Traitement HYBRIDE (Texte + Audio) pour mes messages =====
        // SEULEMENT répondre dans "Notes à moi-même" (mon propre numéro)
        const myNumber = wa.sock?.user?.id?.split(':')[0] || '';
        const chatNumber = jid.split('@')[0];
        const isNoteToSelf = chatNumber === myNumber;

        if (fromMe && isNoteToSelf) {
          const isAudio = msg.message?.audioMessage;
          const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

          if (isAudio || textContent) {
            console.log(`[BRAIN] 📨 Notes à moi-même (${isAudio ? '🎙️ VOCAL' : '💬 TEXTE'})`);

            const txtLower = (textContent || '').toLowerCase().trim();

            // ===== COMMANDE AIDE =====
            if (txtLower === 'command' || txtLower === 'commands' || txtLower === 'aide' || txtLower === 'help') {
              const helpText = `🤖 *COMMANDES WHATSAPP AGENT*

📊 *RAPPORTS*
• *rapport leads* → Leads en cours par dossier
• *rapport sinistres* → Sinistres en cours
• *rapport gestions* → Gestions en cours
• *rapport jour* → Résumé de la journée
• *rapport* → Toutes les tâches ouvertes

🔢 *APRÈS UN RAPPORT*
• *{numéro}* → Zoom sur un dossier
• *fait {n}* → Cocher la tâche n°
• *ajouter {texte}* → Nouvelle tâche sur le projet

📋 *CRÉER*
• _"Nouveau lead Dupont assurance auto"_
• _"Tâche résiliation mutuelle sur Pigallerie"_
• _"Note sur Abbache : client veut rappel lundi"_

⏰ *RAPPELS*
• _"Rappelle-moi demain à 9h appeler Abbache"_
• _"Rappel dans 20 min relancer Generali"_

🎙️ *VOCAL*
• Envoie un vocal → mêmes commandes qu'en texte

❓ *AIDE*
• *command* → Ce message`;

              await wa.sock.sendMessage(jid, { text: helpText });
              globalThis.selfJid = jid;
              continue;
            }

            // ===== RAPPORT LEADS =====
            if (txtLower === 'rapport leads' || txtLower === 'rapport lead') {
              console.log('[BRAIN] 📊 Rapport Leads...');
              try {
                const result = await getCategoryReport('Lead');
                console.log(`[BRAIN] 📊 Résultat: success=${result.success}, items=${result.items?.length || 0}`);
                if (result.success) {
                  await wa.sock.sendMessage(jid, { text: result.text });
                  globalThis.selfJid = jid;
                  if (result.items && result.items.length > 0) {
                    console.log(`[BRAIN] 📊 Storing category_report pending avec ${result.items.length} items`);
                    pendingFollowUps.set(jid, {
                      type: 'category_report',
                      items: result.items,
                      category: 'Lead',
                      timestamp: Date.now()
                    });
                  }
                } else {
                  await wa.sock.sendMessage(jid, { text: `⚠️ ${result.message}` });
                }
              } catch (err) {
                await wa.sock.sendMessage(jid, { text: `❌ Erreur: ${err.message}` });
              }
              continue;
            }

            // ===== RAPPORT SINISTRES =====
            if (txtLower === 'rapport sinistres' || txtLower === 'rapport sinistre') {
              console.log('[BRAIN] 📊 Rapport Sinistres...');
              try {
                const result = await getCategoryReport('Sinistre');
                if (result.success) {
                  await wa.sock.sendMessage(jid, { text: result.text });
                  globalThis.selfJid = jid;
                  if (result.items && result.items.length > 0) {
                    pendingFollowUps.set(jid, {
                      type: 'category_report',
                      items: result.items,
                      category: 'Sinistre',
                      timestamp: Date.now()
                    });
                  }
                } else {
                  await wa.sock.sendMessage(jid, { text: `⚠️ ${result.message}` });
                }
              } catch (err) {
                await wa.sock.sendMessage(jid, { text: `❌ Erreur: ${err.message}` });
              }
              continue;
            }

            // ===== RAPPORT GESTIONS =====
            if (txtLower === 'rapport gestions' || txtLower === 'rapport gestion') {
              console.log('[BRAIN] 📊 Rapport Gestions...');
              try {
                const result = await getCategoryReport('Gestion');
                if (result.success) {
                  await wa.sock.sendMessage(jid, { text: result.text });
                  globalThis.selfJid = jid;
                  if (result.items && result.items.length > 0) {
                    pendingFollowUps.set(jid, {
                      type: 'category_report',
                      items: result.items,
                      category: 'Gestion',
                      timestamp: Date.now()
                    });
                  }
                } else {
                  await wa.sock.sendMessage(jid, { text: `⚠️ ${result.message}` });
                }
              } catch (err) {
                await wa.sock.sendMessage(jid, { text: `❌ Erreur: ${err.message}` });
              }
              continue;
            }

            // ===== RAPPORT JOUR =====
            if (txtLower === 'rapport jour' || txtLower === 'rapport quotidien' || txtLower === 'rapport daily') {
              console.log('[BRAIN] 📊 Rapport quotidien...');
              try {
                const result = await getDailyReport();
                if (result.success) {
                  await wa.sock.sendMessage(jid, { text: result.text });
                  globalThis.selfJid = jid;
                } else {
                  await wa.sock.sendMessage(jid, { text: `⚠️ ${result.message}` });
                }
              } catch (err) {
                await wa.sock.sendMessage(jid, { text: `❌ Erreur: ${err.message}` });
              }
              continue;
            }

            // 📊 RAPPORT MANUEL (pas de confirmation nécessaire)
            if (txtLower === 'rapport' || txtLower === 'rapport maintenant' || txtLower === 'test rapport') {
              console.log('[BRAIN] 📊 Génération rapport manuel...');
              try {
                const report = await getTasksReport();
                await wa.sock.sendMessage(jid, { text: report });
                // Store the working JID for proactive notifications
                globalThis.selfJid = jid;
                console.log(`[BRAIN] 💾 selfJid stocké: ${jid}`);
              } catch (err) {
                await wa.sock.sendMessage(jid, { text: '⚠️ Erreur génération rapport' });
              }
              continue;
            }

            // ===== ÉTAPE 2 : RÉPONSE À UNE CONFIRMATION EN ATTENTE =====
            if (pendingFollowUps.has(jid)) {
              const pending = pendingFollowUps.get(jid);

              // ===== FOLLOW-UP TÂCHE TERMINÉE =====
              if (pending.type === 'task_completed_followup') {
                // Vérifier si pas expiré (2 minutes)
                if (Date.now() - pending.timestamp > 2 * 60 * 1000) {
                  console.log('[BRAIN] ⏰ Follow-up tâche terminée expiré');
                  pendingFollowUps.delete(jid);
                  // On continue vers le traitement normal (analyse Gemini)
                } else {
                  // L'utilisateur répond pour ajouter une tâche au même projet

                  // Si c'est un 3/annuler/non, on supprime le follow-up
                  if (['3', 'annuler', 'cancel', 'non', 'stop', '❌'].includes(txtLower)) {
                    pendingFollowUps.delete(jid);
                    await wa.sock.sendMessage(jid, { text: '👍 OK' });
                    continue;
                  }

                  // Sinon, on traite le texte comme une demande d'ajout de tâche(s) sur le projet
                  console.log(`[BRAIN] 📝 Follow-up: ajout tâche sur "${pending.projectName}"`);
                  pendingFollowUps.delete(jid);

                  // Passer par le Brain pour parser le texte (peut contenir plusieurs tâches)
                  try {
                    let recentNamesList = "";
                    try {
                      const recentConvos = getConversations().slice(0, 50);
                      recentNamesList = recentConvos.map(c => c.display_name || c.name || c.phone).join(", ");
                    } catch { recentNamesList = ""; }

                    const inputPayload = { type: 'TEXT', content: textContent };
                    const actionsList = await processSmartInput(inputPayload, recentNamesList);

                    if (actionsList && actionsList.length > 0 && !actionsList[0].error) {
                      // Forcer toutes les actions de type TACHE/TACHE_SUR_PROJET vers le projet du follow-up
                      const forcedActions = actionsList.map(action => {
                        if (action.intention === 'TACHE' || action.intention === 'TACHE_SUR_PROJET') {
                          return {
                            ...action,
                            intention: 'TACHE_SUR_PROJET',
                            project_name: pending.projectName
                          };
                        }
                        return action;
                      });

                      // Construire le preview
                      let preview = `🧠 *PLAN D'ACTION*\n\n`;
                      let stepNum = 1;
                      for (const action of forcedActions) {
                        switch (action.intention) {
                          case 'TACHE_SUR_PROJET':
                            preview += `${stepNum}. ✅ Tâche : ${action.content}\n   └ 📁 Sur projet : ${action.project_name}\n`;
                            break;
                          case 'NOUVEAU_PROJET':
                            const catEmoji2 = action.category === 'LEAD' ? '💰' : action.category === 'SINISTRE' ? '🚨' : '📋';
                            preview += `${stepNum}. ${catEmoji2} Créer projet *${action.category}* → ${action.content}\n   └ Dossier : ${action.client}\n`;
                            break;
                          case 'RAPPEL':
                            const dateStr2 = action.time
                              ? new Date(action.time).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
                              : '?';
                            preview += `${stepNum}. ⏰ Rappel : ${action.content} (${dateStr2})\n`;
                            break;
                          case 'NOTE':
                            preview += `${stepNum}. 📝 Note sur *${action.client}* : ${action.content}\n`;
                            break;
                          default:
                            preview += `${stepNum}. ❓ ${action.intention}: ${action.content || ''}\n`;
                        }
                        stepNum++;
                      }
                      preview += "\n─────────────────\n";
                      preview += "1️⃣ *Valider*  │  2️⃣ *Modifier*  │  3️⃣ *Annuler*";

                      // Stocker pour confirmation
                      pendingFollowUps.set(jid, {
                        actions: forcedActions,
                        timestamp: Date.now(),
                        originalInput: textContent
                      });

                      await wa.sock.sendMessage(jid, { text: preview });
                    } else {
                      // Si le Brain ne comprend pas, créer directement une tâche avec le texte brut
                      const preview = `🧠 *PLAN D'ACTION*\n\n1. ✅ Tâche : ${textContent}\n   └ 📁 Sur projet : ${pending.projectName}\n\n─────────────────\n1️⃣ *Valider*  │  2️⃣ *Modifier*  │  3️⃣ *Annuler*`;

                      pendingFollowUps.set(jid, {
                        actions: [{
                          intention: 'TACHE_SUR_PROJET',
                          project_name: pending.projectName,
                          content: textContent
                        }],
                        timestamp: Date.now(),
                        originalInput: textContent
                      });

                      await wa.sock.sendMessage(jid, { text: preview });
                    }
                  } catch (err) {
                    console.error('[BRAIN] Erreur follow-up:', err.message);
                    await wa.sock.sendMessage(jid, { text: `❌ Erreur: ${err.message}` });
                  }
                  continue;
                }
              }
              // ===== FIN FOLLOW-UP TÂCHE TERMINÉE =====

              // ===== FOLLOW-UP RAPPORT CATÉGORIE =====
              if (pending.type === 'category_report') {
                console.log(`[BRAIN] 📊 category_report pending détecté, items: ${pending.items?.length || 0}`);
                // Vérifier expiration (10 minutes pour les rapports)
                if (Date.now() - pending.timestamp > 10 * 60 * 1000) {
                  console.log('[BRAIN] ⏰ category_report expiré');
                  pendingFollowUps.delete(jid);
                  // Continuer vers le traitement normal
                } else {
                  // L'utilisateur envoie un numéro de dossier
                  const num = parseInt(txtLower);
                  console.log(`[BRAIN] 📊 Input: "${txtLower}", parsed num: ${num}, items.length: ${pending.items?.length}`);
                  if (!isNaN(num) && num >= 1 && num <= pending.items.length) {
                    const item = pending.items[num - 1];

                    // Construire le zoom sur ce dossier
                    let zoomText = `📁 *${item.dossierName}*\n\n`;
                    let allTasks = [];

                    for (const proj of item.projects) {
                      zoomText += `└ *${proj.projName}*\n`;
                      for (const task of proj.tasks) {
                        allTasks.push({ ...task, projName: proj.projName, projId: proj.projId });
                        zoomText += `  ${allTasks.length}. ☐ ${task.taskName}\n`;
                      }
                      if (proj.tasks.length === 0) {
                        zoomText += `  _Aucune tâche ouverte_\n`;
                      }
                      zoomText += '\n';
                    }

                    zoomText += `─────────────────\n`;
                    zoomText += `✅ *fait {n}* → Cocher une tâche\n`;
                    zoomText += `➕ *ajouter {texte}* → Nouvelle tâche\n`;
                    zoomText += `🔙 *retour* → Revenir au rapport`;

                    // Stocker le contexte du zoom
                    pendingFollowUps.set(jid, {
                      type: 'dossier_zoom',
                      dossierName: item.dossierName,
                      dossierId: item.dossierId,
                      tasks: allTasks,
                      projects: item.projects,
                      parentReport: { items: pending.items, category: pending.category },
                      timestamp: Date.now()
                    });

                    await wa.sock.sendMessage(jid, { text: zoomText });
                    continue;
                  }

                  // Si pas un numéro valide, supprimer le pending et laisser passer au Brain
                  pendingFollowUps.delete(jid);
                }
              }
              // ===== FIN FOLLOW-UP RAPPORT CATÉGORIE =====

              // ===== FOLLOW-UP ZOOM DOSSIER =====
              if (pending.type === 'dossier_zoom') {
                if (Date.now() - pending.timestamp > 10 * 60 * 1000) {
                  pendingFollowUps.delete(jid);
                } else {
                  // RETOUR au rapport parent
                  if (txtLower === 'retour' || txtLower === 'back') {
                    const result = await getCategoryReport(pending.parentReport.category);
                    if (result.success) {
                      await wa.sock.sendMessage(jid, { text: result.text });
                      pendingFollowUps.set(jid, {
                        type: 'category_report',
                        items: result.items,
                        category: pending.parentReport.category,
                        timestamp: Date.now()
                      });
                    }
                    continue;
                  }

                  // FAIT X → cocher la tâche
                  const faitMatch = txtLower.match(/^fait\s+(\d+)$/);
                  if (faitMatch) {
                    const taskNum = parseInt(faitMatch[1]);
                    if (taskNum >= 1 && taskNum <= pending.tasks.length) {
                      const task = pending.tasks[taskNum - 1];
                      const result = await completeTaskById(task.taskId);
                      if (result.success) {
                        await wa.sock.sendMessage(jid, {
                          text: `✅ Tâche terminée : *${task.taskName}*\n└ 📁 ${task.projName}\n\n_Autre chose ? "fait X", "ajouter X" ou "retour"_`
                        });

                        // Retirer la tâche de la liste
                        pending.tasks.splice(taskNum - 1, 1);
                        pending.timestamp = Date.now();
                        pendingFollowUps.set(jid, pending);
                      } else {
                        await wa.sock.sendMessage(jid, { text: `⚠️ ${result.message}` });
                      }
                    } else {
                      await wa.sock.sendMessage(jid, { text: `⚠️ Numéro invalide. Tâches disponibles : 1 à ${pending.tasks.length}` });
                    }
                    continue;
                  }

                  // AJOUTER XXX → nouvelle tâche sur le premier projet du dossier
                  const ajouterMatch = txtLower.match(/^ajouter\s+(.+)$/);
                  if (ajouterMatch) {
                    const taskDesc = ajouterMatch[1];
                    const targetProject = pending.projects[0];

                    if (targetProject) {
                      const forcedActions = [{
                        intention: 'TACHE_SUR_PROJET',
                        project_name: targetProject.projName,
                        content: taskDesc
                      }];

                      let preview = `🧠 *PLAN D'ACTION*\n\n`;
                      preview += `1. ✅ Tâche : ${taskDesc}\n   └ 📁 Sur projet : ${targetProject.projName}\n`;
                      preview += `\n─────────────────\n`;
                      preview += `1️⃣ *Valider*  │  2️⃣ *Modifier*  │  3️⃣ *Annuler*`;

                      pendingFollowUps.set(jid, {
                        actions: forcedActions,
                        timestamp: Date.now(),
                        originalInput: taskDesc,
                        returnTo: {
                          type: 'dossier_zoom',
                          dossierName: pending.dossierName,
                          dossierId: pending.dossierId,
                          tasks: pending.tasks,
                          projects: pending.projects,
                          parentReport: pending.parentReport
                        }
                      });

                      await wa.sock.sendMessage(jid, { text: preview });
                    } else {
                      await wa.sock.sendMessage(jid, { text: `⚠️ Aucun projet trouvé dans ce dossier` });
                    }
                    continue;
                  }

                  // Si rien ne matche, supprimer le pending et laisser passer au Brain
                  pendingFollowUps.delete(jid);
                }
              }
              // ===== FIN FOLLOW-UP ZOOM DOSSIER =====

              // --- VALIDER ---
              if (['1', 'ok', 'go', 'oui', 'valide', 'valider', 'yes', '✅'].includes(txtLower)) {
                console.log('[BRAIN] ✅ Validation reçue, exécution...');
                pendingFollowUps.delete(jid);

                try {
                  let responseText = "";
                  let lastCreatedProjectId = null;

                  for (const action of pending.actions) {
                    switch (action.intention) {
                      case 'NOUVEAU_PROJET':
                        const catEmoji = action.category === 'LEAD' ? '💰' : action.category === 'SINISTRE' ? '🚨' : '📋';
                        const resProj = await createProject(action.category, action.client, action.content);
                        if (resProj.success) {
                          lastCreatedProjectId = resProj.projectId;
                          responseText += `${catEmoji} *Projet ${action.category}* créé pour *${action.client}*\n   └ ${action.content}\n`;
                        } else {
                          responseText += `⚠️ Erreur Projet : ${resProj.message}\n`;
                        }
                        break;

                      case 'TACHE':
                        let targetProjectId = null;
                        if (action.link_to_previous && lastCreatedProjectId) {
                          targetProjectId = lastCreatedProjectId;
                        }
                        const resTask = await createTaskOnProject(action.content, targetProjectId);
                        if (resTask.success) {
                          responseText += `✅ Tâche : ${action.content}\n`;
                        } else {
                          responseText += `⚠️ Erreur Tâche : ${resTask.message}\n`;
                        }
                        break;

                      case 'TACHE_SUR_PROJET':
                        const resTSP = await findProjectAndCreateTask(action.project_name, action.content);
                        if (resTSP.success) {
                          responseText += `✅ Tâche : ${action.content}\n   └ 📁 ${resTSP.projectTitle}\n`;
                        } else {
                          responseText += `⚠️ ${resTSP.message}\n`;
                        }
                        break;

                      case 'RAPPEL':
                        const dateReadable = action.time
                          ? new Date(action.time).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
                          : 'Date inconnue';
                        await scheduleReminder(action.content, action.time);
                        responseText += `⏰ Rappel : ${action.content} (${dateReadable})\n`;
                        break;

                      case 'NOTE':
                        const resNote = await addNoteToDossier(action.client, action.content);
                        if (resNote.success) {
                          responseText += `📝 Note ajoutée au dossier *${action.client}*\n`;
                        } else {
                          responseText += `⚠️ Dossier "${action.client}" non trouvé\n`;
                        }
                        break;

                      case 'RAPPORT_JOUR':
                        const report = await getTasksReport();
                        responseText += report + "\n";
                        break;

                      default:
                        responseText += `🤔 Action inconnue: ${action.intention}\n`;
                    }
                  }

                  if (responseText.trim()) {
                    await wa.sock.sendMessage(jid, { text: `✅ *EXÉCUTÉ*\n\n${responseText.trim()}` });
                    // Store the working JID for proactive notifications
                    globalThis.selfJid = jid;
                    console.log(`[BRAIN] 💾 selfJid stocké: ${jid}`);
                  }

                  // Si on avait un contexte de zoom à restaurer
                  if (pending.returnTo) {
                    pendingFollowUps.set(jid, {
                      ...pending.returnTo,
                      timestamp: Date.now()
                    });
                  }
                } catch (err) {
                  console.error('[BRAIN] ❌ Erreur exécution:', err.message);
                  await wa.sock.sendMessage(jid, { text: `❌ Erreur exécution: ${err.message}` });
                }
                continue;
              }

              // --- MODIFIER ---
              if (['2', 'modifier', 'edit', 'change', 'modifie', 'reformule', '✏️'].includes(txtLower)) {
                console.log('[BRAIN] ✏️ Modification demandée');
                pendingFollowUps.delete(jid);
                await wa.sock.sendMessage(jid, { text: '✏️ OK, renvoie ta commande reformulée.' });
                continue;
              }

              // --- ANNULER ---
              if (['3', 'annuler', 'cancel', 'non', 'annule', 'stop', '❌'].includes(txtLower)) {
                console.log('[BRAIN] ❌ Annulation');
                pendingFollowUps.delete(jid);
                await wa.sock.sendMessage(jid, { text: '❌ Annulé.' });
                continue;
              }

              // --- Autre message alors qu'il y a un pending ---
              // On considère que c'est une NOUVELLE commande, on écrase le pending
              console.log('[BRAIN] 🔄 Nouvelle commande reçue, remplacement du pending...');
              pendingFollowUps.delete(jid);
              // On continue vers l'analyse Gemini ci-dessous
            }

            // ===== ÉTAPE 1 : ANALYSE GEMINI → PROPOSER LE PLAN =====
            try {
              let recentNamesList = "";
              try {
                const recentConvos = getConversations().slice(0, 50);
                recentNamesList = recentConvos.map(c => c.display_name || c.name || c.phone).join(", ");
              } catch { recentNamesList = ""; }

              let inputPayload = {};
              if (isAudio) {
                const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger });
                inputPayload = { type: 'AUDIO', content: buffer.toString('base64') };
              } else {
                inputPayload = { type: 'TEXT', content: textContent };
              }

              const actionsList = await processSmartInput(inputPayload, recentNamesList);

              if (!actionsList || actionsList.length === 0 || actionsList[0].error) {
                console.log('[BRAIN] ❌ Ignoré ou Erreur');
                if (actionsList?.[0]?.error) {
                  await wa.sock.sendMessage(jid, { text: `⚠️ ${actionsList[0].error}` });
                }
                continue;
              }

              // Construire le résumé des actions proposées
              let preview = "🧠 *PLAN D'ACTION*\n\n";
              let stepNum = 1;

              for (const action of actionsList) {
                switch (action.intention) {
                  case 'NOUVEAU_PROJET':
                    const catEmoji = action.category === 'LEAD' ? '💰' : action.category === 'SINISTRE' ? '🚨' : '📋';
                    preview += `${stepNum}. ${catEmoji} Créer projet *${action.category}* → ${action.content}\n   └ Dossier : ${action.client}\n`;
                    break;
                  case 'TACHE':
                    preview += `${stepNum}. ✅ Tâche : ${action.content}${action.link_to_previous ? ' (liée au projet ci-dessus)' : ''}\n`;
                    break;
                  case 'TACHE_SUR_PROJET':
                    preview += `${stepNum}. ✅ Tâche : ${action.content}\n   └ 📁 Sur projet : ${action.project_name}\n`;
                    break;
                  case 'RAPPEL':
                    const dateStr = action.time
                      ? new Date(action.time).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
                      : '?';
                    preview += `${stepNum}. ⏰ Rappel : ${action.content} (${dateStr})\n`;
                    break;
                  case 'NOTE':
                    preview += `${stepNum}. 📝 Note sur *${action.client}* : ${action.content}\n`;
                    break;
                  case 'RAPPORT_JOUR':
                    preview += `${stepNum}. 📊 Générer rapport\n`;
                    break;
                  default:
                    preview += `${stepNum}. ❓ ${action.intention}: ${action.content || ''}\n`;
                }
                stepNum++;
              }

              preview += "\n─────────────────\n";
              preview += "1️⃣ *Valider*  │  2️⃣ *Modifier*  │  3️⃣ *Annuler*";

              // Stocker les actions en attente
              pendingFollowUps.set(jid, {
                actions: actionsList,
                timestamp: Date.now(),
                originalInput: textContent || '🎙️ Vocal'
              });

              // Envoyer le preview
              await wa.sock.sendMessage(jid, { text: preview });
              // Store the working JID for proactive notifications
              globalThis.selfJid = jid;
              console.log(`[BRAIN] 📋 Plan proposé (${actionsList.length} actions), en attente de validation...`);
              console.log(`[BRAIN] 💾 selfJid stocké: ${jid}`);

            } catch (brainErr) {
              console.error('[BRAIN] ❌ Erreur:', brainErr.message);
              pendingFollowUps.delete(jid);
              await wa.sock.sendMessage(jid, { text: `❌ Erreur: ${brainErr.message}` });
            }
          }
        }
        // ===== FIN BRAIN =====

        // Handle LID (Linked Identity) messages - map to actual phone JID if possible
        let actualJid = jid;
        if (isLidJid(jid)) {
          const participant = msg.key.participant;
          console.log(`[WA] LID message: ${jid}, participant=${participant}, pushName=${msg.pushName}`);
          if (participant && participant.includes('@s.whatsapp.net')) {
            actualJid = participant;
          } else {
            console.log(`[WA] Processing LID without phone mapping`);
          }
        }

        const text = getMessageText(msg);
        const pushName = getContactName(msg);
        const phone = actualJid.split('@')[0];
        if (pushName) upsertConversation(actualJid, pushName, phone); else upsertConversation(actualJid, null, phone);
        const msgId = msg.key.id || `rt_${Date.now()}`;
        const rawTs = msg.messageTimestamp;
        const ts = typeof rawTs === 'number' ? rawTs * 1000 : (Number(rawTs?.low || rawTs || 0)) * 1000 || Date.now();
        const msgType = getMsgType(msg);
        const isDoc = isDocumentMessage(msg);
        const isMedia = isMediaForDocuments(msg);
        const senderName = fromMe ? 'Moi' : (pushName || phone);

        // Process media even if no text
        if (isMedia) { const mi = getMediaInfo(msg, msgId); if (mi) { insertDocument(`doc_${msgId}`, actualJid, msgId, mi.filename, mi.mimetype, mi.fileSize, null); broadcast({ type: 'document', data: { jid: actualJid, docId: `doc_${msgId}`, ...mi }, timestamp: Date.now() }); } }
        if (hasMedia(msg)) { mediaQueue.unshift({ msg, msgId, convName: pushName || phone, jid: actualJid }); processMediaQueue(); }

        // Skip message insert if no text (but media was already processed above)
        if (!text) {
          const msgKeys = Object.keys(msg.message || {});
          console.log(`[WA] ⚠️ No text from ${actualJid}. Keys: ${msgKeys.join(', ')}`);
          // Still insert a placeholder message for media-only messages
          if (isMedia) {
            const mediaText = isImageMessage(msg) ? '📷 Photo' : isVideoMessage(msg) ? '🎥 Vidéo' : '📎 Document';
            insertMessage(msgId, actualJid, fromMe, senderName, mediaText, ts, msgType, isDoc, null, null);
            updateConversationLastMessage(actualJid, mediaText, ts);
            if (!fromMe && type === 'notify') incrementUnread(actualJid);
          }
          continue;
        }
        insertMessage(msgId, actualJid, fromMe, senderName, text, ts, msgType, isDoc, null, null);
        updateConversationLastMessage(actualJid, text, ts);
        if (!fromMe && type === 'notify') incrementUnread(actualJid);
        broadcast({ type: 'message', data: { jid: actualJid, text, fromMe, name: senderName, timestamp: ts, msgType }, timestamp: Date.now() });
        if (type === 'notify') console.log(`[WA] ${fromMe ? '→' : '←'} ${senderName}: ${text.substring(0,50)}`);
      } catch (err) { console.error('[WA] Msg error:', err.message); }
    }
  });
}

// ==================== CORE SOCKET ====================
async function initSocket() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  console.log(`[WA] Connecting with Baileys v${version.join('.')}`);

  wa.sock = makeWASocket({
    version, auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger, printQRInTerminal: true, browser: ['WA Agent', 'Chrome', '127.0.0'],
    syncFullHistory: true, generateHighQualityLinkPreview: false, markOnlineOnConnect: false,
  });

  // Connection and creds handlers (not hot-reloadable)
  wa.sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) { wa.currentQR = qr; broadcast({ type: 'qr', data: { qr }, timestamp: Date.now() }); }
    if (connection === 'close') {
      wa.currentQR = null;
      stopConnectionMonitoring();
      const code = lastDisconnect?.error?.output?.statusCode;
      const errorMsg = lastDisconnect?.error?.message || 'Unknown';
      console.log(`[WA] Closed: code=${code}, error=${errorMsg}`);

      // Handle connection replaced (another device)
      if (code === 440 || code === DisconnectReason.connectionReplaced) {
        console.log('[WA] ❌ Connection replaced by another device');
        wa.connectionStatus = 'disconnected';
        resetReconnectState();
        broadcast({ type: 'status', data: { status: 'disconnected', reason: 'conflict' }, timestamp: Date.now() });
        try { wa.sock.end(); } catch {} wa.sock = null; return;
      }

      // Handle intentional disconnect
      if (wa.isIntentionalDisconnect) {
        wa.connectionStatus = 'disconnected';
        resetReconnectState();
        broadcast({ type: 'status', data: { status: 'disconnected' }, timestamp: Date.now() });
        return;
      }

      // Handle logged out - try restore from backup first
      if (code === DisconnectReason.loggedOut || code === 401) {
        console.log('[WA] ⚠️ Logged out, attempting session restore...');
        wa.connectionStatus = 'disconnected';

        // Try to restore from backup
        const restored = restoreSession();
        if (restored) {
          console.log('[WA] 🔄 Session restored, reconnecting...');
          wa.reconnectAttempts = 0;
          setTimeout(() => initSocket(), 2000);
          return;
        }

        // No backup available, clear everything
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
        try { fs.mkdirSync(AUTH_DIR, { recursive: true }); } catch {}
        broadcast({ type: 'status', data: { status: 'disconnected', reason: 'logged_out' }, timestamp: Date.now() });
        wa.sock = null;
        resetReconnectState();
        return;
      }

      // Handle temporary disconnection - reconnect with exponential backoff
      wa.consecutiveFailures++;
      wa.reconnectAttempts++;

      // Check if too many failures
      if (wa.consecutiveFailures >= wa.maxConsecutiveFailures) {
        console.error(`[WA] ❌ Too many failures (${wa.consecutiveFailures}/${wa.maxConsecutiveFailures}), stopping...`);
        wa.connectionStatus = 'disconnected';
        broadcast({ type: 'status', data: { status: 'disconnected', reason: 'max_failures' }, timestamp: Date.now() });
        resetReconnectState();
        return;
      }

      const delay = getReconnectDelay();
      console.log(`[WA] 🔄 Reconnecting in ${delay/1000}s (attempt ${wa.reconnectAttempts}, failures ${wa.consecutiveFailures}/${wa.maxConsecutiveFailures})...`);
      wa.connectionStatus = 'connecting';
      broadcast({ type: 'status', data: { status: 'connecting', attempt: wa.reconnectAttempts }, timestamp: Date.now() });
      setTimeout(() => initSocket(), delay);
    }
    if (connection === 'open') {
      wa.currentQR = null;
      wa.connectionStatus = 'connected';
      wa.isReconnecting = false;
      resetReconnectState();
      console.log('[WA] ✅ Connected!');
      broadcast({ type: 'status', data: { status: 'connected' }, timestamp: Date.now() });

      // Start connection monitoring
      startConnectionMonitoring();

      // Create session backup after successful connection
      setTimeout(() => backupSession(), 10000);

      // Force app state sync to get labels
      setTimeout(async () => {
        try {
          console.log('[WA] 🔄 Forcing app state resync for labels...');
          await wa.sock.resyncAppState(['critical_block', 'critical_unblock_low', 'regular_high', 'regular_low', 'regular']);
          console.log('[WA] ✅ App state resync completed');
        } catch (err) {
          console.log('[WA] App state resync failed: ' + err.message);
        }
      }, 5000);

      // 📊 CRON: Rapports automatiques à 8h, 12h, 18h
      if (!g.__waCronScheduled) {
        g.__waCronScheduled = true;
        const schedules = ['0 8 * * *', '0 12 * * *', '0 18 * * *'];
        schedules.forEach(schedule => {
          cron.schedule(schedule, async () => {
            if (wa.connectionStatus !== 'connected' || !wa.sock) return;
            console.log(`⏰ [CRON] Envoi rapport automatique...`);
            try {
              const report = await getTasksReport();
              const myJid = wa.sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
              await wa.sock.sendMessage(myJid, { text: report });
              console.log(`✅ [CRON] Rapport envoyé !`);
            } catch (err) {
              console.error(`❌ [CRON] Erreur:`, err.message);
            }
          }, { timezone: 'Europe/Paris' });
        });
        console.log('[WA] 📊 Cron rapports planifiés: 8h, 12h, 18h');

        // 📬 Notifications Queue Processor (every 3 seconds)
        setInterval(async () => {
          if (wa.connectionStatus !== 'connected' || !wa.sock) return;

          try {
            if (!fs.existsSync(NOTIFICATIONS_PATH)) return;

            const content = fs.readFileSync(NOTIFICATIONS_PATH, 'utf8');
            console.log(`[NOTIF] 📄 Contenu fichier: ${content.substring(0, 200)}`);

            if (!content || content.trim() === '[]') return;

            const notifications = JSON.parse(content);
            if (!notifications.length) return;

            console.log(`[NOTIF] 📬 ${notifications.length} notification(s) à envoyer`);
            console.log(`[NOTIF] 💾 selfJid stocké: ${globalThis.selfJid || 'AUCUN'}`);

            // Utiliser le JID stocké depuis une interaction réussie, sinon fallback
            const selfJid = globalThis.selfJid;
            const myNumber = wa.sock.user?.id?.split(':')[0];
            const fallbackJid = myNumber + '@s.whatsapp.net';

            console.log(`[NOTIF] 📱 myNumber: ${myNumber}`);
            console.log(`[NOTIF] 📱 fallbackJid: ${fallbackJid}`);

            for (const notif of notifications) {
              if (notif.type === 'task_completed') {
                let notifText = `✅ *Tâche terminée*\n${notif.taskName}`;
                if (notif.projectName) {
                  notifText += `\n└ 📁 ${notif.projectName}`;
                }
                notifText += `\n\n_Réponds pour ajouter une tâche à ce projet._`;

                const targetJid = selfJid || fallbackJid;
                console.log(`[NOTIF] 🎯 Envoi vers: ${targetJid}`);

                try {
                  await wa.sock.sendMessage(targetJid, { text: notifText });
                  console.log(`[NOTIF] ✅ Message envoyé avec succès`);
                } catch (sendErr) {
                  console.error(`[NOTIF] ❌ sendMessage échoué:`, sendErr.message);
                  // Fallback si selfJid a échoué
                  if (selfJid && selfJid !== fallbackJid) {
                    console.log(`[NOTIF] 🔄 Essai fallback vers: ${fallbackJid}`);
                    try {
                      await wa.sock.sendMessage(fallbackJid, { text: notifText });
                      console.log(`[NOTIF] ✅ Fallback réussi`);
                    } catch (fallbackErr) {
                      console.error(`[NOTIF] ❌ Fallback échoué aussi:`, fallbackErr.message);
                    }
                  }
                }

                // Store follow-up context
                if (notif.projectId && notif.projectName) {
                  const jidForFollowUp = selfJid || fallbackJid;
                  pendingFollowUps.set(jidForFollowUp, {
                    type: 'task_completed_followup',
                    projectId: notif.projectId,
                    projectName: notif.projectName,
                    taskName: notif.taskName,
                    timestamp: Date.now()
                  });
                  console.log(`[NOTIF] 📝 Follow-up stocké pour: ${jidForFollowUp}`);
                }
              }
            }

            // Clear the queue
            fs.writeFileSync(NOTIFICATIONS_PATH, '[]');
            console.log(`[NOTIF] 🗑️ Queue vidée`);

          } catch (err) {
            console.error('[NOTIF] ❌ Erreur:', err.message, err.stack);
          }
        }, 3000);
        console.log('[WA] 📬 Notifications queue processor démarré');

        // Session backup every 30 minutes while connected
        setInterval(() => {
          if (wa.connectionStatus === 'connected') {
            backupSession();
          }
        }, 30 * 60 * 1000);
        console.log('[WA] 💾 Session backup automatique activé (30min)');
      }
    }
  });

  wa.sock.ev.on('creds.update', saveCreds);

  // Register other event handlers
  registerEventHandlers(wa.sock);
}

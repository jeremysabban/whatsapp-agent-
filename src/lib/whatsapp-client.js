import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, makeCacheableSignalKeyStore, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { upsertConversation, insertMessage, updateConversationLastMessage, incrementUnread, insertDocument, updateMessageMedia, forceUpdateName, upsertLabel, addLabelAssociation, removeLabelAssociation, deleteLabel, insertAgentLog } from './database.js';

const AUTH_DIR = path.join(process.cwd(), 'data', 'auth');
const MEDIA_DIR = path.join(process.cwd(), 'data', 'media');
const DOCS_DIR = path.join(process.cwd(), 'data', 'documents');
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
    activeDownloads: 0
  };
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
function getDocumentInfo(msg) { const m = msg.message; const doc = m.documentMessage||m.documentWithCaptionMessage?.message?.documentMessage; if (!doc) return null; return { filename: doc.fileName||'document', mimetype: doc.mimetype||'application/octet-stream', fileSize: doc.fileLength ? Number(doc.fileLength) : 0 }; }
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
export function getStatus() { return { status: wa.connectionStatus, syncProgress: wa.syncProgress.syncing ? wa.syncProgress : null, mediaQueue: mediaQueue.length }; }
export function getSyncProgress() { return wa.syncProgress; }

export async function sendMessage(jid, text) {
  if (!wa.sock || wa.connectionStatus !== 'connected') throw new Error('WhatsApp non connecté');
  const sent = await wa.sock.sendMessage(jid, { text });
  const msgId = sent.key.id || `sent_${Date.now()}`;
  const ts = Date.now();
  insertMessage(msgId, jid, true, 'Moi', text, ts, 'text', false, null, null);
  updateConversationLastMessage(jid, text, ts);
  broadcast({ type: 'message_sent', data: { jid, text, timestamp: ts }, timestamp: ts });
  return { success: true, messageId: msgId };
}

export async function disconnect() {
  wa.isIntentionalDisconnect = true;
  if (wa.sock) { try { wa.sock.end(); } catch {} wa.sock = null; }
  wa.connectionStatus = 'disconnected'; wa.currentQR = null;
  broadcast({ type: 'status', data: { status: 'disconnected' }, timestamp: Date.now() });
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
          if (!text) continue;
          const fromMe = msg.key.fromMe || false;
          const pushName = getContactName(msg);
          const phone = jid.split('@')[0];
          if (pushName) upsertConversation(jid, pushName, phone); else upsertConversation(jid, null, phone);
          const msgId = msg.key.id || `h_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
          const tsMs = msgTs * 1000;
          const msgType = getMsgType(msg);
          const isDoc = isDocumentMessage(msg);
          const senderName = fromMe ? 'Moi' : (pushName || phone);
          insertMessage(msgId, jid, fromMe, senderName, text, tsMs, msgType, isDoc, null, null);
          updateConversationLastMessage(jid, text, tsMs);
          if (isDoc) { const di = getDocumentInfo(msg); if (di) insertDocument(`doc_${msgId}`, jid, msgId, di.filename, di.mimetype, di.fileSize, null); }
          if (hasMedia(msg)) { queueMediaDownload(msg, msgId, pushName || phone, jid); mediaQueued++; }
          processed++;
        } catch {}
      }
    }
    console.log(`[WA] → ${processed} msgs traités, ${mediaQueued} médias en téléchargement`);
    if (isLatest) { wa.syncProgress.syncing = false; console.log(`[WA] ✅ Sync terminé!`); broadcast({ type: 'sync_complete', data: wa.syncProgress, timestamp: Date.now() }); }
  });

  // ---- REAL-TIME MESSAGES ----
  sock.ev.on('messages.upsert', ({ messages: msgs, type }) => {
    console.log(`[WA] 📨 messages.upsert: ${msgs?.length || 0} messages, type=${type}`);
    for (const msg of msgs) {
      try {
        const jid = msg.key.remoteJid;
        console.log(`[WA] Processing msg from ${jid}, fromMe=${msg.key.fromMe}`);
        if (!jid || isGroupJid(jid) || jid === 'status@broadcast') continue;

        // Handle LID (Linked Identity) messages - map to actual phone JID if possible
        let actualJid = jid;
        if (isLidJid(jid)) {
          // Try to get the actual phone from participant or verifiedBizName
          const participant = msg.key.participant;
          const remotePhone = msg.key.remoteJid?.includes('@s.whatsapp.net') ? msg.key.remoteJid : null;
          // Check messageContextInfo for phone mapping
          const ctxInfo = msg.message?.messageContextInfo;
          const devicePhone = ctxInfo?.deviceListMetadataVersion2?.senderKeyHash ? null : null;

          console.log(`[WA] LID message: ${jid}, participant=${participant}, pushName=${msg.pushName}`);

          // If we can't map the LID to a phone, try to use participant or skip
          if (participant && participant.includes('@s.whatsapp.net')) {
            actualJid = participant;
          } else {
            // Store with LID as JID - we'll try to match later
            console.log(`[WA] Processing LID without phone mapping`);
          }
        }

        const text = getMessageText(msg);
        if (!text) {
          const msgKeys = Object.keys(msg.message || {});
          console.log(`[WA] ⚠️ No text from ${actualJid}. Keys: ${msgKeys.join(', ')}`);
          continue;
        }
        const fromMe = msg.key.fromMe || false;
        const pushName = getContactName(msg);
        const phone = actualJid.split('@')[0];
        if (pushName) upsertConversation(actualJid, pushName, phone); else upsertConversation(actualJid, null, phone);
        const msgId = msg.key.id || `rt_${Date.now()}`;
        const rawTs = msg.messageTimestamp;
        const ts = typeof rawTs === 'number' ? rawTs * 1000 : (Number(rawTs?.low || rawTs || 0)) * 1000 || Date.now();
        const msgType = getMsgType(msg);
        const isDoc = isDocumentMessage(msg);
        const senderName = fromMe ? 'Moi' : (pushName || phone);
        insertMessage(msgId, actualJid, fromMe, senderName, text, ts, msgType, isDoc, null, null);
        updateConversationLastMessage(actualJid, text, ts);
        if (!fromMe && type === 'notify') incrementUnread(actualJid);
        if (isDoc) { const di = getDocumentInfo(msg); if (di) { insertDocument(`doc_${msgId}`, actualJid, msgId, di.filename, di.mimetype, di.fileSize, null); broadcast({ type: 'document', data: { jid: actualJid, docId: `doc_${msgId}`, ...di }, timestamp: Date.now() }); } }
        if (hasMedia(msg)) { mediaQueue.unshift({ msg, msgId, convName: pushName || phone, jid: actualJid }); processMediaQueue(); }
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
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`[WA] Closed: ${code}`);
      if (code === 440 || code === DisconnectReason.connectionReplaced) {
        wa.connectionStatus = 'disconnected';
        broadcast({ type: 'status', data: { status: 'disconnected', reason: 'conflict' }, timestamp: Date.now() });
        try { wa.sock.end(); } catch {} wa.sock = null; return;
      }
      if (wa.isIntentionalDisconnect) { wa.connectionStatus = 'disconnected'; broadcast({ type: 'status', data: { status: 'disconnected' }, timestamp: Date.now() }); return; }
      if (code === DisconnectReason.loggedOut || code === 401) {
        wa.connectionStatus = 'disconnected';
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
        try { fs.mkdirSync(AUTH_DIR, { recursive: true }); } catch {}
        broadcast({ type: 'status', data: { status: 'disconnected', reason: 'logged_out' }, timestamp: Date.now() });
        wa.sock = null; return;
      }
      console.log('[WA] Reconnecting in 3s...');
      wa.connectionStatus = 'connecting';
      broadcast({ type: 'status', data: { status: 'connecting' }, timestamp: Date.now() });
      setTimeout(() => initSocket(), 3000);
    }
    if (connection === 'open') {
      wa.currentQR = null; wa.connectionStatus = 'connected';
      console.log('[WA] ✅ Connected!');
      broadcast({ type: 'status', data: { status: 'connected' }, timestamp: Date.now() });
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
    }
  });

  wa.sock.ev.on('creds.update', saveCreds);

  // Register other event handlers
  registerEventHandlers(wa.sock);
}

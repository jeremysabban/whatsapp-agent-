'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ==================== CONSTANTS ====================
const STATUSES = {
  client: { label: 'Client', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', kanban: 'border-t-emerald-500' },
  assurance: { label: 'Assurance', color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500', kanban: 'border-t-blue-500' },
  prospect: { label: 'Prospect', color: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500', kanban: 'border-t-purple-500' },
  hsva: { label: 'HSVA', color: 'bg-gray-100 text-gray-800 border-gray-200', dot: 'bg-gray-500', kanban: 'border-t-gray-500' },
};
const CATEGORIES = ['Gestion', 'Sinistre', 'Lead'];
const DOC_STATUSES = { recu: 'Reçu', identifie: 'Identifié', classe: 'Classé', traite: 'Traité' };
const DOC_COLORS = { recu: 'bg-gray-100 text-gray-700', identifie: 'bg-amber-100 text-amber-700', classe: 'bg-blue-100 text-blue-700', traite: 'bg-emerald-100 text-emerald-700' };
const LABEL_COLORS = { client: 'bg-emerald-100 text-emerald-700 border-emerald-200', assurance: 'bg-blue-100 text-blue-700 border-blue-200', prospect: 'bg-purple-100 text-purple-700 border-purple-200', important: 'bg-red-100 text-red-700 border-red-200', 'prospect chaud': 'bg-orange-100 text-orange-700 border-orange-200', 'nouveau prospect': 'bg-pink-100 text-pink-700 border-pink-200' };
const TIME_FILTERS = [ { id: null, label: 'Tout' }, { id: '1h', label: '1h' }, { id: '1j', label: '1j' }, { id: '1sem', label: '1 sem' }, { id: '1mois', label: '1 mois' }, { id: '3mois', label: '3 mois' } ];
const LOG_ICONS = { task_created: '✅', project_created: '📁', doc_downloaded: '📥', doc_renamed: '✏️', doc_classified: '📂', dossier_linked: '🔗' };

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return (await fetch(`/api/whatsapp/${path}`, opts)).json();
}

function Icon({ name, className = 'w-4 h-4' }) {
  const icons = {
    menu: <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />,
    message: <><path strokeLinecap="round" strokeLinejoin="round" d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></>,
    file: <><path strokeLinecap="round" strokeLinejoin="round" d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></>,
    dashboard: <><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /></>,
    kanban: <><path d="M6 5v11" /><path d="M12 5v6" /><path d="M18 5v14" /></>,
    settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    back: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
    clip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
    image: <><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    chart: <><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></>,
    wifi: <><path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" /></>,
    qr: <><rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /></>,
    journal: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></>,
    tag: <><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></>,
    edit: <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></>,
    target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    briefcase: <><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" /></>,
    trendUp: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
    notion: <><path d="M4 4.5A.5.5 0 0 1 4.5 4h15a.5.5 0 0 1 .5.5v15a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5v-15Z" /><path d="M7 7h2v9H7z" /><path d="M12 7l4 9h-2l-1-2.5h-2L12 7Z" /></>,
    user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    folder: <><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></>,
    tasks: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    project: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 7h10" /><path d="M7 12h10" /><path d="M7 17h10" /></>,
    contract: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></>,
    drive: <><path d="M12 2L2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></>,
  };
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icons[name]}</svg>);
}

function timeAgo(ts) { if (!ts) return ''; const diff = Date.now() - ts; const mins = Math.floor(diff / 60000); if (mins < 1) return "À l'instant"; if (mins < 60) return `Il y a ${mins} min`; const hours = Math.floor(mins / 60); if (hours < 24) return `Il y a ${hours}h`; const days = Math.floor(hours / 24); if (days === 1) return 'Hier'; if (days < 7) return `Il y a ${days} jours`; return `Il y a ${Math.floor(days / 7)} sem`; }
function daysSince(ts) { if (!ts) return 999; return Math.floor((Date.now() - ts) / 86400000); }
function formatLogTime(ts) { const d = new Date(ts); const now = new Date(); const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === now.toDateString() ? time : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${time}`; }
function getLabelColor(n) { return LABEL_COLORS[n?.toLowerCase()] || 'bg-gray-100 text-gray-600 border-gray-200'; }

// Display name helper: notion_dossier_name > custom_name > whatsapp_name > name > phone
function getName(c) { return c.display_name || c.notion_dossier_name || c.custom_name || c.whatsapp_name || c.name || c.phone || 'Inconnu'; }
function getInitialsFor(c) { return c.display_initials || c.avatar_initials || '??'; }

// ==================== MAIN ====================
export default function WhatsAppAgent() {
  const [view, setView] = useState('dashboard');
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState({});
  const [documents, setDocuments] = useState([]);
  const [selectedJid, setSelectedJid] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [qrImage, setQrImage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [draggedCard, setDraggedCard] = useState(null);
  const [notionSearch, setNotionSearch] = useState('');
  const [notionResults, setNotionResults] = useState([]);
  const [notionSearching, setNotionSearching] = useState(false);
  const [showNotionLink, setShowNotionLink] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showNameSourceModal, setShowNameSourceModal] = useState(false);
  const [showCreateOpp, setShowCreateOpp] = useState(false);
  const [taskForm, setTaskForm] = useState({ name: '', priority: 'À prioriser', date: new Date().toISOString().split('T')[0], projectId: '' });
  const [projectForm, setProjectForm] = useState({ name: '', type: 'Lead', priority: 'À prioriser', niveau: '' });
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionSuccess, setNotionSuccess] = useState(null);
  const [notionError, setNotionError] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [activeLabel, setActiveLabel] = useState('tous');
  const [activeTimePeriod, setActiveTimePeriod] = useState(null);
  const [labelStats, setLabelStats] = useState({ client: 0, assurance: 0, prospect: 0 });
  const [allLabels, setAllLabels] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [agentLogTotal, setAgentLogTotal] = useState(0);
  const [logTypeFilter, setLogTypeFilter] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [editPhoneValue, setEditPhoneValue] = useState('');
  const [dossierProjects, setDossierProjects] = useState([]);
  const [dossierOverview, setDossierOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [dossierDetails, setDossierDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [loadingAllTasks, setLoadingAllTasks] = useState(false);
  const [starredConvs, setStarredConvs] = useState([]);
  const [tagProjectModal, setTagProjectModal] = useState(null); // { tag: 'Gestion' | 'Sinistre' | 'Lead', jid: string }
  const [notionAnalytics, setNotionAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const eventSourceRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const lastMessageCountRef = useRef(0); // Track message count for scroll behavior

  // ==================== DATA FETCHING ====================
  const loadConversations = useCallback(async (label, time) => {
    try {
      const t = time !== undefined ? time : activeTimePeriod;
      const params = new URLSearchParams();
      // Don't filter by status on API - we filter client-side by the status field
      if (t) params.append('time', t);
      const data = await api(`conversations?${params}`);
      setConversations(data.conversations || []); setStats(data.stats || {});
      if (data.labelStats) setLabelStats(data.labelStats);
      if (data.allLabels) setAllLabels(data.allLabels);
    } catch (e) { console.error('Load error:', e); }
  }, [activeTimePeriod]);

  const loadDocuments = useCallback(async () => { try { const d = await api('documents'); setDocuments(d.documents || []); } catch {} }, []);
  const loadMessages = useCallback(async (jid) => { try { const d = await api(`messages/${encodeURIComponent(jid)}`); setSelectedMessages(d.messages || []); setSelectedDocs(d.documents || []); setSelectedConv(d.conversation || null); } catch {} }, []);
  const loadAgentLogs = useCallback(async (type) => { try { const t = type !== undefined ? type : logTypeFilter; const p = new URLSearchParams({ limit: '100', offset: '0' }); if (t) p.append('type', t); const d = await api(`agent-log?${p}`); setAgentLogs(d.logs || []); setAgentLogTotal(d.total || 0); } catch {} }, [logTypeFilter]);
  const checkStatus = useCallback(async () => { try { const d = await api('status'); setConnected(d.status === 'connected'); setConnecting(d.status === 'connecting'); } catch {} }, []);
  const loadDossierProjects = useCallback(async (dossierId) => {
    if (!dossierId) { setDossierProjects([]); return; }
    try { const r = await fetch(`/api/notion/get-projects?dossierId=${encodeURIComponent(dossierId)}`); const d = await r.json(); setDossierProjects(d.projects || []); } catch { setDossierProjects([]); }
  }, []);
  const loadDossierOverview = useCallback(async (dossierId) => {
    if (!dossierId) { setDossierOverview(null); return; }
    setLoadingOverview(true);
    try { const r = await fetch(`/api/notion/dossier-overview?dossierId=${encodeURIComponent(dossierId)}`); const d = await r.json(); setDossierOverview(d.error ? null : d); } catch { setDossierOverview(null); }
    setLoadingOverview(false);
  }, []);
  const loadDossierDetails = useCallback(async (dossierId, forceRefresh = false) => {
    if (!dossierId) { setDossierDetails(null); return; }
    setLoadingDetails(true);
    try {
      // First, try to get from cache
      if (!forceRefresh) {
        const cachedRes = await fetch(`/api/notion/dossier-details?dossierId=${encodeURIComponent(dossierId)}&cached=true`);
        const cached = await cachedRes.json();
        if (!cached.error && cached.fromCache) {
          setDossierDetails(cached);
          setLoadingDetails(false);
          // If cache is stale, refresh in background
          if (cached.isStale) {
            fetch(`/api/notion/dossier-details?dossierId=${encodeURIComponent(dossierId)}&refresh=true`)
              .then(r => r.json())
              .then(d => { if (!d.error) setDossierDetails(d); });
          }
          return;
        }
      }
      // No cache or force refresh - fetch from Notion
      const r = await fetch(`/api/notion/dossier-details?dossierId=${encodeURIComponent(dossierId)}`);
      const d = await r.json();
      setDossierDetails(d.error ? null : d);
    } catch { setDossierDetails(null); }
    setLoadingDetails(false);
  }, []);
  const loadAllTasks = useCallback(async () => {
    setLoadingAllTasks(true);
    try { const r = await fetch('/api/notion/all-tasks?completed=true'); const d = await r.json(); setAllTasks(d.tasks || []); } catch { setAllTasks([]); }
    setLoadingAllTasks(false);
  }, []);
  const loadNotionAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try { const r = await fetch('/api/notion/analytics'); const d = await r.json(); setNotionAnalytics(d); } catch { setNotionAnalytics(null); }
    setLoadingAnalytics(false);
  }, []);
  const loadStarredConvs = useCallback(async () => {
    try { const d = await api('conversations?starred=1'); setStarredConvs(d.conversations?.filter(c => c.starred) || []); } catch { setStarredConvs([]); }
  }, []);
  const toggleStar = async (jid, currentStarred) => {
    await api('update-status', 'POST', { jid, starred: !currentStarred });
    loadConversations();
    loadStarredConvs();
    if (selectedJid === jid) loadMessages(jid);
  };

  // ==================== SSE ====================
  useEffect(() => {
    checkStatus(); loadConversations(); loadDocuments(); loadStarredConvs(); loadAllTasks();
    const es = new EventSource('/api/whatsapp/events'); eventSourceRef.current = es;
    es.onmessage = (event) => { try { const d = JSON.parse(event.data);
      if (d.type === 'status') { setConnected(d.data.status === 'connected'); setConnecting(d.data.status === 'connecting'); if (d.data.status === 'connected') { setQrImage(null); loadConversations(); } }
      else if (d.type === 'qr') fetchQR();
      else if (d.type === 'message' || d.type === 'message_sent') { loadConversations(); if (selectedJid === d.data.jid) loadMessages(d.data.jid); }
      else if (d.type === 'document') { loadDocuments(); loadConversations(); }
      else if (d.type === 'labels_updated' || d.type === 'sync_progress' || d.type === 'sync_complete' || d.type === 'contacts_updated') { loadConversations(); loadDocuments(); }
    } catch {} };
    es.onerror = () => {};
    const iv = setInterval(() => { loadConversations(); loadDocuments(); }, 30000);
    return () => { es.close(); clearInterval(iv); };
  }, []);

  useEffect(() => {
    if (selectedMessages.length > 0) {
      const isInitialLoad = lastMessageCountRef.current === 0;
      const isNewMessage = selectedMessages.length > lastMessageCountRef.current;
      lastMessageCountRef.current = selectedMessages.length;
      // Instant scroll on initial load, smooth for new messages
      if (isInitialLoad) {
        messagesEndRef.current?.scrollIntoView();
      } else if (isNewMessage) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [selectedMessages]);
  useEffect(() => { loadConversations(activeLabel, activeTimePeriod); }, [activeLabel, activeTimePeriod]);
  useEffect(() => { if (view === 'journal') loadAgentLogs(); }, [view, logTypeFilter]);

  // ==================== ACTIONS ====================
  const handleConnect = async () => { setConnecting(true); await api('connect', 'POST'); const iv = setInterval(async () => { const d = await api('qr'); if (d.qr) setQrImage(d.qr); if (d.status === 'connected' || d.status === 'disconnected') { clearInterval(iv); if (d.status === 'connected') { setConnected(true); setConnecting(false); setQrImage(null); } } }, 2000); };
  const fetchQR = async () => { const d = await api('qr'); if (d.qr) setQrImage(d.qr); };
  const handleDisconnect = async () => { await api('disconnect', 'POST'); setConnected(false); setConnecting(false); setQrImage(null); };
  const openConversation = (conv) => { setSelectedJid(conv.jid); setView('detail'); lastMessageCountRef.current = 0; loadMessages(conv.jid); setEditingName(false); setEditingEmail(false); if (conv.notion_dossier_id) { loadDossierDetails(conv.notion_dossier_id); loadDossierProjects(conv.notion_dossier_id); } else { setDossierDetails(null); setDossierProjects([]); } };
  const updateStatus = async (jid, s) => { await api('update-status', 'POST', { jid, status: s }); loadConversations(); if (selectedJid === jid) loadMessages(jid); };
  const updateCategory = async (jid, c) => { await api('update-status', 'POST', { jid, category: c }); loadConversations(); if (selectedJid === jid) loadMessages(jid); };
  const toggleTag = async (jid, tag, currentTags) => {
    const tags = currentTags || [];
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    await api('update-status', 'POST', { jid, tags: newTags });
    loadConversations();
    if (selectedJid === jid) loadMessages(jid);
  };
  const updatePriority = async (jid, p) => { await api('update-status', 'POST', { jid, priority: p }); loadConversations(); };
  const updateDocStatus = async (docId, s) => { await api('update-doc-status', 'POST', { docId, status: s }); loadDocuments(); if (selectedJid) loadMessages(selectedJid); };
  const sendMsg = async () => { const text = messageInputRef.current?.value?.trim(); if (!text || !selectedJid) return; const opt = { id: `opt_${Date.now()}`, text, from_me: true, timestamp: Date.now(), is_document: false }; setSelectedMessages(prev => [...prev, opt]); if (messageInputRef.current) messageInputRef.current.value = ''; try { await api('send', 'POST', { jid: selectedJid, text }); loadMessages(selectedJid); } catch {} };
  const updateName = async (jid, name) => { if (!name.trim()) return; await api('update-status', 'POST', { jid, custom_name: name.trim() }); setEditingName(false); loadConversations(); loadMessages(jid); };
  const updateEmail = async (jid, email) => { await api('update-status', 'POST', { jid, email: email?.trim() || '' }); setEditingEmail(false); loadConversations(); loadMessages(jid); };
  const updatePhone = async (jid, phone) => { await api('update-status', 'POST', { jid, phone: phone?.trim() || '' }); setEditingPhone(false); loadConversations(); loadMessages(jid); };

  // Notion
  const searchDossiers = async (q) => { setNotionSearching(true); setNotionError(null); try { const r = await fetch('/api/notion/search-dossiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) }); const d = await r.json(); if (d.error) { setNotionError(d.error); setNotionResults([]); } else setNotionResults(d.results || []); } catch { setNotionError('Erreur Notion'); setNotionResults([]); } setNotionSearching(false); };
  const linkDossier = async (dossier) => { if (!selectedJid) return; setNotionLoading(true); try { await fetch('/api/notion/link-dossier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jid: selectedJid, dossierId: dossier.id, dossierName: dossier.name, dossierUrl: dossier.url }) }); setShowNotionLink(false); setNotionSuccess('Dossier lié !'); setTimeout(() => setNotionSuccess(null), 3000); loadMessages(selectedJid); loadConversations(); loadDossierProjects(dossier.id); loadDossierDetails(dossier.id); } catch {} setNotionLoading(false); };
  const createTask = async () => { if (!taskForm.name) return; setNotionLoading(true); try { const r = await fetch('/api/notion/create-task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: taskForm.name, priority: taskForm.priority, date: taskForm.date || null, dossierId: selectedConv?.notion_dossier_id, dossierName: selectedConv?.notion_dossier_name, conversationJid: selectedJid, conversationName: selectedConv?.name, projectId: taskForm.projectId || null }) }); const d = await r.json(); if (d.success) { setShowCreateTask(false); setTaskForm({ name: '', priority: 'À prioriser', date: new Date().toISOString().split('T')[0], projectId: '' }); setNotionSuccess('Tâche créée !'); setTimeout(() => setNotionSuccess(null), 3000); if (selectedConv?.notion_dossier_id) loadDossierDetails(selectedConv.notion_dossier_id, true); } else alert('Erreur: ' + (d.error || '?')); } catch (e) { alert('Erreur: ' + e.message); } setNotionLoading(false); };
  const createProject = async () => { if (!projectForm.name) return; setNotionLoading(true); try { const r = await fetch('/api/notion/create-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: projectForm.name, type: projectForm.type, priority: projectForm.priority, niveau: projectForm.niveau || null, date: new Date().toISOString().split('T')[0], dossierId: selectedConv?.notion_dossier_id, dossierName: selectedConv?.notion_dossier_name, conversationJid: selectedJid, conversationName: selectedConv?.name }) }); const d = await r.json(); if (d.success) { setShowCreateOpp(false); setProjectForm({ name: '', type: 'Lead', priority: 'À prioriser', niveau: '' }); setNotionSuccess('Projet créé !'); setTimeout(() => setNotionSuccess(null), 3000); loadDossierProjects(selectedConv?.notion_dossier_id); if (selectedConv?.notion_dossier_id) loadDossierDetails(selectedConv.notion_dossier_id, true); } else alert('Erreur: ' + (d.error || '?')); } catch (e) { alert('Erreur: ' + e.message); } setNotionLoading(false); };
  const syncToNotion = async () => { if (!selectedConv) return; setNotionLoading(true); try { const r = await fetch('/api/notion/sync-contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: selectedConv.name, phone: selectedConv.phone, email: selectedConv.email || null, dossierId: selectedConv.notion_dossier_id || null }) }); const d = await r.json(); if (d.success) { setNotionSuccess(d.action === 'created' ? 'Contact Notion créé !' : 'Contact Notion mis à jour !'); setTimeout(() => setNotionSuccess(null), 3000); } else alert('Erreur: ' + (d.error || '?')); } catch (e) { alert('Erreur: ' + e.message); } setNotionLoading(false); };

  // Link conversation to a Notion contact
  const linkConversationToContact = async (contact) => {
    if (!selectedJid) return;
    await api('update-status', 'POST', { jid: selectedJid, notion_contact_id: contact.id, notion_contact_name: contact.name, notion_contact_url: contact.url });
    loadConversations();
    if (selectedJid) loadMessages(selectedJid);
  };

  // Update name source
  const updateNameSource = async (source, customName = null) => {
    if (!selectedJid) return;
    const body = { jid: selectedJid, name_source: source };
    if (source === 'manual' && customName) body.custom_name = customName;
    if (source === 'whatsapp' || source === 'dossier') body.notion_contact_id = null; // unlink contact
    await api('update-status', 'POST', body);
    loadConversations();
    if (selectedJid) loadMessages(selectedJid);
    setShowNameSourceModal(false);
  };

  // ==================== SIDEBAR ====================
  const Sidebar = () => (<div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-950 text-white transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:relative lg:z-0 flex flex-col`}>
    <div className="p-4 border-b border-gray-800"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center"><Icon name="message" className="w-5 h-5 text-white" /></div><div><h1 className="font-bold text-sm">WA Agent</h1><p className="text-xs text-gray-400">Smart Value</p></div></div>
    <div className={`mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${connected ? 'bg-emerald-500/10 text-emerald-400' : connecting ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}><div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : connecting ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />{connected ? 'WhatsApp connecté' : connecting ? 'Connexion...' : 'Déconnecté'}</div></div>
    <nav className="flex-1 p-3 space-y-1">{[
      { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
      { id: 'kanban', icon: 'kanban', label: 'Pipeline' },
      { id: 'conversations', icon: 'message', label: 'Conversations', badge: (labelStats.client||0)+(labelStats.assurance||0)+(labelStats.prospect||0) },
      { id: 'documents', icon: 'file', label: 'Documents', badge: stats.pending_docs || 0 },
      { id: 'analytics', icon: 'chart', label: 'Analytics' },
      { id: 'settings', icon: 'settings', label: 'Paramètres' },
    ].map((item) => (<button key={item.id} onClick={() => { setView(item.id); setSidebarOpen(false); if (item.id !== 'detail') setSelectedJid(null); }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${view === item.id || (view === 'detail' && item.id === 'conversations') ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
      <Icon name={item.icon} className="w-4 h-4 flex-shrink-0" /><span className="flex-1 text-left">{item.label}</span>
      {item.badge > 0 && <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">{item.badge}</span>}
    </button>))}</nav>
    <div className="p-3 border-t border-gray-800"><div className="flex items-center gap-3 px-3 py-2"><div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold">JY</div><div><p className="text-sm font-medium">Jeremy</p><p className="text-xs text-gray-400">Smart Value</p></div></div></div>
  </div>);

  // ==================== CONVERSATION ROW ====================
  const ConversationRow = ({ conv: c, onClick, onStarClick }) => (<button onClick={onClick} className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
    <div className="relative flex-shrink-0"><div className={`w-10 h-10 rounded-full ${c.avatar_color} flex items-center justify-center text-white text-xs font-bold`}>{getInitialsFor(c)}</div>
    {c.unread_count > 0 && <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{c.unread_count}</span>}</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2"><p className="font-medium text-sm text-gray-900 truncate">{getName(c)}</p>
      {c.starred && <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
      {c.priority === 'high' && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Urgent</span>}
      {c.unread_count > 0 && <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">{c.unread_count}</span>}</div>
      <p className="text-xs text-gray-500 truncate">{c.last_message || 'Aucun message'}</p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {c.labels?.map((lbl) => (<span key={lbl} className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${getLabelColor(lbl)}`}>{lbl}</span>))}
        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUSES[c.status]?.color || ''}`}>{STATUSES[c.status]?.label || c.status}</span>
        {(c.document_count||0) > 0 && <span className="text-xs text-gray-400 flex items-center gap-1"><Icon name="clip" className="w-3 h-3" /> {c.document_count}</span>}
        {c.notion_dossier_id && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-900 text-white font-bold">N</span>}
      </div>
    </div>
    <div className="flex-shrink-0 text-right"><p className="text-xs text-gray-400">{timeAgo(c.last_message_time)}</p></div>
  </button>);

  // ==================== DASHBOARD ====================
  const Dashboard = () => {
    const statusCounts = { client: conversations.filter(c => c.status === 'client').length, assurance: conversations.filter(c => c.status === 'assurance').length, prospect: conversations.filter(c => c.status === 'prospect').length };
    const [taskTab, setTaskTab] = useState('faire');
    const [updatingTask, setUpdatingTask] = useState(null);

    // Eisenhower quadrants based on priority status
    const EISENHOWER_TABS = [
      { id: 'faire', label: '🔴 Faire', color: 'bg-red-100 text-red-700', border: 'border-red-200', priorities: ['Urg & Imp'] },
      { id: 'planifier', label: '🟡 Planifier', color: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200', priorities: ['Important'] },
      { id: 'deleguer', label: '🟠 Déléguer', color: 'bg-orange-100 text-orange-700', border: 'border-orange-200', priorities: ['Urgent'] },
      { id: 'eliminer', label: '⚪ Éliminer', color: 'bg-gray-100 text-gray-600', border: 'border-gray-200', priorities: ['Secondaire', 'En attente', 'À prioriser'] },
      { id: 'terminees', label: '✅ Terminées', color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200', priorities: [] },
    ];

    const getTasksForTab = (tabId) => {
      if (tabId === 'terminees') return allTasks.filter(t => t.completed);
      const tab = EISENHOWER_TABS.find(t => t.id === tabId);
      if (!tab) return [];
      return allTasks.filter(t => !t.completed && tab.priorities.includes(t.priority));
    };

    const filteredTasks = getTasksForTab(taskTab);
    const currentTab = EISENHOWER_TABS.find(t => t.id === taskTab);

    // Update task in Notion
    const updateTask = async (task, updates) => {
      setUpdatingTask(task.id);
      try {
        await fetch('/api/notion/update-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, updates, dossierId: task.dossierId, taskName: task.name }),
        });
        loadAllTasks(); // Refresh
      } catch (e) { console.error('Update task error:', e); }
      setUpdatingTask(null);
    };

    // Navigate to conversation linked to task's dossier
    const navigateToTaskConversation = (task) => {
      if (task.contact?.jid) {
        const conv = conversations.find(c => c.jid === task.contact.jid);
        if (conv) { openConversation(conv); return; }
      }
      // Fallback: open in Notion
      if (task.url) window.open(task.url, '_blank');
    };

    return (
      <div className="space-y-6">
        <div><h2 className="text-2xl font-bold text-gray-900">Dashboard</h2><p className="text-gray-500 text-sm mt-1">Vue d'ensemble</p></div>

        {/* WhatsApp connection alert */}
        {!connected && !connecting && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3"><Icon name="wifi" className="w-5 h-5 text-amber-500" /><div><p className="font-semibold text-amber-800 text-sm">WhatsApp non connecté</p><p className="text-amber-600 text-xs">Connecte-toi pour recevoir les messages</p></div></div>
            <button onClick={() => setView('settings')} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600">Connecter</button>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[{ label:'Client', val: statusCounts.client, bg:'bg-emerald-50', color:'text-emerald-700', border:'border-emerald-200', click:()=>{setActiveLabel('client');setView('conversations');} },
            { label:'Assurance', val: statusCounts.assurance, bg:'bg-blue-50', color:'text-blue-700', border:'border-blue-200', click:()=>{setActiveLabel('assurance');setView('conversations');} },
            { label:'Prospect', val: statusCounts.prospect, bg:'bg-purple-50', color:'text-purple-700', border:'border-purple-200', click:()=>{setActiveLabel('prospect');setView('conversations');} },
            { label:'Tâches', val: allTasks.filter(t => !t.completed).length, bg:'bg-amber-50', color:'text-amber-700', border:'border-amber-200', click:()=>{} }
          ].map(s => (<div key={s.label} onClick={s.click} className={`bg-white rounded-xl border ${s.border} p-4 cursor-pointer hover:shadow-sm`}><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}><span className={`font-bold text-sm ${s.color}`}>{s.label[0]}</span></div><div><p className={`text-2xl font-bold ${s.color}`}>{s.val}</p><p className="text-xs text-gray-500">{s.label}</p></div></div></div>))}
        </div>

        {/* Section 1: Starred contacts */}
        {starredConvs.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg> Favoris ({starredConvs.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {starredConvs.map(c => (
                <button key={c.jid} onClick={() => openConversation(c)} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow text-left">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${c.avatar_color} flex items-center justify-center text-white font-bold`}>{getInitialsFor(c)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{getName(c)}</p>
                      <p className={`text-xs ${STATUSES[c.status]?.color || 'text-gray-500'}`}>{STATUSES[c.status]?.label || c.status}</p>
                    </div>
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 truncate">{c.last_message || 'Aucun message'}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section 2: Tasks with Eisenhower Tabs */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Icon name="tasks" className="w-5 h-5 text-blue-500" /> Tâches Notion</h3>
            <button onClick={loadAllTasks} disabled={loadingAllTasks} className="text-blue-600 text-sm hover:underline flex items-center gap-1">
              {loadingAllTasks && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500" />}
              {loadingAllTasks ? 'Chargement...' : '↻ Actualiser'}
            </button>
          </div>
          {/* Eisenhower tabs */}
          <div className="flex gap-2 p-3 border-b border-gray-100 overflow-x-auto">
            {EISENHOWER_TABS.map(tab => {
              const count = getTasksForTab(tab.id).length;
              return (
                <button key={tab.id} onClick={() => setTaskTab(tab.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 ${taskTab === tab.id ? tab.color + ' ' + tab.border + ' border' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                  {tab.label} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
          {loadingAllTasks ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" /></div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Aucune tâche dans cette catégorie</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredTasks.slice(0, 30).map(t => (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${updatingTask === t.id ? 'opacity-50' : ''}`}>
                  {/* Checkbox */}
                  <button onClick={() => updateTask(t, { completed: !t.completed })} disabled={updatingTask === t.id} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${t.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'}`}>
                    {t.completed && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  {/* Task name - click to navigate */}
                  <button onClick={() => navigateToTaskConversation(t)} className={`flex-1 text-left min-w-0 ${t.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    <span className="font-medium hover:text-blue-600 truncate block">{t.name}</span>
                    <span className="text-xs text-gray-500 truncate block">
                      {t.contact?.name || t.dossier?.name || ''}
                      {t.project && <span className="text-gray-400"> · {t.project.name}</span>}
                    </span>
                  </button>
                  {/* Priority selector (only for non-completed) */}
                  {!t.completed && (
                    <select value={t.priority} onChange={e => updateTask(t, { priority: e.target.value })} disabled={updatingTask === t.id} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 cursor-pointer hover:bg-gray-100">
                      <option value="Urg & Imp">🔴 Urg & Imp</option>
                      <option value="Important">🟡 Important</option>
                      <option value="Urgent">🟠 Urgent</option>
                      <option value="Secondaire">⚪ Secondaire</option>
                      <option value="À prioriser">📋 À prioriser</option>
                    </select>
                  )}
                  {/* Due date */}
                  {t.date ? (
                    <span className={`text-xs flex-shrink-0 ${t.dateStatus === 'overdue' ? 'text-red-600 font-semibold' : t.dateStatus === 'today' ? 'text-orange-600 font-semibold' : 'text-gray-500'}`}>
                      {t.dateStatus === 'overdue' && '⚠️ '}{new Date(t.date).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}
                    </span>
                  ) : t.completed && t.completedAt ? (
                    <span className="text-xs text-gray-400">✓ {new Date(t.completedAt).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}</span>
                  ) : null}
                </div>
              ))}
              {filteredTasks.length > 30 && <div className="p-3 text-center text-xs text-gray-400">+{filteredTasks.length - 30} autres tâches</div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==================== KANBAN ====================
  const Kanban = () => (<div className="space-y-4">
    <div><h2 className="text-2xl font-bold text-gray-900">Pipeline</h2><p className="text-gray-500 text-sm mt-1">Glisse les cartes</p></div>
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0">{['client','assurance','prospect'].map(status => { const info = STATUSES[status]; const items = conversations.filter(c => c.status === status); return (
      <div key={status} className="flex-shrink-0 w-72 lg:flex-1 lg:min-w-0" onDragOver={e => e.preventDefault()} onDrop={() => { if (draggedCard) { updateStatus(draggedCard, status); setDraggedCard(null); } }}>
      <div className={`rounded-xl bg-gray-50 border border-gray-200 border-t-4 ${info.kanban}`}><div className="p-3 flex items-center gap-2"><span className="font-semibold text-sm text-gray-700">{info.label}</span><span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{items.length}</span></div>
      <div className="p-2 space-y-2 min-h-[100px]">{items.map(c => (<div key={c.jid} draggable onDragStart={() => setDraggedCard(c.jid)} onClick={() => openConversation(c)} className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow">
        <div className="flex items-start gap-2.5"><div className={`w-8 h-8 rounded-full ${c.avatar_color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{getInitialsFor(c)}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-1.5"><p className="font-medium text-sm text-gray-900 truncate">{getName(c)}</p>{c.priority==='high' && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}</div><p className="text-xs text-gray-500 truncate mt-0.5">{c.last_message}</p></div></div>
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">{c.labels?.map(l => (<span key={l} className={`text-xs px-1.5 py-0.5 rounded-full border ${getLabelColor(l)}`}>{l}</span>))}{(c.tags||[]).map(tag => (<span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{tag}</span>))}{(c.tags||[]).length===0 && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{c.category}</span>}{(c.document_count||0)>0 && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 flex items-center gap-1"><Icon name="clip" className="w-3 h-3" /> {c.document_count}</span>}{c.unread_count>0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">{c.unread_count}</span>}</div>
        <p className="text-xs text-gray-400 mt-2">{timeAgo(c.last_message_time)}</p>
      </div>))}</div></div></div>); })}</div>
  </div>);

  // ==================== CONVERSATIONS LIST ====================
  const ConversationsList = () => {
    const statusCounts = {
      client: conversations.filter(c => c.status === 'client').length,
      assurance: conversations.filter(c => c.status === 'assurance').length,
      prospect: conversations.filter(c => c.status === 'prospect').length,
      hsva: conversations.filter(c => c.status === 'hsva').length,
    };
    const svaConvs = conversations.filter(c => c.status !== 'hsva');
    const getFiltered = () => {
      let base = conversations;
      if (activeLabel === 'tous') base = svaConvs;
      else if (activeLabel === 'client') base = conversations.filter(c => c.status === 'client');
      else if (activeLabel === 'assurance') base = conversations.filter(c => c.status === 'assurance');
      else if (activeLabel === 'prospect') base = conversations.filter(c => c.status === 'prospect');
      else if (activeLabel === 'hsva') base = conversations.filter(c => c.status === 'hsva');
      return base.filter(c => getName(c).toLowerCase().includes(searchQuery.toLowerCase()) || (c.last_message||'').toLowerCase().includes(searchQuery.toLowerCase()));
    };
    const filtered = getFiltered();
    const tabs = [{ id:'tous', label:'Tous', count:svaConvs.length, activeBg:'bg-gray-900 text-white' }, { id:'client', label:'Client', count:statusCounts.client, activeBg:'bg-emerald-600 text-white' }, { id:'assurance', label:'Assurance', count:statusCounts.assurance, activeBg:'bg-blue-600 text-white' }, { id:'prospect', label:'Prospect', count:statusCounts.prospect, activeBg:'bg-purple-600 text-white' }, { id:'hsva', label:'HSVA', count:statusCounts.hsva, activeBg:'bg-orange-500 text-white' }];
    return (<div className="space-y-4">
      <div><h2 className="text-2xl font-bold text-gray-900">Conversations</h2><p className="text-gray-500 text-sm mt-1">Filtrées par statut</p></div>
      <div className="flex gap-2 flex-wrap">{tabs.map(tab => (<button key={tab.id} onClick={() => setActiveLabel(tab.id)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeLabel === tab.id ? tab.activeBg : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{tab.label} <span className={`ml-1 ${activeLabel===tab.id?'opacity-80':'opacity-60'}`}>({tab.count})</span></button>))}</div>
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg"><span className="text-xs text-gray-500 px-2 flex-shrink-0">Période :</span>{TIME_FILTERS.map(tf => (<button key={tf.id||'all'} onClick={() => setActiveTimePeriod(tf.id)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTimePeriod === tf.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{tf.label}</button>))}</div>
      <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">{filtered.map(c => <ConversationRow key={c.jid} conv={c} onClick={() => openConversation(c)} />)}{filtered.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">{conversations.length===0?(connected?'Aucune conv avec cette étiquette':'Connecte WhatsApp'):'Aucun résultat'}</div>}</div>
    </div>); };

  // ==================== DETAIL (2-column layout) ====================
  const Detail = () => {
    if (!selectedConv) return <div className="p-8 text-center text-gray-400">Chargement...</div>;
    const c = selectedConv;
    const TAG_COLORS = { Gestion: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', full: 'bg-green-500 text-white' }, Sinistre: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', full: 'bg-red-500 text-white' }, Lead: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', full: 'bg-purple-500 text-white' } };

    // Get task date status
    const getDateStatus = (date) => {
      if (!date) return null;
      const today = new Date().toISOString().split('T')[0];
      if (date < today) return 'overdue';
      if (date === today) return 'today';
      return null;
    };

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200 mb-4">
          <button onClick={() => { setView('conversations'); setSelectedJid(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><Icon name="back" className="w-5 h-5 text-gray-600" /></button>
          <div className={`w-10 h-10 rounded-full ${c.avatar_color} flex items-center justify-center text-white text-sm font-bold`}>{getInitialsFor(c)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-gray-900">{getName(c)}</h2>
              <button onClick={() => { setEditNameValue(c.custom_name || c.whatsapp_name || getName(c)); setShowNameSourceModal(true); }} className="p-1 hover:bg-gray-100 rounded"><Icon name="edit" className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
              {c.name_source && c.name_source !== 'whatsapp' && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${c.name_source === 'contact' ? 'bg-emerald-100 text-emerald-700' : c.name_source === 'dossier' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {c.name_source === 'contact' ? '📇' : c.name_source === 'dossier' ? '📁' : '✏️'}
                </span>
              )}
            </div>
            {editingPhone ? (
              <div className="flex items-center gap-1">
                <input type="tel" value={editPhoneValue} onChange={e => setEditPhoneValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') updatePhone(c.jid, editPhoneValue); if (e.key === 'Escape') setEditingPhone(false); }} className="text-xs px-1.5 py-0.5 rounded border border-gray-300 bg-white w-36 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="+33 6 12 34 56 78" autoFocus />
                <button onClick={() => updatePhone(c.jid, editPhoneValue)} className="text-emerald-600 text-xs">✓</button>
                <button onClick={() => setEditingPhone(false)} className="text-gray-400 text-xs">✕</button>
              </div>
            ) : (
              <p className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 group flex items-center gap-1" onClick={() => { setEditPhoneValue(c.phone || ''); setEditingPhone(true); }}><span className="group-hover:underline">{c.phone || 'Ajouter téléphone'}</span></p>
            )}
          </div>
          {/* Star button */}
          <button onClick={() => toggleStar(c.jid, c.starred)} className={`p-2 rounded-lg transition-colors ${c.starred ? 'bg-amber-100 text-amber-500' : 'hover:bg-gray-100 text-gray-400'}`} title={c.starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            <svg className="w-5 h-5" fill={c.starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
          </button>
          <select value={c.priority} onChange={e => updatePriority(c.jid, e.target.value)} className={`text-xs px-2 py-1 rounded border ${c.priority==='high'?'bg-red-100 text-red-700 border-red-200':c.priority==='medium'?'bg-amber-100 text-amber-700 border-amber-200':'bg-gray-100 text-gray-700 border-gray-200'}`}><option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Urgente</option></select>
          <select value={c.status} onChange={e => updateStatus(c.jid, e.target.value)} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${STATUSES[c.status]?.color||''}`}>{Object.entries(STATUSES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-2 flex-wrap pb-4">
          <span className="text-xs text-gray-500">Tags :</span>
          {CATEGORIES.map(tag => {
            const isActive = (c.tags || []).includes(tag);
            const hasProject = c.tag_projects && c.tag_projects[tag];
            const colors = TAG_COLORS[tag];
            return (
              <button key={tag} onClick={() => {
                if (!isActive) { toggleTag(c.jid, tag, c.tags); }
                else if (!c.notion_dossier_id) { alert('Liez d\'abord un dossier Notion'); }
                else { setTagProjectModal({ tag, jid: c.jid }); }
              }} className={`text-xs px-2 py-1 rounded-full border transition-colors ${isActive ? (hasProject ? colors.full : `${colors.bg} ${colors.text} ${colors.border}`) : 'bg-gray-50 text-gray-400 border-gray-200 border-dashed hover:bg-gray-100'}`}>
                {isActive && (hasProject ? '✓ ' : '○ ')}{tag}
              </button>
            );
          })}
          <span className="text-xs text-gray-500 ml-4">Email :</span>
          {editingEmail ? (
            <div className="flex items-center gap-1">
              <input type="email" value={editEmailValue} onChange={e => setEditEmailValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') updateEmail(c.jid, editEmailValue); if (e.key === 'Escape') setEditingEmail(false); }} className="text-xs px-2 py-1 rounded border border-gray-300 bg-white w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="email@exemple.com" autoFocus />
              <button onClick={() => updateEmail(c.jid, editEmailValue)} className="text-emerald-600 text-xs">✓</button>
              <button onClick={() => setEditingEmail(false)} className="text-gray-400 text-xs">✕</button>
            </div>
          ) : (
            <button onClick={() => { setEditEmailValue(c.email || ''); setEditingEmail(true); }} className="text-xs text-blue-600 hover:underline">{c.email || '+ Ajouter'}</button>
          )}
          <button onClick={syncToNotion} disabled={notionLoading} className="ml-auto px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium flex items-center gap-1.5"><span className="font-bold">N</span> Sync</button>
        </div>

        {/* 2-column layout */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* LEFT COLUMN: Messages (60%) */}
          <div className="w-[60%] flex flex-col min-h-0">
            {notionSuccess && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700 flex items-center gap-2 mb-2"><Icon name="check" className="w-4 h-4" /> {notionSuccess}</div>}
            <div className="flex-1 bg-[#e5ddd5] rounded-xl border border-gray-200 p-4 space-y-2 overflow-y-auto" style={{backgroundImage:'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAG1BMVEXd2tfd2tfd2tfd2tfd2tfd2tfd2tfd2tfd2tcEcYl5AAAACXRSTlMABAgMEBQYHCAk1OKnAAAAP0lEQVQ4y2NgGAWjYBSMgsENGP8TBIx/EQSMfxEE/+8iBhj/IggY/yIIGP8iBv4iBBj/IgQY/yIEGP8OUgAAAPsED0TzS7oAAAAASUVORK5CYII=")'}}>
              {selectedMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.from_me?'justify-end':'justify-start'}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-lg text-sm shadow-sm ${msg.from_me?'bg-[#dcf8c6] text-gray-800 rounded-tr-none':'bg-white text-gray-800 rounded-tl-none'} ${msg.is_document?'border-l-4 '+(msg.from_me?'border-emerald-500':'border-blue-400'):''}`}>
                    {!msg.from_me && <p className="text-xs font-semibold text-emerald-600 mb-1">{msg.sender_name || getName(c) || 'Contact'}</p>}
                    {msg.media_url && msg.media_mimetype?.startsWith('image/') && <a href={msg.media_url} target="_blank" rel="noopener" className="block mb-1"><img src={msg.media_url} alt="" className="rounded-lg max-w-full max-h-64 cursor-pointer" loading="lazy" /></a>}
                    {msg.media_url && msg.media_mimetype?.startsWith('video/') && <video src={msg.media_url} controls className="rounded-lg max-w-full max-h-64 mb-1" preload="metadata" />}
                    {msg.media_url && msg.media_mimetype?.startsWith('audio/') && <audio src={msg.media_url} controls className="mb-1 w-full" preload="metadata" />}
                    {msg.media_url && !msg.media_mimetype?.startsWith('image/') && !msg.media_mimetype?.startsWith('video/') && !msg.media_mimetype?.startsWith('audio/') && (
                      <button onClick={() => setPreviewDoc({url:msg.media_url,filename:msg.text?.replace('📎 ','')||'Document',mimetype:msg.media_mimetype})} className="flex items-center gap-2 mb-1 p-2 rounded-lg w-full text-left bg-gray-50 hover:bg-gray-100 border border-gray-200">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.media_mimetype?.includes('pdf')?'bg-red-100':'bg-blue-100'}`}><span className="text-xs font-bold" style={{color:msg.media_mimetype?.includes('pdf')?'#ef4444':'#3b82f6'}}>{msg.media_mimetype?.includes('pdf')?'PDF':'DOC'}</span></div>
                        <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate text-gray-900">{msg.text?.replace('📎 ','')||'Document'}</p><p className="text-xs text-gray-400">Cliquer pour voir</p></div>
                      </button>
                    )}
                    {!msg.media_url && !!msg.is_document && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-100"><span className="text-xs font-bold text-red-500">PDF</span></div>
                        <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate text-gray-900">{msg.text?.replace('📎 ','')||'Document'}</p><p className="text-xs text-gray-400">En attente...</p></div>
                      </div>
                    )}
                    {!msg.is_document && msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-gray-500">{new Date(msg.timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                      {!!msg.from_me && <svg className="w-4 h-4 text-blue-500" viewBox="0 0 16 15" fill="currentColor"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg>}
                    </div>
                  </div>
                </div>
              ))}
              {selectedMessages.length===0 && <div className="text-center text-gray-400 text-sm py-4">Aucun message</div>}
              <div ref={messagesEndRef} />
            </div>
            {connected && (
              <div className="flex gap-2 mt-3">
                <input ref={messageInputRef} type="text" placeholder="Écrire..." defaultValue="" onKeyDown={e => e.key==='Enter' && sendMsg()} className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <button onClick={sendMsg} className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600"><Icon name="send" className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Notion Panel (40%) */}
          <div className="w-[40%] overflow-y-auto space-y-3">
            {c.notion_dossier_id ? (
              loadingDetails && !dossierDetails ? (
                /* Skeleton Loading */
                <div className="space-y-3 animate-pulse">
                  <div className="bg-gray-200 rounded-xl h-24" />
                  <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-12 bg-gray-100 rounded" />
                    <div className="h-12 bg-gray-100 rounded" />
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-20" />
                    <div className="h-16 bg-gray-100 rounded" />
                    <div className="h-16 bg-gray-100 rounded" />
                  </div>
                </div>
              ) : !dossierDetails ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                  <Icon name="notion" className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Impossible de charger</p>
                  <button onClick={() => loadDossierDetails(c.notion_dossier_id)} className="mt-3 text-sm text-blue-600 hover:underline">Réessayer</button>
                </div>
              ) : (
                <>
                  {/* Dossier Header */}
                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center"><span className="text-lg font-bold">N</span></div>
                        <div>
                          <h3 className="font-bold">{dossierDetails.dossier?.name}</h3>
                          <p className="text-gray-400 text-xs">{dossierDetails.dossier?.category || 'Dossier'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => loadDossierDetails(c.notion_dossier_id, true)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg" title="Actualiser">🔄</button>
                        {dossierDetails.dossier?.driveUrl && <a href={dossierDetails.dossier.driveUrl} target="_blank" rel="noopener" className="p-2 bg-white/10 hover:bg-white/20 rounded-lg" title="Drive"><Icon name="drive" className="w-4 h-4" /></a>}
                        <a href={dossierDetails.dossier?.url} target="_blank" rel="noopener" className="p-2 bg-white/10 hover:bg-white/20 rounded-lg" title="Notion">Ouvrir ↗</a>
                      </div>
                    </div>
                  </div>

                  {/* Contracts Section */}
                  {dossierDetails.contracts?.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">📋 Contrats <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{dossierDetails.contracts.length}</span></h4>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {dossierDetails.contracts.map(c => {
                          const borderColor = c.projectType === 'Gestion' ? 'border-l-green-500' : c.projectType === 'Lead' ? 'border-l-purple-500' : c.projectType === 'Sinistre' ? 'border-l-red-500' : 'border-l-gray-300';
                          return (
                            <a key={c.id} href={c.url} target="_blank" rel="noopener" className={`block p-3 hover:bg-gray-50 transition-colors border-l-4 ${borderColor}`}>
                              <p className="font-medium text-sm text-gray-900 truncate">{c.name}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                {c.compagnie && <span className="font-medium text-gray-700">{c.compagnie}</span>}
                                {c.productType && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{c.productType}</span>}
                                {c.status && <span className="text-gray-400">{c.status}</span>}
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Projects with Tasks */}
                  {(dossierDetails.projects?.length > 0) && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Icon name="project" className="w-4 h-4 text-purple-500" /> Projets</h4>
                        <button onClick={() => { setShowCreateOpp(true); setShowCreateTask(false); }} className="text-xs text-purple-600 hover:underline">+ Nouveau</button>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {dossierDetails.projects.map(p => {
                          const borderColor = p.type === 'Gestion' ? 'border-l-green-500' : p.type === 'Lead' ? 'border-l-purple-500' : p.type === 'Sinistre' ? 'border-l-red-500' : 'border-l-gray-300';
                          return (
                            <div key={p.id} className={`border-l-4 ${borderColor}`}>
                              <a href={p.url} target="_blank" rel="noopener" className="flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-gray-900 truncate">{p.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${p.type === 'Lead' ? 'bg-purple-100 text-purple-700' : p.type === 'Sinistre' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{p.type}</span>
                                    {p.type === 'Lead' && p.productType && <span className="text-xs text-gray-500">{p.productType}</span>}
                                    {p.niveau && <span className="text-xs text-gray-400">{p.niveau}</span>}
                                  </div>
                                </div>
                                <Icon name="chevron" className="w-4 h-4 text-gray-400" />
                              </a>
                              {/* Tasks under project */}
                              {p.tasks?.length > 0 && (
                                <div className="ml-4 border-l-2 border-gray-100 pl-3 pb-2">
                                  {p.tasks.map(t => {
                                    const dateStatus = getDateStatus(t.date);
                                    return (
                                      <a key={t.id} href={t.url} target="_blank" rel="noopener" className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded transition-colors">
                                        <span className="text-xs">{t.priority?.includes('Urg') ? '🔴' : t.priority === 'Important' ? '🟠' : '⬜'}</span>
                                        <span className="text-xs text-gray-700 flex-1 truncate">{t.name}</span>
                                        {t.date && <span className={`text-xs ${dateStatus === 'overdue' ? 'text-red-600 font-medium' : dateStatus === 'today' ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>{new Date(t.date).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}</span>}
                                      </a>
                                    );
                                  })}
                                  <button onClick={() => { setTaskForm({...taskForm, projectId: p.id}); setShowCreateTask(true); }} className="text-xs text-blue-600 hover:underline ml-2 mt-1">+ Tâche</button>
                                </div>
                              )}
                              {!p.tasks?.length && (
                                <button onClick={() => { setTaskForm({...taskForm, projectId: p.id}); setShowCreateTask(true); }} className="text-xs text-blue-600 hover:underline ml-6 pb-2">+ Tâche</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Orphan Tasks */}
                  {dossierDetails.orphanTasks?.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Icon name="tasks" className="w-4 h-4 text-blue-500" /> Autres tâches</h4>
                      </div>
                      <div className="p-2 space-y-1">
                        {dossierDetails.orphanTasks.map(t => {
                          const dateStatus = getDateStatus(t.date);
                          return (
                            <a key={t.id} href={t.url} target="_blank" rel="noopener" className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                              <span className="text-xs">{t.priority?.includes('Urg') ? '🔴' : t.priority === 'Important' ? '🟠' : '⬜'}</span>
                              <span className="text-xs text-gray-700 flex-1 truncate">{t.name}</span>
                              {t.date && <span className={`text-xs ${dateStatus === 'overdue' ? 'text-red-600 font-medium' : dateStatus === 'today' ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>{new Date(t.date).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}</span>}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Contacts Section */}
                  {dossierDetails.contacts?.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                        <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">👥 Contacts <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{dossierDetails.contacts.length}</span></h4>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {dossierDetails.contacts.map(contact => {
                          const isLinked = c.notion_contact_id === contact.id;
                          return (
                            <div key={contact.id} className={`p-3 ${isLinked ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-gray-50'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className={`font-medium text-sm ${isLinked ? 'text-emerald-700' : 'text-gray-900'} truncate`}>{contact.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                    {contact.phone && <span>{contact.phone}</span>}
                                    {contact.statut?.length > 0 && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{contact.statut[0]}</span>}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  {!isLinked && (
                                    <button onClick={() => linkConversationToContact(contact)} className="text-xs text-blue-600 hover:underline px-2 py-1">Lier</button>
                                  )}
                                  <a href={contact.url} target="_blank" rel="noopener" className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">↗</a>
                                </div>
                              </div>
                              {isLinked && <p className="text-xs text-emerald-600 mt-1">✓ Lié à cette conversation</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="bg-gray-50 rounded-lg p-3 text-center text-xs text-gray-500">
                    {dossierDetails.stats?.contracts || 0} contrats · {dossierDetails.stats?.activeProjects || 0} projets · {dossierDetails.stats?.pendingTasks || 0} tâches
                  </div>

                  {/* Create Task Form */}
                  {showCreateTask && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-blue-800">Nouvelle tâche</p>
                        <button onClick={() => setShowCreateTask(false)} className="text-xs text-blue-400 hover:text-blue-600">✕</button>
                      </div>
                      {dossierProjects.length > 0 && (
                        <select value={taskForm.projectId} onChange={e => setTaskForm({...taskForm, projectId: e.target.value})} className="w-full px-3 py-2 text-xs border border-blue-200 rounded-lg bg-white">
                          <option value="">— Aucun projet —</option>
                          {dossierProjects.map(p => (<option key={p.id} value={p.id}>{p.type === 'Lead' ? '🩷' : p.type === 'Sinistre' ? '🔵' : '🟢'} {p.name}</option>))}
                        </select>
                      )}
                      <input type="text" placeholder="Nom de la tâche..." value={taskForm.name} onChange={e => setTaskForm({...taskForm, name: e.target.value})} className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" autoFocus />
                      <div className="flex gap-2">
                        <select value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})} className="flex-1 px-2 py-1.5 text-xs border border-blue-200 rounded-lg bg-white">
                          <option value="Urg & Imp">🔴 Urg & Imp</option><option value="Important">🟠 Important</option><option value="Urgent">🟡 Urgent</option><option value="Secondaire">⚪ Secondaire</option><option value="En attente">🔵 En attente</option><option value="À prioriser">⬜ À prioriser</option>
                        </select>
                        <input type="date" value={taskForm.date} onChange={e => setTaskForm({...taskForm, date: e.target.value})} className="flex-1 px-2 py-1.5 text-xs border border-blue-200 rounded-lg bg-white" />
                      </div>
                      <button onClick={createTask} disabled={notionLoading||!taskForm.name} className="w-full py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium">{notionLoading?'Création...':'✓ Créer'}</button>
                    </div>
                  )}

                  {/* Create Project Form */}
                  {showCreateOpp && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-purple-800">Nouveau projet</p>
                        <button onClick={() => setShowCreateOpp(false)} className="text-xs text-purple-400 hover:text-purple-600">✕</button>
                      </div>
                      <input type="text" placeholder="Nom du projet..." value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-400" autoFocus />
                      <div className="flex gap-2">
                        <select value={projectForm.type} onChange={e => setProjectForm({...projectForm, type: e.target.value})} className="flex-1 px-2 py-1.5 text-xs border border-purple-200 rounded-lg bg-white"><option value="Lead">🩷 Lead</option><option value="Sinistre">🔵 Sinistre</option><option value="Gestion">🟢 Gestion</option></select>
                        <select value={projectForm.priority} onChange={e => setProjectForm({...projectForm, priority: e.target.value})} className="flex-1 px-2 py-1.5 text-xs border border-purple-200 rounded-lg bg-white"><option value="Urg & imp">🔴 Urg & imp</option><option value="Important">🟠 Important</option><option value="Urgent">🟡 Urgent</option><option value="Secondaire">⚪ Secondaire</option><option value="En attente">🔵 En attente</option><option value="À prioriser">⬜ À prioriser</option></select>
                      </div>
                      <select value={projectForm.niveau} onChange={e => setProjectForm({...projectForm, niveau: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-purple-200 rounded-lg bg-white"><option value="">Niveau du projet...</option><option value="Devis à faire">Devis à faire</option><option value="En attente d'information">En attente d&apos;info</option><option value="Envoyé au client">Envoyé au client</option><option value="En attente de signature">En attente de signature</option></select>
                      <button onClick={createProject} disabled={notionLoading||!projectForm.name} className="w-full py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 disabled:opacity-50 font-medium">{notionLoading?'Création...':'✓ Créer'}</button>
                    </div>
                  )}
                </>
              )
            ) : (
              /* No dossier linked */
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <Icon name="notion" className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="text-sm text-gray-500 mt-3">Aucun dossier Notion lié</p>
                {!showNotionLink ? (
                  <button onClick={() => { setShowNotionLink(true); searchDossiers(''); }} className="mt-4 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">Rechercher un dossier</button>
                ) : (
                  <div className="mt-4 space-y-2 text-left">
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Rechercher..." value={notionSearch} onChange={e => { setNotionSearch(e.target.value); searchDossiers(e.target.value); }} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                      <button onClick={() => setShowNotionLink(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">✕</button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {notionSearching && <p className="text-xs text-gray-400 text-center py-2">Recherche...</p>}
                      {!notionSearching && notionError && <div className="text-xs text-red-500 text-center py-2">⚠️ {notionError}</div>}
                      {!notionSearching && !notionError && notionResults.length===0 && <p className="text-xs text-gray-400 text-center py-2">Aucun résultat</p>}
                      {notionResults.map(d => (
                        <button key={d.id} onClick={() => linkDossier(d)} disabled={notionLoading} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-gray-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">N</div>
                          <span className="text-sm text-gray-800 truncate">{d.name}</span>
                          {d.phone && <span className="text-xs text-gray-400 flex-shrink-0">{d.phone}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== DOCUMENTS VIEW ====================
  const DocumentsView = () => { const [filter, setFilter] = useState('all'); const filtered = filter==='all'?documents:documents.filter(d => d.status===filter);
    return (<div className="space-y-4"><div><h2 className="text-2xl font-bold text-gray-900">Documents</h2><p className="text-gray-500 text-sm mt-1">{documents.length} documents</p></div>
    <div className="flex gap-2 flex-wrap">{[{id:'all',label:'Tous',count:documents.length},...Object.entries(DOC_STATUSES).map(([k,v])=>({id:k,label:v,count:documents.filter(d=>d.status===k).length}))].map(f => (<button key={f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter===f.id?'bg-gray-900 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.label} ({f.count})</button>))}</div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map(doc => { const isPdf=doc.mimetype?.includes('pdf'); const isImage=doc.mimetype?.startsWith('image/'); const docUrl=doc.local_path?`/api/whatsapp/media/${encodeURIComponent(doc.local_path.split('/').pop())}`:null; return (<div key={doc.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
      {docUrl ? <button onClick={() => setPreviewDoc({url:docUrl,filename:doc.filename,mimetype:doc.mimetype})} className="w-full block hover:opacity-90 cursor-pointer">{isImage ? <div className="h-36 bg-gray-50 flex items-center justify-center overflow-hidden"><img src={docUrl} alt={doc.filename} className="max-h-full max-w-full object-contain" loading="lazy" /></div> : isPdf ? <div className="h-36 bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center"><div className="text-center"><div className="w-12 h-14 mx-auto bg-white rounded-lg shadow-sm border border-red-200 flex items-center justify-center"><span className="text-red-500 font-bold text-sm">PDF</span></div><p className="text-xs text-red-400 mt-2 opacity-0 group-hover:opacity-100">Aperçu</p></div></div> : <div className="h-28 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center"><Icon name="file" className="w-10 h-10 text-blue-300" /></div>}</button> : <div className="h-28 bg-gray-50 flex items-center justify-center"><Icon name="file" className="w-10 h-10 text-gray-300" /></div>}
      <div className="p-3 border-t border-gray-100"><p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p><div className="flex items-center justify-between mt-2"><div className="flex items-center gap-2 min-w-0"><span className="text-xs text-gray-400">{doc.file_size?`${(doc.file_size/1024).toFixed(0)} KB`:''}</span><button onClick={() => { const c=conversations.find(cv=>cv.jid===doc.conversation_jid); if(c) openConversation(c); }} className="text-xs text-emerald-600 hover:underline truncate">{doc.conversation_name}</button></div><select value={doc.status} onChange={e => updateDocStatus(doc.id,e.target.value)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOC_COLORS[doc.status]||''}`}>{Object.entries(DOC_STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div></div>
    </div>); })}{filtered.length===0 && <div className="col-span-full bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">Aucun document</div>}</div></div>); };

  // ==================== JOURNAL AGENT ====================
  const JournalView = () => (<div className="space-y-4">
    <div><h2 className="text-2xl font-bold text-gray-900">Journal Agent</h2><p className="text-gray-500 text-sm mt-1">{agentLogTotal} actions enregistrées</p></div>
    <div className="flex gap-2 flex-wrap">{[{id:null,label:'Toutes',icon:'📋'},{id:'task_created',label:'Tâches',icon:'✅'},{id:'project_created',label:'Projets',icon:'📁'},{id:'doc_downloaded',label:'Téléchargements',icon:'📥'},{id:'dossier_linked',label:'Liaisons',icon:'🔗'}].map(at => (<button key={at.id||'all'} onClick={() => { setLogTypeFilter(at.id); loadAgentLogs(at.id); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${logTypeFilter===at.id?'bg-gray-900 text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}><span>{at.icon}</span> {at.label}</button>))}</div>
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
      {agentLogs.length===0 ? <div className="p-8 text-center text-gray-400 text-sm"><Icon name="journal" className="w-10 h-10 text-gray-300 mx-auto mb-2" />Aucune action</div> : agentLogs.map(log => { const meta = (() => { try { return JSON.parse(log.metadata||'{}'); } catch { return {}; } })(); return (<div key={log.id} className="p-4 flex items-start gap-3 hover:bg-gray-50">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">{LOG_ICONS[log.action_type]||'📋'}</div>
        <div className="flex-1 min-w-0"><p className="text-sm text-gray-900">{log.description}</p><div className="flex items-center gap-2 mt-1">{log.conversation_name && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">👤 {log.conversation_name}</span>}{meta.filename && <span className="text-xs text-gray-400 truncate">📄 {meta.filename}</span>}</div></div>
        <div className="flex-shrink-0"><p className="text-xs font-mono text-gray-500">{formatLogTime(log.timestamp)}</p></div>
      </div>); })}
    </div>
  </div>);

  // ==================== ANALYTICS ====================
  const Analytics = () => {
    const svaConvs = conversations.filter(c => c.status !== 'hsva'); // Exclure HSVA des stats
    const activeConvs = svaConvs.filter(c => c.status === 'client' || c.status === 'assurance' || c.status === 'prospect');
    const withNotion = svaConvs.filter(c => c.notion_dossier_id);
    const withoutNotion = svaConvs.filter(c => !c.notion_dossier_id && c.labels?.length > 0);
    const prospectConvs = svaConvs.filter(c => c.labels?.some(l => l.toLowerCase().includes('prospect')));
    const prospectWithNotion = prospectConvs.filter(c => c.notion_dossier_id);
    const urgents = svaConvs.filter(c => c.priority === 'high');
    const stale = svaConvs.filter(c => daysSince(c.last_activity_at) >= 3);
    const recentActive = svaConvs.filter(c => daysSince(c.last_activity_at) < 1);
    const docsPending = documents.filter(d => d.status === 'recu' || d.status === 'identifie');
    const docsTraites = documents.filter(d => d.status === 'traite');

    return (<div className="space-y-6">
    <div><h2 className="text-2xl font-bold text-gray-900">Analytics</h2><p className="text-gray-500 text-sm mt-1">KPIs business &amp; suivi d'activité</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Icon name="message" className="w-5 h-5 text-gray-600" /></div><div><p className="text-2xl font-bold text-gray-900">{stats.total||0}</p><p className="text-xs text-gray-500">Total conversations</p></div></div></div>
      <div className="bg-white rounded-xl border border-emerald-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Icon name="briefcase" className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold text-emerald-600">{activeConvs.length}</p><p className="text-xs text-gray-500">Dossiers actifs</p><p className="text-xs text-emerald-600 mt-0.5">en attente / en cours / doc</p></div></div></div>
      <div className="bg-white rounded-xl border border-purple-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center"><Icon name="target" className="w-5 h-5 text-purple-600" /></div><div><p className="text-2xl font-bold text-purple-600">{prospectWithNotion.length}<span className="text-lg text-purple-400">/{prospectConvs.length}</span></p><p className="text-xs text-gray-500">Prospects avec projet</p><p className="text-xs text-purple-600 mt-0.5">{prospectConvs.length - prospectWithNotion.length} sans projet</p></div></div></div>
      <div className="bg-white rounded-xl border border-blue-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Icon name="link" className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold text-blue-600">{withNotion.length}</p><p className="text-xs text-gray-500">Liés à Notion</p><p className="text-xs text-blue-600 mt-0.5">{conversations.length > 0 ? Math.round((withNotion.length / conversations.length) * 100) : 0}% des convs</p></div></div></div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className={`bg-white rounded-xl border p-4 ${urgents.length > 0 ? 'border-red-200' : 'border-gray-200'}`}><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${urgents.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}><Icon name="alert" className={`w-5 h-5 ${urgents.length > 0 ? 'text-red-500' : 'text-gray-400'}`} /></div><div><p className={`text-2xl font-bold ${urgents.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>{urgents.length}</p><p className="text-xs text-gray-500">Urgentes ouvertes</p></div></div></div>
      <div className={`bg-white rounded-xl border p-4 ${stale.length > 0 ? 'border-amber-200' : 'border-gray-200'}`}><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stale.length > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}><Icon name="clock" className={`w-5 h-5 ${stale.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} /></div><div><p className={`text-2xl font-bold ${stale.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{stale.length}</p><p className="text-xs text-gray-500">À relancer (+3j)</p></div></div></div>
      <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Icon name="trendUp" className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold text-emerald-600">{recentActive.length}</p><p className="text-xs text-gray-500">Actifs aujourd&apos;hui</p></div></div></div>
      <div className="bg-white rounded-xl border border-orange-200 p-4 cursor-pointer hover:shadow-sm" onClick={() => {setActiveLabel('hsva');setView('conversations');}}><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center"><span className="text-orange-600 font-bold text-xs">HSVA</span></div><div><p className="text-2xl font-bold text-orange-600">{conversations.filter(c => c.status === 'hsva').length}</p><p className="text-xs text-gray-500">Hors SVA</p></div></div></div>
    </div>
    <div className="bg-white rounded-xl border border-gray-200 p-4"><h3 className="font-semibold text-sm text-gray-900 mb-4">Par statut</h3><div className="grid grid-cols-3 gap-3">
      <div className="bg-emerald-50 rounded-lg p-4 text-center cursor-pointer hover:shadow-sm" onClick={() => {setActiveLabel('client');setView('conversations');}}><p className="text-3xl font-bold text-emerald-700">{conversations.filter(c => c.status === 'client').length}</p><p className="text-xs text-emerald-600 mt-1">Client</p></div>
      <div className="bg-blue-50 rounded-lg p-4 text-center cursor-pointer hover:shadow-sm" onClick={() => {setActiveLabel('assurance');setView('conversations');}}><p className="text-3xl font-bold text-blue-700">{conversations.filter(c => c.status === 'assurance').length}</p><p className="text-xs text-blue-600 mt-1">Assurance</p></div>
      <div className="bg-purple-50 rounded-lg p-4 text-center cursor-pointer hover:shadow-sm" onClick={() => {setActiveLabel('prospect');setView('conversations');}}><p className="text-3xl font-bold text-purple-700">{conversations.filter(c => c.status === 'prospect').length}</p><p className="text-xs text-purple-600 mt-1">Prospect</p></div>
    </div></div>
    <div className="bg-white rounded-xl border border-gray-200 p-4"><h3 className="font-semibold text-sm text-gray-900 mb-4">Pipeline par statut</h3><div className="space-y-3">{Object.entries(STATUSES).map(([k,v]) => { const count=stats[k]||0; const pct=stats.total?Math.max((count/stats.total)*100, count > 0 ? 5 : 0):0; return (<div key={k} className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${v.dot}`} /><span className="text-sm text-gray-700 w-28">{v.label}</span><div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden"><div className={`h-full ${v.dot} rounded-full flex items-center justify-end pr-2 transition-all duration-500`} style={{width:`${pct}%`,minWidth:count>0?'40px':'0'}}><span className="text-xs font-bold text-white">{count}</span></div></div><span className="text-xs text-gray-400 w-10 text-right">{stats.total?Math.round((count/stats.total)*100):0}%</span></div>); })}</div></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4"><h3 className="font-semibold text-sm text-gray-900 mb-4">Documents</h3><div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-amber-700">{docsPending.length}</p><p className="text-xs text-amber-600">À traiter</p></div>
        <div className="bg-emerald-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-emerald-700">{docsTraites.length}</p><p className="text-xs text-emerald-600">Traités</p></div>
        <div className="bg-gray-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-gray-700">{documents.length}</p><p className="text-xs text-gray-500">Total</p></div>
        <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-blue-700">{documents.length > 0 ? Math.round((docsTraites.length / documents.length) * 100) : 0}%</p><p className="text-xs text-blue-600">Complétude</p></div>
      </div></div>
      <div className="bg-white rounded-xl border border-gray-200 p-4"><h3 className="font-semibold text-sm text-gray-900 mb-4">Par catégorie</h3><div className="grid grid-cols-2 gap-2">{CATEGORIES.map(cat => { const count=conversations.filter(c=>c.category===cat).length; if(!count) return null; return (<div key={cat} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between"><span className="text-sm text-gray-700">{cat}</span><span className="text-lg font-bold text-gray-900">{count}</span></div>); })}</div></div>
    </div>
    {prospectConvs.length - prospectWithNotion.length > 0 && (<div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
      <h3 className="font-semibold text-purple-800 text-sm flex items-center gap-2"><Icon name="alert" className="w-4 h-4" /> Prospects sans projet Notion ({prospectConvs.length - prospectWithNotion.length})</h3>
      <p className="text-xs text-purple-600 mt-1 mb-3">Ces prospects n&apos;ont pas de dossier Notion lié → pas de projet rattaché</p>
      <div className="space-y-1.5">{prospectConvs.filter(c => !c.notion_dossier_id).slice(0, 10).map(c => (
        <button key={c.jid} onClick={() => openConversation(c)} className="w-full flex items-center gap-2 bg-white rounded-lg px-3 py-2 hover:shadow-sm text-left">
          <div className={`w-7 h-7 rounded-full ${c.avatar_color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{getInitialsFor(c)}</div>
          <span className="text-sm text-gray-900 flex-1 truncate">{getName(c)}</span>
          <span className="text-xs text-purple-500">→ Lier dossier</span>
        </button>))}</div>
    </div>)}
    {withoutNotion.length > 0 && (<div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2"><Icon name="link" className="w-4 h-4" /> Conversations étiquetées sans Notion ({withoutNotion.length})</h3>
      <p className="text-xs text-gray-500 mt-1">Ces conversations ont une étiquette WhatsApp mais ne sont pas liées à un dossier Notion</p>
    </div>)}
  </div>); };

  // ==================== SETTINGS ====================
  const [showJournal, setShowJournal] = useState(false);

  const Settings = () => {
    useEffect(() => { loadAgentLogs(); }, []);
    return (<div className="space-y-6"><div><h2 className="text-2xl font-bold text-gray-900">Paramètres</h2></div>
    <div className="bg-white rounded-xl border border-gray-200 p-6"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Icon name="wifi" className="w-5 h-5 text-emerald-600" /></div><div><h3 className="font-semibold text-gray-900">Connexion WhatsApp</h3><p className="text-sm text-gray-500">Via QR code</p></div></div>
    {connected ? (<div className="flex items-center justify-between bg-emerald-50 rounded-lg p-4"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" /><span className="text-sm font-medium text-emerald-800">Connecté ✓</span></div><button onClick={handleDisconnect} className="text-sm text-red-600 hover:underline">Déconnecter</button></div>)
    : connecting && qrImage ? (<div className="text-center py-4"><img src={qrImage} alt="QR" className="mx-auto w-64 h-64 rounded-xl border-2 border-gray-200" /><p className="text-sm text-gray-600 mt-4 font-medium">Scannez avec WhatsApp</p><p className="text-xs text-gray-400 mt-1">WhatsApp → ⋮ → Appareils connectés → Connecter</p><div className="mt-3 flex items-center justify-center gap-2 text-amber-600 text-xs"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> En attente...</div><button onClick={handleDisconnect} className="mt-4 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">Annuler</button></div>)
    : connecting ? (<div className="text-center py-8"><div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto" /><p className="text-sm text-gray-600 mt-4">QR code...</p><button onClick={async () => { await handleDisconnect(); setConnecting(false); }} className="mt-4 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">Annuler</button></div>)
    : (<div className="text-center py-8"><div className="w-48 h-48 bg-gray-100 rounded-xl mx-auto flex items-center justify-center border-2 border-dashed border-gray-300"><Icon name="qr" className="w-20 h-20 text-gray-400" /></div><p className="text-sm text-gray-600 mt-4">Connecter WhatsApp</p><button onClick={handleConnect} className="mt-4 px-8 py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600">🔗 Connecter</button></div>)}</div>
    <div className="bg-white rounded-xl border border-gray-200 p-6"><h3 className="font-semibold text-gray-900 mb-2">Comment ça marche</h3><div className="space-y-3 text-sm text-gray-600"><p>1. Cliquez sur <strong>Connecter</strong></p><p>2. Scannez le QR code</p><p>3. WhatsApp → ⋮ → <strong>Appareils connectés</strong></p><p>4. ✅ Messages en temps réel</p></div></div>

    {/* Journal Agent Section */}
    <div className="bg-white rounded-xl border border-gray-200">
      <button onClick={() => setShowJournal(!showJournal)} className="w-full p-4 flex items-center justify-between hover:bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center"><Icon name="journal" className="w-5 h-5 text-purple-600" /></div>
          <div className="text-left"><h3 className="font-semibold text-gray-900">Journal Agent</h3><p className="text-sm text-gray-500">{agentLogTotal} actions enregistrées</p></div>
        </div>
        <Icon name="chevron" className={`w-5 h-5 text-gray-400 transition-transform ${showJournal ? 'rotate-90' : ''}`} />
      </button>
      {showJournal && (
        <div className="border-t border-gray-200 p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">{[{id:null,label:'Toutes',icon:'📋'},{id:'task_created',label:'Tâches',icon:'✅'},{id:'project_created',label:'Projets',icon:'📁'},{id:'doc_downloaded',label:'Downloads',icon:'📥'},{id:'dossier_linked',label:'Liaisons',icon:'🔗'}].map(at => (<button key={at.id||'all'} onClick={() => { setLogTypeFilter(at.id); loadAgentLogs(at.id); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${logTypeFilter===at.id?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><span>{at.icon}</span> {at.label}</button>))}</div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {agentLogs.length === 0 ? (<div className="py-8 text-center text-gray-400 text-sm">Aucune action</div>) : agentLogs.slice(0, 50).map(log => {
              const meta = (() => { try { return JSON.parse(log.metadata || '{}'); } catch { return {}; } })();
              return (
                <div key={log.id} className="py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">{LOG_ICONS[log.action_type] || '📋'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{log.description}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {log.conversation_name && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">👤 {log.conversation_name}</span>}
                      {meta.filename && <span className="text-xs text-gray-400 truncate">📄 {meta.filename}</span>}
                    </div>
                  </div>
                  <p className="text-xs font-mono text-gray-400 flex-shrink-0">{formatLogTime(log.timestamp)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  </div>);};

  // ==================== RENDER ====================
  const renderView = () => { if (view === 'detail' && selectedJid) return <Detail />; switch(view) { case 'dashboard': return <Dashboard />; case 'kanban': return <Kanban />; case 'conversations': return <ConversationsList />; case 'documents': return <DocumentsView />; case 'journal': return <JournalView />; case 'analytics': return <Analytics />; case 'settings': return <Settings />; default: return <Dashboard />; } };

  return (<div className="flex h-screen bg-gray-100 text-gray-900 overflow-hidden">
    <Sidebar />
    {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <div className="flex-1 flex flex-col min-w-0">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:hidden"><button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg"><Icon name="menu" className="w-5 h-5 text-gray-600" /></button><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center"><Icon name="message" className="w-4 h-4 text-white" /></div><span className="font-bold text-sm">WA Agent</span></div><div className={`ml-auto flex items-center gap-1.5 text-xs ${connected?'text-emerald-600':'text-red-500'}`}><div className={`w-2 h-2 rounded-full ${connected?'bg-emerald-500 animate-pulse':'bg-red-500'}`} />{connected?'Connecté':'Déconnecté'}</div></div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">{renderView()}</div>
    </div>
    {previewDoc && (<div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}><div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50"><div className="flex items-center gap-3 min-w-0"><div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${previewDoc.mimetype?.includes('pdf')?'bg-red-100':'bg-blue-100'}`}><span className={`text-xs font-bold ${previewDoc.mimetype?.includes('pdf')?'text-red-500':'text-blue-500'}`}>{previewDoc.mimetype?.includes('pdf')?'PDF':'DOC'}</span></div><p className="text-sm font-medium text-gray-900 truncate">{previewDoc.filename}</p></div>
      <div className="flex items-center gap-2 flex-shrink-0"><a href={previewDoc.url} download={previewDoc.filename} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Télécharger</a><a href={previewDoc.url} target="_blank" rel="noopener" className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Ouvrir ↗</a><button onClick={() => setPreviewDoc(null)} className="p-1.5 hover:bg-gray-200 rounded-lg"><svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
      <div className="flex-1 overflow-hidden bg-gray-100" style={{minHeight:'60vh'}}>{previewDoc.mimetype?.includes('pdf') ? <iframe src={previewDoc.url} className="w-full h-full border-0" style={{minHeight:'60vh'}} title={previewDoc.filename} /> : previewDoc.mimetype?.startsWith('image/') ? <div className="w-full h-full flex items-center justify-center p-4"><img src={previewDoc.url} alt={previewDoc.filename} className="max-w-full max-h-full object-contain" /></div> : <div className="w-full h-full flex items-center justify-center"><div className="text-center p-8"><Icon name="file" className="w-16 h-16 text-gray-300 mx-auto" /><p className="text-gray-500 mt-3">Aperçu non disponible</p><a href={previewDoc.url} download={previewDoc.filename} className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Télécharger</a></div></div>}</div>
    </div></div>)}

    {/* Tag → Project Linking Modal */}
    {tagProjectModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setTagProjectModal(null)}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className={`p-4 ${tagProjectModal.tag === 'Gestion' ? 'bg-green-500' : tagProjectModal.tag === 'Lead' ? 'bg-purple-500' : 'bg-red-500'} text-white`}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Lier "{tagProjectModal.tag}" à un projet</h3>
              <button onClick={() => setTagProjectModal(null)} className="p-1 hover:bg-white/20 rounded-lg">✕</button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {/* Current link status */}
            {(() => {
              const conv = conversations.find(c => c.jid === tagProjectModal.jid);
              const linkedProject = conv?.tag_projects?.[tagProjectModal.tag];
              const matchingProjects = dossierProjects.filter(p => p.type === tagProjectModal.tag);

              return (
                <>
                  {linkedProject ? (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-600">Actuellement lié à :</p>
                      <div className="flex items-center justify-between mt-2">
                        <a href={linkedProject.url} target="_blank" rel="noopener" className="font-medium text-gray-900 hover:text-blue-600 hover:underline">{linkedProject.name} ↗</a>
                        <button onClick={async () => {
                          const newTagProjects = {...(conv.tag_projects || {})};
                          delete newTagProjects[tagProjectModal.tag];
                          await api('update-status', 'POST', { jid: tagProjectModal.jid, tag_projects: newTagProjects });
                          loadConversations();
                          if (selectedJid === tagProjectModal.jid) loadMessages(tagProjectModal.jid);
                          setTagProjectModal(null);
                        }} className="text-xs text-red-600 hover:underline">Délier</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Ce tag n'est pas encore lié à un projet.</p>
                  )}

                  {/* Matching projects from dossier */}
                  {matchingProjects.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Projets "{tagProjectModal.tag}" disponibles :</p>
                      <div className="space-y-2">
                        {matchingProjects.map(p => (
                          <button key={p.id} onClick={async () => {
                            const newTagProjects = {...(conv?.tag_projects || {}), [tagProjectModal.tag]: { id: p.id, name: p.name, url: p.url }};
                            await api('update-status', 'POST', { jid: tagProjectModal.jid, tag_projects: newTagProjects });
                            loadConversations();
                            if (selectedJid === tagProjectModal.jid) loadMessages(tagProjectModal.jid);
                            setTagProjectModal(null);
                          }} className={`w-full text-left p-3 rounded-lg border hover:shadow-sm transition-shadow ${linkedProject?.id === p.id ? 'border-2 border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                            <p className="font-medium text-gray-900">{p.name}</p>
                            {p.niveau && <p className="text-xs text-gray-500">{p.niveau}</p>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchingProjects.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">Aucun projet "{tagProjectModal.tag}" dans ce dossier</p>
                      <button onClick={() => {
                        setProjectForm({ name: '', type: tagProjectModal.tag, priority: 'À prioriser', niveau: '' });
                        setShowCreateOpp(true);
                        setTagProjectModal(null);
                      }} className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white ${tagProjectModal.tag === 'Gestion' ? 'bg-green-500 hover:bg-green-600' : tagProjectModal.tag === 'Lead' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-red-500 hover:bg-red-600'}`}>
                        + Créer un projet {tagProjectModal.tag}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    )}

    {/* Name Source Modal */}
    {showNameSourceModal && selectedConv && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNameSourceModal(false)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Source du nom</h3>
            <button onClick={() => setShowNameSourceModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="p-4 space-y-2">
            {/* Contact Notion option */}
            {selectedConv.notion_dossier_id && dossierDetails?.contacts?.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="font-medium text-sm text-gray-700">📇 Contact Notion</p>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {dossierDetails.contacts.map(contact => (
                    <button key={contact.id} onClick={() => linkConversationToContact(contact).then(() => setShowNameSourceModal(false))} className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between ${selectedConv.notion_contact_id === contact.id ? 'bg-emerald-50' : ''}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                        {contact.phone && <p className="text-xs text-gray-500">{contact.phone}</p>}
                      </div>
                      {selectedConv.notion_contact_id === contact.id && <span className="text-emerald-500">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dossier Notion option */}
            {selectedConv.notion_dossier_id && (
              <button onClick={() => updateNameSource('dossier')} className={`w-full text-left px-3 py-2.5 border rounded-lg hover:bg-gray-50 ${selectedConv.name_source === 'dossier' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-700">📁 Dossier Notion</p>
                    <p className="text-xs text-gray-500">{selectedConv.notion_dossier_name}</p>
                  </div>
                  {selectedConv.name_source === 'dossier' && <span className="text-blue-500">✓</span>}
                </div>
              </button>
            )}

            {/* Manual option */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setEditingName(true)} className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 ${selectedConv.name_source === 'manual' ? 'bg-gray-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-700">✏️ Saisie manuelle</p>
                    {selectedConv.custom_name && <p className="text-xs text-gray-500">{selectedConv.custom_name}</p>}
                  </div>
                  {selectedConv.name_source === 'manual' && <span className="text-gray-600">✓</span>}
                </div>
              </button>
              {editingName && (
                <div className="px-3 py-2 border-t border-gray-200 flex gap-2">
                  <input type="text" value={editNameValue} onChange={e => setEditNameValue(e.target.value)} placeholder="Nom personnalisé..." className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500" autoFocus />
                  <button onClick={() => { updateNameSource('manual', editNameValue); setEditingName(false); }} className="px-3 py-1.5 bg-emerald-500 text-white text-sm rounded hover:bg-emerald-600">OK</button>
                </div>
              )}
            </div>

            {/* WhatsApp option */}
            <button onClick={() => updateNameSource('whatsapp')} className={`w-full text-left px-3 py-2.5 border rounded-lg hover:bg-gray-50 ${selectedConv.name_source === 'whatsapp' || !selectedConv.name_source ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-700">📱 WhatsApp</p>
                  <p className="text-xs text-gray-500">{selectedConv.whatsapp_name || selectedConv.phone}</p>
                </div>
                {(selectedConv.name_source === 'whatsapp' || !selectedConv.name_source) && <span className="text-green-500">✓</span>}
              </div>
            </button>
          </div>
        </div>
      </div>
    )}
  </div>);
}


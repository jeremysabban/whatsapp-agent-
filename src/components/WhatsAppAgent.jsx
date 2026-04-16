'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DossierList from './DossierList';
import DossierDetail from './DossierDetail';
import TasksView from './TasksView';
import ProjectsView from './ProjectsView';
import DossierChat from './DossierChat';
import CalendarView from './CalendarView';
import { ConversationLayout } from './conversations';
import ProjectModal from './conversations/ProjectModal';
import PipelineView from './PipelineView';
import TaskFormModal from './shared/TaskFormModal';
import ProjectDetailPanel from './shared/ProjectDetailPanel';
import DossierDetailPanel from './shared/DossierDetailPanel';
import TaskDetailPanel from './shared/TaskDetailPanel';
import ContractDetailPanel from './shared/ContractDetailPanel';
import ContractFormModal from './shared/ContractFormModal';
import ContratsView from './ContratsView';
import CommissionsView from './CommissionsView';
import FinanceView from './FinanceView';
import DashboardView from './DashboardView';
import EmailsView from './EmailsView';
import DriveExplorer from './shared/DriveExplorer';

// ==================== CONSTANTS ====================
const STATUSES = {
  client: { label: 'Client', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', kanban: 'border-t-emerald-500' },
  assurance: { label: 'Assurance', color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500', kanban: 'border-t-blue-500' },
  prospect: { label: 'Prospect', color: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500', kanban: 'border-t-purple-500' },
  apporteur: { label: 'Apporteur', color: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500', kanban: 'border-t-amber-500' },
  hsva: { label: 'HSVA', color: 'bg-gray-100 text-gray-800 border-gray-200', dot: 'bg-gray-500', kanban: 'border-t-gray-500' },
  inbox: { label: 'À classer', color: 'bg-slate-100 text-slate-800 border-slate-200', dot: 'bg-slate-500', kanban: 'border-t-slate-500' },
};
const CATEGORIES = ['Gestion', 'Sinistre', 'Lead'];
const DOC_STATUSES = { recu: 'Reçu', identifie: 'Identifié', classe: 'Classé', telecharge: 'Téléchargé', traite: 'Traité' };
const DOC_COLORS = { recu: 'bg-gray-100 text-gray-700', identifie: 'bg-amber-100 text-amber-700', classe: 'bg-blue-100 text-blue-700', telecharge: 'bg-purple-100 text-purple-700', traite: 'bg-emerald-100 text-emerald-700' };
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
    key: <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 0-7.778 7.778 5.5 5.5 0 0 0 7.777 0L15.5 15.5m2.5-2.5 3-3m-3 3-3-3" /></>,
    refresh: <><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    calendar: <><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></>,
    mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  };
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icons[name]}</svg>);
}

function timeAgo(ts) { if (!ts) return ''; const diff = Date.now() - ts; const mins = Math.floor(diff / 60000); if (mins < 1) return "À l'instant"; if (mins < 60) return `Il y a ${mins}min`; const hours = Math.floor(mins / 60); if (hours < 24) return `Il y a ${hours}h`; const days = Math.floor(diff / 86400000); if (days < 7) { const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']; return dayNames[new Date(ts).getDay()]; } return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function daysSince(ts) { if (!ts) return 999; return Math.floor((Date.now() - ts) / 86400000); }
function formatLogTime(ts) { const d = new Date(ts); const now = new Date(); const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === now.toDateString() ? time : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${time}`; }
function getLabelColor(n) { return LABEL_COLORS[n?.toLowerCase()] || 'bg-gray-100 text-gray-600 border-gray-200'; }
function formatLastMessage(c) {
  const MEDIA_LABELS = { image: '📷 Photo', video: '🎥 Vidéo', document: '📎 Document', audio: '🎵 Audio', ptt: '🎤 Vocal', sticker: '🏷️ Sticker' };
  const type = c.last_message_type || 'text';
  let text = c.last_message;
  if (!text && type !== 'text') text = MEDIA_LABELS[type] || '📎 Pièce jointe';
  if (!text) return 'Aucun message';
  const prefix = c.last_message_from_me ? 'Vous : ' : '';
  const full = prefix + text;
  return full.length > 80 ? full.slice(0, 80) + '...' : full;
}

// Display name helper: notion_dossier_name > custom_name > whatsapp_name > name > phone
function getName(c) { return c.display_name || c.notion_dossier_name || c.custom_name || c.whatsapp_name || c.name || c.phone || 'Inconnu'; }
function getDateSeparator(ts) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today - msgDay) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
function getInitialsFor(c) { return c.display_initials || c.avatar_initials || '??'; }

// ==================== MAIN ====================
export default function WhatsAppAgent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [loggedInUser, setLoggedInUser] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contactToOpen, setContactToOpen] = useState(null);
  const [tasksData, setTasksData] = useState(null);
  const [tasksLastUpdate, setTasksLastUpdate] = useState(null);
  const [tasksHasLoaded, setTasksHasLoaded] = useState(false);
  const [projectsData, setProjectsData] = useState(null);
  const [projectsHasLoaded, setProjectsHasLoaded] = useState(false);
  const [highlightedProjectId, setHighlightedProjectId] = useState(null);
  const [highlightedDossierId, setHighlightedDossierId] = useState(null);
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
  const [projectForm, setProjectForm] = useState({ name: '', type: 'Lead', priority: 'À prioriser', niveau: '', contratId: null });
  const [showResilies, setShowResilies] = useState(false);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionSuccess, setNotionSuccess] = useState(null);
  const [notionError, setNotionError] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [activeLabel, setActiveLabel] = useState('tous');
  const [activeTimePeriod, setActiveTimePeriod] = useState(null);
  const [labelStats, setLabelStats] = useState({ client: 0, assurance: 0, prospect: 0, apporteur: 0 });
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
  const [isContractsOpen, setIsContractsOpen] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [loadingAllTasks, setLoadingAllTasks] = useState(false);
  const [pipelineProjects, setPipelineProjects] = useState([]);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState(null);
  const [pipelineSortBy, setPipelineSortBy] = useState('priority'); // priority, tasks, date, name
  const [salesStats, setSalesStats] = useState(null);
  const [loadingSalesStats, setLoadingSalesStats] = useState(false);
  const [salesStatsHasLoaded, setSalesStatsHasLoaded] = useState(false);
  const [starredConvs, setStarredConvs] = useState([]);
  const [tagProjectModal, setTagProjectModal] = useState(null); // { tag: 'Gestion' | 'Sinistre' | 'Lead', jid: string }
  const [notionAnalytics, setNotionAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsHasLoaded, setAnalyticsHasLoaded] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [activeDossierChat, setActiveDossierChat] = useState(null); // { id: notionDossierId, nom: dossierName }
  const [brokerCodes, setBrokerCodes] = useState([]);
  const [loadingBrokerCodes, setLoadingBrokerCodes] = useState(false);
  // Contacts state
  const [notionContacts, setNotionContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsHasLoaded, setContactsHasLoaded] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactPlaylist, setContactPlaylist] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('contactPlaylist');
      return saved ? JSON.parse(saved) : { today: [], week: [] };
    }
    return { today: [], week: [] };
  });
  const [playlistView, setPlaylistView] = useState('all'); // 'all', 'today', 'week'
  const [brokerCodesHasLoaded, setBrokerCodesHasLoaded] = useState(false);
  const [editingCode, setEditingCode] = useState(null); // null or code object being edited
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderNote, setReminderNote] = useState('');
  const [showCreateContactModal, setShowCreateContactModal] = useState(false);
  const [createContactForm, setCreateContactForm] = useState({ name: '', phone: '', email: '' });
  const [creatingContact, setCreatingContact] = useState(false);
  const [contactDetails, setContactDetails] = useState(null);
  const [loadingContactDetails, setLoadingContactDetails] = useState(false);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [showLinkContactModal, setShowLinkContactModal] = useState(false);
  const [linkSearchResults, setLinkSearchResults] = useState([]);
  const [isSearchingContact, setIsSearchingContact] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [suggestedContact, setSuggestedContact] = useState(null);
  const [dossierLinks, setDossierLinks] = useState({ drive: null, gemini: null });
  const [showWakeupModal, setShowWakeupModal] = useState(false);
  const [wakeupData, setWakeupData] = useState({ date: '', time: '', message: '' });
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState(null);
  const [isEditingGemini, setIsEditingGemini] = useState(false);
  const [newGeminiUrl, setNewGeminiUrl] = useState('');
  const [activeStatusDropdown, setActiveStatusDropdown] = useState(null);
  const [isLinkingDossier, setIsLinkingDossier] = useState(false);
  // Conv V2 states (lifted to parent to prevent reset on re-render)
  const [v2SelectedConv, setV2SelectedConv] = useState(null);
  const v2SelectedConvRef = useRef(null);
  v2SelectedConvRef.current = v2SelectedConv; // sync ref without useEffect
  const [v2Messages, setV2Messages] = useState([]);
  const [v2SearchQuery, setV2SearchQuery] = useState('');
  const [v2ActiveFilter, setV2ActiveFilter] = useState('all');
  const [v2ShowArchived, setV2ShowArchived] = useState(false);
  const [v2IsLoadingMessages, setV2IsLoadingMessages] = useState(false);
  const [v2IsSending, setV2IsSending] = useState(false);
  const [showV2TaskModal, setShowV2TaskModal] = useState(false);
  const [emailTaskModal, setEmailTaskModal] = useState(null); // { name, comment, projectId, dossierId, dossierName, messageId }
  const [dashboardTaskModal, setDashboardTaskModal] = useState(null); // { projectId, projectName, dossierId, dossierName }
  const [entityPanel, setEntityPanel] = useState(null); // { type: 'project'|'task'|'dossier'|'contract'|'contact', id }
  const [contractModal, setContractModal] = useState(null); // { dossierId, dossierName, projectId, compagnieId, compagnieName, souscripteurId }
  const [dossierSearch, setDossierSearch] = useState('');
  const [dossierResults, setDossierResults] = useState([]);
  const [selectedDossier, setSelectedDossier] = useState(null);
  // Brain / Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [brainProcessing, setBrainProcessing] = useState(false);
  const [brainResult, setBrainResult] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const eventSourceRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const messageInputRef = useRef(null);
  const lastMessageCountRef = useRef(0); // Track message count for scroll behavior
  const isUserAtBottomRef = useRef(true); // Track if user is at bottom of messages
  const selectedJidRef = useRef(selectedJid);
  const searchTimeoutRef = useRef(null);

  // ==================== DATA FETCHING ====================
  const convHashRef = useRef('');
  const loadConversations = useCallback(async (label, time) => {
    try {
      const t = time !== undefined ? time : activeTimePeriod;
      const params = new URLSearchParams();
      if (t) params.append('time', t);
      const data = await api(`conversations?${params}`);
      const newConvs = data.conversations || [];
      const hash = newConvs.map(c => `${c.jid}:${c.last_message_time}:${c.unread_count}:${c.status}`).join('|');
      if (hash !== convHashRef.current) {
        convHashRef.current = hash;
        setConversations(newConvs);
      }
      setStats(data.stats || {});
      if (data.labelStats) setLabelStats(data.labelStats);
      if (data.allLabels) setAllLabels(data.allLabels);
    } catch (e) { console.error('Load error:', e); }
  }, [activeTimePeriod]);

  const loadDocuments = useCallback(async () => { try { const d = await api('documents'); setDocuments(d.documents || []); } catch {} }, []);
  const loadMessages = useCallback(async (jid, forceScrollToBottom = false) => {
    try {
      // Save scroll position before updating (only if not forcing scroll to bottom)
      const container = messagesContainerRef.current;
      const scrollPos = container ? container.scrollTop : 0;
      const wasAtBottom = forceScrollToBottom || (container ? (container.scrollHeight - container.scrollTop - container.clientHeight < 100) : true);

      const d = await api(`messages/${encodeURIComponent(jid)}`);
      setSelectedMessages(d.messages || []);
      setSelectedDocs(d.documents || []);
      setSelectedConv(d.conversation || null);

      // Restore scroll position after update (with small delay for render)
      setTimeout(() => {
        const cont = messagesContainerRef.current;
        if (cont) {
          if (wasAtBottom || forceScrollToBottom) {
            cont.scrollTop = cont.scrollHeight;
          } else {
            cont.scrollTop = scrollPos;
          }
        }
      }, 100);
    } catch {}
  }, []);
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
      const r = await fetch(`/api/notion/dossier-details?dossierId=${encodeURIComponent(dossierId)}&refresh=true`);
      const d = await r.json();
      setDossierDetails(d.error ? null : d);
    } catch { setDossierDetails(null); }
    setLoadingDetails(false);
  }, []);
  const loadContactDetails = useCallback(async (contactId) => {
    if (!contactId) { setContactDetails(null); return; }
    setLoadingContactDetails(true);
    try {
      const r = await fetch(`/api/notion/contact-details?contactId=${encodeURIComponent(contactId)}`);
      const d = await r.json();
      setContactDetails(d.error ? null : d);
    } catch { setContactDetails(null); }
    setLoadingContactDetails(false);
  }, []);
  const loadAllTasks = useCallback(async () => {
    setLoadingAllTasks(true);
    try { const r = await fetch('/api/notion/all-tasks?completed=true'); const d = await r.json(); setAllTasks(d.tasks || []); setTasksHasLoaded(true); } catch { setAllTasks([]); }
    setLoadingAllTasks(false);
  }, []);
  const loadPipelineProjects = useCallback(async () => {
    setLoadingPipeline(true);
    try { const r = await fetch('/api/notion/pipeline-projects'); const d = await r.json(); setPipelineProjects(d.projects || []); setProjectsHasLoaded(true); } catch { setPipelineProjects([]); }
    setLoadingPipeline(false);
  }, []);
  const loadNotionContacts = useCallback(async (forceRefresh = false) => {
    if (contactsHasLoaded && !forceRefresh) return;
    setLoadingContacts(true);
    try {
      const r = await fetch('/api/notion/contacts');
      const d = await r.json();
      setNotionContacts(d.contacts || []);
      setContactsHasLoaded(true);
    } catch { setNotionContacts([]); }
    setLoadingContacts(false);
  }, [contactsHasLoaded]);
  const savePlaylist = useCallback((newPlaylist) => {
    setContactPlaylist(newPlaylist);
    localStorage.setItem('contactPlaylist', JSON.stringify(newPlaylist));
  }, []);
  const addToPlaylist = useCallback((contactId, list) => {
    const newPlaylist = { ...contactPlaylist };
    if (!newPlaylist[list].includes(contactId)) {
      newPlaylist[list] = [...newPlaylist[list], contactId];
      savePlaylist(newPlaylist);
    }
  }, [contactPlaylist, savePlaylist]);
  const removeFromPlaylist = useCallback((contactId, list) => {
    const newPlaylist = { ...contactPlaylist };
    newPlaylist[list] = newPlaylist[list].filter(id => id !== contactId);
    savePlaylist(newPlaylist);
  }, [contactPlaylist, savePlaylist]);
  const loadSalesStats = useCallback(async (forceRefresh = false) => {
    // Si déjà chargé et pas de refresh forcé, ne rien faire
    if (salesStatsHasLoaded && !forceRefresh) return;

    setLoadingSalesStats(true);
    try {
      const r = await fetch(`/api/notion/sales-stats${forceRefresh ? '?refresh=true' : ''}`);
      const d = await r.json();
      if (d.error) {
        console.error('Sales stats error:', d.error);
        setSalesStats(null);
      } else {
        setSalesStats(d);
      }
    } catch (e) {
      console.error('Sales stats fetch error:', e);
      setSalesStats(null);
    }
    setSalesStatsHasLoaded(true);
    setLoadingSalesStats(false);
  }, [salesStatsHasLoaded]);
  const loadBrokerCodes = useCallback(async () => {
    setLoadingBrokerCodes(true);
    try {
      const r = await fetch('/api/broker-codes');
      const d = await r.json();
      setBrokerCodes(d.codes || []);
    } catch (e) {
      console.error('Broker codes fetch error:', e);
    }
    setBrokerCodesHasLoaded(true);
    setLoadingBrokerCodes(false);
  }, []);
  const saveBrokerCode = async (code) => {
    try {
      const r = await fetch('/api/broker-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(code),
      });
      const d = await r.json();
      if (d.codes) setBrokerCodes(d.codes);
      setEditingCode(null);
    } catch (e) {
      console.error('Save broker code error:', e);
    }
  };
  const deleteBrokerCode = async (id) => {
    if (!confirm('Supprimer ce code ?')) return;
    try {
      const r = await fetch(`/api/broker-codes?id=${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.codes) setBrokerCodes(d.codes);
    } catch (e) {
      console.error('Delete broker code error:', e);
    }
  };
  const loadNotionAnalytics = useCallback(async (forceRefresh = false) => {
    if (analyticsHasLoaded && !forceRefresh) return;
    setLoadingAnalytics(true);
    try { const r = await fetch('/api/notion/analytics'); const d = await r.json(); setNotionAnalytics(d); } catch { setNotionAnalytics(null); }
    setAnalyticsHasLoaded(true);
    setLoadingAnalytics(false);
  }, [analyticsHasLoaded]);
  const loadStarredConvs = useCallback(async () => {
    try { const d = await api('conversations?starred=1'); setStarredConvs(d.conversations?.filter(c => c.starred) || []); } catch { setStarredConvs([]); }
  }, []);
  const loadReminders = useCallback(async () => {
    try { const d = await api('reminders'); setUpcomingReminders(d.reminders || []); } catch { setUpcomingReminders([]); }
  }, []);
  const saveReminder = async (jid) => {
    if (!reminderDate) return;
    const dateTime = new Date(`${reminderDate}T${reminderTime}`);
    await api('update-status', 'POST', { jid, reminder_at: dateTime.getTime(), reminder_note: reminderNote || null });
    setShowReminderModal(false);
    setReminderDate('');
    setReminderTime('09:00');
    setReminderNote('');
    loadConversations();
    loadReminders();
  };
  const clearReminderFor = async (jid) => {
    await api('update-status', 'POST', { jid, reminder_at: null });
    loadConversations();
    loadReminders();
  };
  // dossierLinks derived from dossierDetails (no extra API call)
  const saveWakeup = async () => {
    if (!wakeupData.date || !wakeupData.time) return alert('Date et heure requises !');
    try {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: wakeupData.message || 'Rappel important',
          time: new Date(`${wakeupData.date}T${wakeupData.time}`).toISOString(),
        })
      });
      setShowWakeupModal(false);
      setWakeupData({ date: '', time: '', message: '' });
      alert('\u2705 Rappel programmé ! Vérifie que tu as l\'app NTFY installée.');
    } catch (e) { console.error('Save wakeup error:', e); }
  };
  const resyncConversation = async (jid) => {
    if (isResyncing) return;
    setIsResyncing(true);
    setResyncResult(null);
    try {
      // 1. Resync messages first
      const msgRes = await fetch('/api/whatsapp/resync-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid, count: 100 })
      });
      const msgData = await msgRes.json();

      // 2. Then resync media
      const mediaRes = await fetch('/api/whatsapp/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid })
      });
      const mediaData = await mediaRes.json();

      // Combine results
      const msgInfo = msgData.success ? `${msgData.total || msgData.synced || 0} msgs` : 'msgs erreur';
      const mediaInfo = mediaData.success ? mediaData.message : 'médias erreur';

      setResyncResult({ success: msgData.success && mediaData.success, message: `${msgInfo} | ${mediaInfo}` });
      loadDocuments();
      loadConversations();
      if (selectedJid === jid) loadMessages(jid);

      setTimeout(() => setResyncResult(null), 5000);
    } catch (e) {
      setResyncResult({ success: false, message: e.message });
      setTimeout(() => setResyncResult(null), 5000);
    }
    setIsResyncing(false);
  };
  const initGeminiChat = () => {
    const GEMS_URL = 'https://gemini.google.com/gem/1M7AVo1-jmIs3bmkFFwXNjwJjPGrysU67';
    const c = selectedConv;
    if (!c) return;
    const contactName = getName(c);
    const phone = c.phone || c.jid?.split('@')[0] || '';
    const email = c.email || '';
    const hasDossier = !!c.notion_dossier_id;
    const dossierName = c.notion_dossier_name || '';
    const dossierIdNum = dossierDetails?.dossier?.identifiant || '';
    // Nettoyage du nom (vire emojis et symboles)
    const idMatch = (dossierIdNum || '').match(/DOS-\d+/);
    const cleanId = idMatch ? idMatch[0] : dossierIdNum || 'DOS-XXX';
    const cleanName = (hasDossier ? dossierName : contactName)
      .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu, '')
      .replace(/[^\w\sÀ-ÿ-]/g, '')
      .trim();
    const finalConvName = hasDossier ? `${cleanId} ${cleanName}` : `${cleanName} - Prospect SVA`;
    // Build contracts summary from dossierDetails
    let contractsSummary = '';
    if (dossierDetails?.contracts?.length > 0) {
      const actifs = dossierDetails.contracts.filter(ct => !ct.desactive);
      const resilies = dossierDetails.contracts.filter(ct => ct.desactive);
      contractsSummary = '\n\nCONTRATS EN PORTEFEUILLE :\n';
      if (actifs.length > 0) {
        contractsSummary += actifs.map(ct =>
          `  ACTIF | ${ct.name} | ${ct.type_assurance || ct.productType || '?'} | ${ct.cie_details || ''} | Effet: ${ct.dateEffet || '?'} | Signature: ${ct.dateSignature || '?'}${ct.details ? ` | ${ct.details}` : ''}`
        ).join('\n');
      }
      if (resilies.length > 0) {
        contractsSummary += `\n  --- Resiliés (${resilies.length}) ---\n`;
        contractsSummary += resilies.map(ct =>
          `  RESILIE | ${ct.name} | ${ct.type_assurance || ct.productType || '?'} | Résilié: ${ct.dateResiliation || '?'}`
        ).join('\n');
      }
    }
    // Build projects summary
    let projectsSummary = '';
    if (dossierDetails?.projects?.length > 0) {
      projectsSummary = '\n\nPROJETS EN COURS :\n' + dossierDetails.projects.map(p =>
        `  - ${p.name} | Type: ${p.type} | Niveau: ${p.niveau || '?'} | Priorité: ${p.priority || '?'}`
      ).join('\n');
    }
    // Build WhatsApp conversation
    let whatsappConversation = '';
    if (selectedMessages && selectedMessages.length > 0) {
      const recentMessages = selectedMessages.slice(-100); // Derniers 100 messages max
      whatsappConversation = '\n\nCONVERSATION WHATSAPP RÉCENTE :\n' + '─'.repeat(40) + '\n' +
        recentMessages.map(m => {
          const d = new Date(m.timestamp);
          const date = d.toLocaleDateString('fr-FR');
          const time = d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
          const sender = m.from_me ? 'Moi (JSabban)' : (m.sender_name || contactName);
          return `[${date} ${time}] ${sender}: ${m.text || '(média)'}`;
        }).join('\n') + '\n' + '─'.repeat(40);
    }
    const prompt = `⚠️ INSTRUCTION CRITIQUE - NOMME CE CHAT IMMÉDIATEMENT ⚠️
Avant toute chose, clique sur "Renommer" et nomme cette conversation :
"${finalConvName}"

---

ACT : Tu es le Responsable Senior du dossier chez Smart Value Assurances.
TON : Professionnel, Direct, Stratégique (Zéro blabla).
OBJECTIF : Analyser le dossier, débloquer la situation et sécuriser le business.

QUI JE SUIS :
Jeremy Sabban, courtier en assurances chez Smart Value Assurances (SVA).
${hasDossier ? `${contactName} est mon client. Je gère son dossier d'assurances.` : `${contactName} est un prospect que je dois qualifier.`}

CONTEXTE DOSSIER :
- Réf : ${cleanId} ${cleanName}
- Client : ${contactName}
- Tél : ${phone}${email ? `\n- Email : ${email}` : ''}
${contractsSummary}${projectsSummary}${whatsappConversation}

INSTRUCTIONS DE DÉMARRAGE :
1. Lis d'abord la conversation WhatsApp ci-dessus pour comprendre le contexte récent.
2. Screene ma boîte email Gmail des 9 derniers mois pour trouver TOUS les échanges liés à ${contactName}${hasDossier ? ` (dossier: ${dossierName})` : ''}.
3. Fais une synthèse croisée WhatsApp + Emails, classée chronologiquement.
4. Identifie les 3 actions prioritaires (Matrice Eisenhower).
5. Prépare un message de relance percutant si nécessaire.

TON RÔLE PERMANENT :
- Tu connais la conversation WhatsApp ci-dessus
- Tu screenes et analyses mes mails et documents
- Tu rédiges des réponses pro aux compagnies et clients
- Tu me rappelles les échéances et points importants
- Tu connais le contexte contrats ci-dessus

Commence par analyser la conversation WhatsApp, puis le screening email.`;
    navigator.clipboard.writeText(prompt);
    window.open(GEMS_URL, '_blank');
    alert(`Prompt Expert + Conversation WhatsApp copiés !\n\nNom du chat : "${finalConvName}"\n\n1. Colle dans Gemini (CMD+V)\n2. RENOMME le chat : "${finalConvName}"\n3. Copie l'URL créée et colle-la ici.`);
    setIsEditingGemini(true);
  };
  const saveGeminiLink = async () => {
    if (!newGeminiUrl.includes('gemini.google.com')) return alert('Lien invalide');
    const dossierId = selectedConv?.notion_dossier_id;
    if (!dossierId) return;
    try {
      await fetch('/api/notion/update-gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: dossierId, gemini_url: newGeminiUrl }) });
      setDossierLinks(prev => ({ ...prev, gemini: newGeminiUrl }));
      setIsEditingGemini(false);
      setNewGeminiUrl('');
    } catch (e) { console.error('Save gemini error:', e); }
  };
  const toggleStar = async (jid, currentStarred) => {
    await api('update-status', 'POST', { jid, starred: !currentStarred });
    loadConversations();
    loadStarredConvs();
    if (selectedJid === jid) loadMessages(jid);
  };

  // Toggle task completion (optimistic update)
  const [togglingTaskId, setTogglingTaskId] = useState(null);
  const toggleTaskCompletion = async (task, completed) => {
    if (togglingTaskId) return; // Prevent double-click
    setTogglingTaskId(task.id);

    // Optimistic update: update local state immediately
    const previousDetails = dossierDetails;
    if (dossierDetails) {
      const updateTasks = (tasks) => tasks?.map(t => t.id === task.id ? { ...t, completed } : t);
      setDossierDetails({
        ...dossierDetails,
        projects: dossierDetails.projects?.map(p => ({ ...p, tasks: updateTasks(p.tasks) })),
        orphanTasks: updateTasks(dossierDetails.orphanTasks)
      });
    }

    try {
      // Use the new route that sends WhatsApp notification
      const res = await fetch('/api/notion/update-task-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          completed
        }),
      });
      if (!res.ok) throw new Error('Update failed');
    } catch (e) {
      console.error('Toggle task error:', e);
      // Revert on error
      setDossierDetails(previousDetails);
    }
    setTogglingTaskId(null);
  };

  // Keep selectedJidRef in sync for SSE closure
  useEffect(() => { selectedJidRef.current = selectedJid; }, [selectedJid]);

  // ==================== SSE ====================
  useEffect(() => {
    // Get logged in user from cookie
    const cookies = document.cookie.split(';');
    const userCookie = cookies.find(c => c.trim().startsWith('smartvalue_user='));
    if (userCookie) {
      setLoggedInUser(decodeURIComponent(userCookie.split('=')[1]));
    }
    checkStatus(); loadConversations(); loadDocuments(); loadStarredConvs(); loadReminders();
    const es = new EventSource('/api/whatsapp/events'); eventSourceRef.current = es;
    es.onmessage = (event) => { try { const d = JSON.parse(event.data);
      if (d.type === 'status') { setConnected(d.data.status === 'connected'); setConnecting(d.data.status === 'connecting'); if (d.data.status === 'connected') { setQrImage(null); loadConversations(); } }
      else if (d.type === 'qr') fetchQR();
      else if (d.type === 'message' || d.type === 'message_sent') { loadConversations(); if (selectedJidRef.current === d.data.jid) loadMessages(d.data.jid); if (v2SelectedConv && d.data.jid === v2SelectedConv.jid) { fetch(`/api/whatsapp/messages/${encodeURIComponent(d.data.jid)}`).then(r => r.json()).then(data => setV2Messages(data.messages || [])).catch(() => {}); } }
      else if (d.type === 'document') { loadDocuments(); loadConversations(); }
      else if (d.type === 'labels_updated' || d.type === 'sync_progress' || d.type === 'sync_complete' || d.type === 'contacts_updated') { loadConversations(); loadDocuments(); }
    } catch {} };
    es.onerror = () => {};
    const iv = setInterval(() => { loadConversations(); loadDocuments(); }, 30000);
    return () => { es.close(); clearInterval(iv); };
  }, []);

  // Fonction de scroll vers le bas (smooth pour meilleure UX)
  const scrollToBottom = useCallback((smooth = true) => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      isUserAtBottomRef.current = true;
    }
  }, []);

  // Track if user is at bottom of messages container
  const handleMessagesScroll = useCallback((e) => {
    const container = e.target;
    const threshold = 100; // pixels from bottom to consider "at bottom"
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    isUserAtBottomRef.current = isAtBottom;
  }, []);

  // Reset et scroll quand on change de conversation
  useEffect(() => {
    lastMessageCountRef.current = 0;
    isUserAtBottomRef.current = true; // Reset to bottom when changing conversation
    // Scroll immédiat (pas smooth) pour changement de conversation
    setTimeout(() => scrollToBottom(false), 100);
    setTimeout(() => scrollToBottom(false), 300);
  }, [selectedJid, scrollToBottom]);

  // Scroll smooth quand un nouveau message arrive (seulement si l'utilisateur est en bas)
  useEffect(() => {
    if (selectedMessages.length > 0) {
      const isNewMessage = selectedMessages.length > lastMessageCountRef.current;
      lastMessageCountRef.current = selectedMessages.length;

      if (isNewMessage && isUserAtBottomRef.current) {
        // Smooth scroll pour nouveau message seulement si l'utilisateur est en bas
        setTimeout(() => scrollToBottom(true), 50);
      }
    }
  }, [selectedMessages, scrollToBottom]);
  useEffect(() => { loadConversations(activeLabel, activeTimePeriod); }, [activeLabel, activeTimePeriod]);

  // URL param: auto-open contact from ?contact=PHONE
  const urlContactHandledRef = useRef(false);
  useEffect(() => {
    if (urlContactHandledRef.current || conversations.length === 0) return;
    const contactParam = searchParams.get('contact');
    if (contactParam) {
      const conv = conversations.find(c => {
        const phone = c.phone || c.jid.split('@')[0];
        return phone === contactParam || phone.endsWith(contactParam) || contactParam.endsWith(phone);
      });
      if (conv) {
        urlContactHandledRef.current = true;
        openConversation(conv);
      }
    }
  }, [conversations, searchParams]);

  useEffect(() => { if (view === 'journal') loadAgentLogs(); }, [view, logTypeFilter]);
  useEffect(() => { if (view === 'kanban') { if (!projectsHasLoaded && !loadingPipeline) loadPipelineProjects(); if (!tasksHasLoaded && !loadingAllTasks) loadAllTasks(); } }, [view]);
  useEffect(() => { if (view === 'tasks' && !tasksHasLoaded && !loadingAllTasks) loadAllTasks(); }, [view]);
  useEffect(() => { if (view === 'calendar' && !tasksHasLoaded && !loadingAllTasks) loadAllTasks(); }, [view]);
  useEffect(() => { if (view === 'projects' && !projectsHasLoaded && !loadingPipeline) loadPipelineProjects(); }, [view]);
  useEffect(() => { if (view === 'contacts' && !contactsHasLoaded && !loadingContacts) loadNotionContacts(); }, [view, contactsHasLoaded, loadingContacts, loadNotionContacts]);
  useEffect(() => { if (view === 'stats' && !salesStatsHasLoaded && !loadingSalesStats) loadSalesStats(); }, [view]);
  useEffect(() => { if (view === 'analytics' && !analyticsHasLoaded && !loadingAnalytics) loadNotionAnalytics(); }, [view]);

  // GESTION DES RAPPELS (Via ntfy + WhatsApp perso)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/reminders');
        const reminders = await res.json();
        const now = new Date();
        const dueReminders = reminders.filter(r => new Date(r.time) <= now);
        if (dueReminders.length > 0) {
          for (const r of dueReminders) {
            // 1. SONNERIE VIA NTFY (Priorité Max)
            try {
              await fetch('https://ntfy.sh/smartvalue_alerte_jeremy', {
                method: 'POST',
                body: `RAPPEL : ${r.text}`,
                headers: { 'Title': '\u23f0 SmartValue Alarme', 'Priority': 'urgent', 'Tags': 'rotating_light,alarm_clock' }
              });
              console.log('Alarme ntfy envoyée');
            } catch (e) { console.error('Erreur ntfy', e); }
            // 2. TRACE ÉCRITE SUR WHATSAPP (Note à soi-même)
            try {
              await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jid: '33624007694@s.whatsapp.net', text: `\u2705 Rappel traité : ${r.text}` })
              });
            } catch {}
            // 3. NETTOYAGE
            await fetch('/api/reminders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) });
          }
        }
      } catch (e) { console.error('Erreur cycle rappels', e); }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sync tags from dossier details (active projects only)
  const dossierProjectsRef = useRef(null);
  useEffect(() => {
    if (!dossierDetails?.projects || !selectedConv?.jid) return;
    const projectsKey = JSON.stringify(dossierDetails.projects.map(p => ({ id: p.id, type: p.type })));
    if (dossierProjectsRef.current === projectsKey) return;
    dossierProjectsRef.current = projectsKey;

    const newTagProjects = {};
    const newTags = [];
    for (const project of dossierDetails.projects) {
      const type = project.type;
      if (!CATEGORIES.includes(type)) continue;
      if (!newTagProjects[type]) newTagProjects[type] = [];
      newTagProjects[type].push({ id: project.id, name: project.name, url: project.url });
      if (!newTags.includes(type)) newTags.push(type);
    }

    const currentTP = JSON.stringify(selectedConv.tag_projects || {});
    const newTP = JSON.stringify(newTagProjects);
    if (currentTP !== newTP) {
      api('update-status', 'POST', { jid: selectedConv.jid, tag_projects: newTagProjects, tags: newTags }).then(() => {
        loadConversations();
        if (selectedJid) loadMessages(selectedJid);
      });
    }
  }, [dossierDetails?.projects, selectedConv?.jid]);

  // ==================== ACTIONS ====================
  const handleConnect = async () => {
    setConnecting(true);
    await api('connect', 'POST');
    // Fetch QR immédiatement, puis polling toutes les 1.5s
    const pollQR = async () => {
      const d = await api('qr');
      if (d.qr) setQrImage(d.qr);
      return d;
    };
    await pollQR(); // Premier fetch immédiat
    const iv = setInterval(async () => {
      const d = await pollQR();
      if (d.status === 'connected' || d.status === 'disconnected') {
        clearInterval(iv);
        if (d.status === 'connected') { setConnected(true); setConnecting(false); setQrImage(null); }
      }
    }, 1500);
  };
  const fetchQR = async () => { const d = await api('qr'); if (d.qr) setQrImage(d.qr); };
  const handleDisconnect = async () => { await api('disconnect', 'POST'); setConnected(false); setConnecting(false); setQrImage(null); };
  const openConversation = (conv) => {
    setSelectedJid(conv.jid); setView('detail'); lastMessageCountRef.current = 0; isUserAtBottomRef.current = true; loadMessages(conv.jid, true); setEditingName(false); setEditingEmail(false); setSuggestedContact(null);
    // Update URL with contact phone
    const phone = conv.phone || conv.jid.split('@')[0];
    window.history.pushState({}, '', `?contact=${phone}`);
    if (conv.notion_dossier_id) { loadDossierDetails(conv.notion_dossier_id); loadDossierProjects(conv.notion_dossier_id); setContactDetails(null); }
    else if (conv.notion_contact_id) { setDossierDetails(null); setDossierProjects([]); loadContactDetails(conv.notion_contact_id); }
    else { setDossierDetails(null); setDossierProjects([]); setContactDetails(null); }
    // Smart match: auto-search by phone if no contact linked
    if (!conv.notion_contact_id && !conv.notion_dossier_id) {
      fetch('/api/notion/search-contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: phone }) })
        .then(r => r.json()).then(d => { if (d.results?.length === 1) setSuggestedContact(d.results[0]); }).catch(() => {});
    }
  };
  const updateStatus = async (jid, s) => { await api('update-status', 'POST', { jid, status: s }); loadConversations(); if (selectedJid === jid) loadMessages(jid); };
  const handleQuickStatusUpdate = async (e, jid, newStatus) => {
    e.stopPropagation();
    setActiveStatusDropdown(null);
    setConversations(prev => prev.map(c => c.jid === jid ? { ...c, status: newStatus } : c));
    await api('update-status', 'POST', { jid, status: newStatus });
    loadConversations();
  };
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
  const updateName = async (jid, name) => { if (!name.trim()) return; await api('update-status', 'POST', { jid, custom_name: name.trim() }); setEditingName(false); loadConversations(); loadMessages(jid); };
  const updateEmail = async (jid, email) => { await api('update-status', 'POST', { jid, email: email?.trim() || '' }); setEditingEmail(false); loadConversations(); loadMessages(jid); };
  const updatePhone = async (jid, phone) => { await api('update-status', 'POST', { jid, phone: phone?.trim() || '' }); setEditingPhone(false); loadConversations(); loadMessages(jid); };

  // Brain / Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        await sendToBrain(audioBlob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) { console.error('Mic error:', e); alert('Impossible d\'accéder au micro'); }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  const sendToBrain = async (audioBlob) => {
    setBrainProcessing(true);
    setBrainResult(null);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        const res = await fetch('/api/brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audioBase64: base64 }) });
        const data = await res.json();
        setBrainResult(data);
        setTimeout(() => setBrainResult(null), 5000);
      };
      reader.readAsDataURL(audioBlob);
    } catch (e) { console.error('Brain error:', e); setBrainResult({ error: 'Erreur cerveau' }); }
    setBrainProcessing(false);
  };

  // Notion
  const searchDossiers = async (q) => { setNotionSearching(true); setNotionError(null); try { const r = await fetch('/api/notion/search-dossiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) }); const d = await r.json(); if (d.error) { setNotionError(d.error); setNotionResults([]); } else setNotionResults(d.results || []); } catch { setNotionError('Erreur Notion'); setNotionResults([]); } setNotionSearching(false); };
  const linkDossier = async (dossier) => { if (!selectedJid) return; setNotionLoading(true); try { await fetch('/api/notion/link-dossier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jid: selectedJid, dossierId: dossier.id, dossierName: dossier.name, dossierUrl: dossier.url }) }); setShowNotionLink(false); setNotionSuccess('Dossier lié !'); setTimeout(() => setNotionSuccess(null), 3000); loadMessages(selectedJid); loadConversations(); loadDossierProjects(dossier.id); loadDossierDetails(dossier.id); } catch {} setNotionLoading(false); };
  const createTask = async () => { if (!taskForm.name) return; setNotionLoading(true); try { const r = await fetch('/api/notion/create-task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: taskForm.name, priority: taskForm.priority, date: taskForm.date || null, dossierId: selectedConv?.notion_dossier_id, dossierName: selectedConv?.notion_dossier_name, conversationJid: selectedJid, conversationName: selectedConv?.name, projectId: taskForm.projectId || null }) }); const d = await r.json(); if (d.success) { setShowCreateTask(false); setTaskForm({ name: '', priority: 'À prioriser', date: new Date().toISOString().split('T')[0], projectId: '' }); setNotionSuccess('Tâche créée !'); setTimeout(() => setNotionSuccess(null), 3000); if (selectedConv?.notion_dossier_id) loadDossierDetails(selectedConv.notion_dossier_id, true); } else alert('Erreur: ' + (d.error || '?')); } catch (e) { alert('Erreur: ' + e.message); } setNotionLoading(false); };
  const createProject = async () => { if (!projectForm.name) return; setNotionLoading(true); try { const r = await fetch('/api/notion/create-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: projectForm.name, type: projectForm.type, priority: projectForm.priority, niveau: projectForm.niveau || null, contratId: projectForm.contratId || null, date: new Date().toISOString().split('T')[0], dossierId: selectedConv?.notion_dossier_id || null, dossierName: selectedConv?.notion_dossier_name || null, contactId: selectedConv?.notion_contact_id || null, conversationJid: selectedJid, conversationName: selectedConv?.name }) }); const d = await r.json(); if (d.success) { setShowCreateOpp(false); setProjectForm({ name: '', type: 'Lead', priority: 'À prioriser', niveau: '', contratId: null }); setNotionSuccess(projectForm.type === 'Sinistre' ? 'Projet sinistre créé ✅' : 'Projet créé !'); setTimeout(() => setNotionSuccess(null), 3000); if (selectedConv?.notion_dossier_id) { loadDossierProjects(selectedConv.notion_dossier_id); loadDossierDetails(selectedConv.notion_dossier_id, true); } else if (selectedConv?.notion_contact_id) { loadContactDetails(selectedConv.notion_contact_id); } } else alert('Erreur: ' + (d.error || '?')); } catch (e) { alert('Erreur: ' + e.message); } setNotionLoading(false); };
  const syncToNotion = async () => { if (!selectedConv) return; setNotionLoading(true); try { const r = await fetch('/api/notion/sync-contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: selectedConv.name, phone: selectedConv.phone, email: selectedConv.email || null, dossierId: selectedConv.notion_dossier_id || null }) }); const d = await r.json(); if (d.success) { setNotionSuccess(d.action === 'created' ? 'Contact Notion créé !' : 'Contact Notion mis à jour !'); setTimeout(() => setNotionSuccess(null), 3000); } else alert('Erreur: ' + (d.error || '?')); } catch (e) { alert('Erreur: ' + e.message); } setNotionLoading(false); };

  // Create and link a new Notion contact
  const createAndLinkContact = async () => {
    if (!selectedJid || !createContactForm.name) return;
    setCreatingContact(true);
    try {
      const r = await fetch('/api/notion/sync-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createContactForm.name,
          phone: createContactForm.phone || selectedConv?.phone,
          email: createContactForm.email || selectedConv?.email || null,
          dossierId: selectedConv?.notion_dossier_id || null,
        }),
      });
      const d = await r.json();
      if (d.success && d.contactId) {
        await api('update-status', 'POST', {
          jid: selectedJid,
          notion_contact_id: d.contactId,
          notion_contact_name: createContactForm.name,
          notion_contact_url: d.contactUrl || null,
        });
        loadConversations();
        if (selectedJid) loadMessages(selectedJid);
        setShowCreateContactModal(false);
        setCreateContactForm({ name: '', phone: '', email: '' });
        setNotionSuccess('Contact créé et lié !');
        setTimeout(() => setNotionSuccess(null), 3000);
        if (d.contactId) loadContactDetails(d.contactId);
      } else {
        alert('Erreur: ' + (d.error || '?'));
      }
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
    setCreatingContact(false);
  };

  // Link conversation to a Notion contact
  const linkConversationToContact = async (contact) => {
    if (!selectedJid) return;
    await api('update-status', 'POST', { jid: selectedJid, notion_contact_id: contact.id, notion_contact_name: contact.name, notion_contact_url: contact.url });
    loadConversations();
    if (selectedJid) loadMessages(selectedJid);
  };

  // Search Notion contacts for linking
  const searchNotionContacts = async (query) => {
    if (!query || query.trim().length < 2) { setLinkSearchResults([]); return; }
    setIsSearchingContact(true);
    try {
      const r = await fetch('/api/notion/search-contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const d = await r.json();
      setLinkSearchResults(d.results || []);
    } catch { setLinkSearchResults([]); }
    setIsSearchingContact(false);
  };

  // Link an existing Notion contact to the conversation
  const handleLinkNotionContact = async (contact) => {
    if (!selectedJid) return;
    try {
      const r = await fetch('/api/notion/link-notion-contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jid: selectedJid, notionContactId: contact.id, notionContactName: contact.name, notionContactUrl: contact.url }) });
      const d = await r.json();
      if (d.success) {
        loadConversations();
        loadMessages(selectedJid);
        setShowLinkContactModal(false);
        setLinkSearchResults([]);
        setLinkSearchQuery('');
        setSuggestedContact(null);
        setNotionSuccess('Contact lié !');
        setTimeout(() => setNotionSuccess(null), 3000);
        if (contact.id) loadContactDetails(contact.id);
      }
    } catch (e) { alert('Erreur: ' + e.message); }
  };

  // Search dossiers for linking a contact to a dossier
  const searchDossiersForLink = async (query) => {
    setDossierSearch(query);
    if (query.length > 2) {
      try {
        const res = await fetch('/api/notion/search-dossier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
        const data = await res.json();
        setDossierResults(data.results || []);
      } catch { setDossierResults([]); }
    } else {
      setDossierResults([]);
    }
  };

  // Link a conversation (and optionally its Notion contact) to a dossier
  const linkContactToDossier = async (dossierId, dossierName, dossierUrl) => {
    const c = conversations.find(cv => cv.jid === selectedJid);
    if (!selectedJid) return;
    try {
      // 1. If contact is linked in Notion, update the contact's dossier relation
      if (c?.notion_contact_id) {
        await fetch('/api/notion/update-contact-dossier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: c.notion_contact_id, dossier_id: dossierId }) });
      }
      // 2. Link dossier in local DB via existing link-dossier route
      await fetch('/api/notion/link-dossier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jid: selectedJid, dossierId, dossierName, dossierUrl: dossierUrl || '' }) });
      setIsLinkingDossier(false);
      setDossierSearch('');
      setDossierResults([]);
      loadConversations();
      loadDossierDetails(dossierId);
    } catch (e) { alert('Erreur: ' + e.message); }
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
    <div className="mt-2 flex gap-1.5">
      <a href="https://claude.ai/project/019d9645-7417-7277-82d4-6c4cd55973af" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium transition-colors border border-gray-700 hover:border-gray-500">💬 Claude</a>
      <button onClick={() => { if(confirm('Vider le cache du navigateur et recharger ?')) { caches.keys().then(k => Promise.all(k.map(n => caches.delete(n)))).then(() => window.location.reload(true)); }}} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium transition-colors border border-gray-700 hover:border-gray-500">🗑️ Cache</button>
    </div>
    <div className={`mt-3 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs ${connected ? 'bg-emerald-500/10 text-emerald-400' : connecting ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
      <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : connecting ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />{connected ? 'WhatsApp connecté' : connecting ? 'Connexion...' : 'Déconnecté'}</div>
      {connected ? (
        <button onClick={async () => {
          try {
            await fetch('/api/whatsapp/reconnect', { method: 'POST' });
            loadConversations();
            alert('Sync lancé.\n\nSi des messages manquent, ouvre WhatsApp sur ton téléphone et consulte les conversations - ça forcera la synchro.');
          } catch {}
        }} className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 rounded text-emerald-400 text-xs" title="Forcer sync">🔄</button>
      ) : !connecting && (
        <button onClick={async () => { try { await fetch('/api/whatsapp/reconnect', { method: 'POST' }); } catch {} }} className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 rounded text-amber-400 text-xs">🔄</button>
      )}
    </div></div>
    <nav className="flex-1 p-3 space-y-1">{[
      { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
      { id: 'kanban', icon: 'kanban', label: 'Pipeline' },
      { id: 'conversations2', icon: 'message', label: 'WhatsApp', badge: (labelStats.client||0)+(labelStats.assurance||0)+(labelStats.prospect||0) },
      { id: 'dossiers', icon: 'folder', label: 'Dossiers' },
      { id: 'contacts', icon: 'user', label: 'Contacts' },
      { id: 'tasks', icon: 'tasks', label: 'Tâches' },
      { id: 'projects', icon: 'project', label: 'Projets' },
      { id: 'calendar', icon: 'calendar', label: 'Calendrier' },
      { id: 'documents', icon: 'file', label: 'Documents', badge: stats.pending_docs || 0 },
      { id: 'emails', icon: 'mail', label: 'Emails' },
      { id: 'drive', icon: 'drive', label: 'Drive' },
      { id: 'stats', icon: 'trendUp', label: 'Statistiques' },
      { id: 'analytics', icon: 'chart', label: 'Analytics' },
      { id: 'contrats', icon: 'file', label: 'Contrats' },
      { id: 'finance', icon: 'trendUp', label: 'Finance' },
      { id: 'commissions', icon: 'trendUp', label: 'Commissions' },
      { id: 'codes', icon: 'key', label: 'Codes Courtage' },
      { id: 'settings', icon: 'settings', label: 'Paramètres' },
    ].map((item) => (<button key={item.id} onClick={() => { setView(item.id); setSidebarOpen(false); if (item.id !== 'detail' && item.id !== 'dossierDetail') { setSelectedJid(null); setSelectedDossier(null); window.history.pushState({}, '', '/'); } }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${view === item.id || (view === 'detail' && item.id === 'conversations') || (view === 'dossierDetail' && item.id === 'dossiers') ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
      <Icon name={item.icon} className="w-4 h-4 flex-shrink-0" /><span className="flex-1 text-left">{item.label}</span>
      {item.badge > 0 && <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">{item.badge}</span>}
    </button>))}</nav>
    <div className="p-3 border-t border-gray-800"><div className="flex items-center gap-3 px-3 py-2"><div className={`w-8 h-8 rounded-full ${loggedInUser === 'Perrine' ? 'bg-pink-600' : 'bg-emerald-600'} flex items-center justify-center text-xs font-bold`}>{loggedInUser ? loggedInUser.substring(0, 2).toUpperCase() : 'SV'}</div><div><p className="text-sm font-medium">{loggedInUser || 'Smart Value'}</p><p className="text-xs text-gray-400">Smart Value</p></div></div></div>
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
      <p className={`text-xs truncate ${c.last_message_from_me ? 'text-gray-400' : 'text-gray-500'}`}>{formatLastMessage(c)}</p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {c.labels?.map((lbl) => (<span key={lbl} className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${getLabelColor(lbl)}`}>{lbl}</span>))}
        <div className="relative inline-block">
          <button onClick={(e) => { e.stopPropagation(); setActiveStatusDropdown(activeStatusDropdown === c.jid ? null : c.jid); }} className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUSES[c.status]?.color || 'bg-gray-100 text-gray-600'} hover:opacity-80 transition-opacity`}>{STATUSES[c.status]?.label || c.status} ▾</button>
          {activeStatusDropdown === c.jid && (
            <div className="absolute left-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden">
              {Object.entries(STATUSES).map(([key, meta]) => (
                <div key={key} onClick={(e) => handleQuickStatusUpdate(e, c.jid, key)} className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 flex items-center gap-2 ${c.status === key ? 'bg-blue-50 font-medium' : ''}`}>
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`}></span>
                  {meta.label}
                </div>
              ))}
            </div>
          )}
        </div>
        {(c.document_count||0) > 0 && <span className="text-xs text-gray-400 flex items-center gap-1"><Icon name="clip" className="w-3 h-3" /> {c.document_count}</span>}
        {(c.notion_dossier_id || c.notion_contact_id) && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-900 text-white font-bold">N</span>}
      </div>
    </div>
    <div className="flex-shrink-0 text-right"><p className="text-xs text-gray-400">{timeAgo(c.last_message_time)}</p></div>
  </button>);

  // ==================== DASHBOARD ====================
  const Dashboard = () => {
    const statusCounts = { client: conversations.filter(c => c.status === 'client').length, prospect: conversations.filter(c => c.status === 'prospect').length, inbox: conversations.filter(c => c.status === 'inbox').length };
    const [taskProjects, setTaskProjects] = useState([]);
    const [orphanTasks, setOrphanTasks] = useState([]);
    const [allTasksList, setAllTasksList] = useState([]);
    const [totalTasks, setTotalTasks] = useState(0);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [tasksLoaded, setTasksLoaded] = useState(false);
    const [responsableFilter, setResponsableFilter] = useState('Perrine');
    const [togglingTaskId, setTogglingTaskId] = useState(null);
    const [commentingTaskId, setCommentingTaskId] = useState(null);
    const [commentText, setCommentText] = useState('');
    const [sendingComment, setSendingComment] = useState(false);
    const [dashboardView, setDashboardView] = useState('projet'); // 'projet', 'orphan', 'date'

    useEffect(() => { loadTasks(); }, [responsableFilter]);

    const loadTasks = async () => {
      setLoadingTasks(true);
      try {
        const url = responsableFilter
          ? `/api/notion/tasks-by-responsable?responsable=${responsableFilter}`
          : '/api/notion/tasks-by-responsable';
        const res = await fetch(url);
        const data = await res.json();
        setTaskProjects(data.projects || []);
        setOrphanTasks(data.orphanTasks || []);
        setAllTasksList(data.allTasks || []);
        setTotalTasks(data.totalTasks || 0);
        setTasksLoaded(true);
      } catch (e) { console.error(e); }
      setLoadingTasks(false);
    };

    const toggleTaskComplete = async (task, projectId) => {
      setTogglingTaskId(task.id);
      try {
        await fetch('/api/notion/update-task-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, completed: true })
        });
        if (projectId) {
          setTaskProjects(prev => prev.map(p =>
            p.id === projectId ? { ...p, tasks: p.tasks.filter(t => t.id !== task.id) } : p
          ).filter(p => p.tasks.length > 0));
        } else {
          setOrphanTasks(prev => prev.filter(t => t.id !== task.id));
        }
        setAllTasksList(prev => prev.filter(t => t.id !== task.id));
        setTotalTasks(prev => prev - 1);
      } catch (e) { console.error(e); }
      setTogglingTaskId(null);
    };

    const addComment = async (task, projectId) => {
      if (!commentText.trim() || !projectId) return;
      setSendingComment(true);
      try {
        await fetch('/api/notion/add-project-comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, taskName: task.name, comment: commentText.trim() })
        });
        setCommentText('');
        setCommentingTaskId(null);
      } catch (e) { console.error(e); }
      setSendingComment(false);
    };

    const getTypeColors = (type) => {
      const colors = {
        'Lead': { bg: 'bg-purple-50', border: 'border-l-purple-500', badge: 'bg-purple-100 text-purple-700' },
        'Gestion': { bg: 'bg-emerald-50', border: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
        'Sinistre': { bg: 'bg-red-50', border: 'border-l-red-500', badge: 'bg-red-100 text-red-700' },
      };
      return colors[type] || { bg: 'bg-gray-50', border: 'border-l-gray-400', badge: 'bg-gray-100 text-gray-700' };
    };

    const getPriorityBadge = (priority) => {
      if (priority?.includes('Urg')) return { text: 'Urg & Imp', color: 'bg-red-100 text-red-700' };
      if (priority === 'Important') return { text: 'Important', color: 'bg-orange-100 text-orange-700' };
      if (priority === 'Secondaire') return { text: 'Secondaire', color: 'bg-gray-100 text-gray-500' };
      return null;
    };

    // Group tasks by date for date view
    const groupByDate = (tasks) => {
      const groups = {};
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      tasks.forEach(task => {
        const created = new Date(task.createdAt);
        const taskDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
        const diff = Math.floor((today - taskDay) / 86400000);

        let label;
        if (diff === 0) label = "Aujourd'hui";
        else if (diff === 1) label = "Hier";
        else if (diff < 7) label = "Cette semaine";
        else if (diff < 14) label = "Semaine dernière";
        else if (diff < 30) label = "Ce mois";
        else label = "Plus ancien";

        if (!groups[label]) groups[label] = [];
        groups[label].push(task);
      });

      const order = ["Aujourd'hui", "Hier", "Cette semaine", "Semaine dernière", "Ce mois", "Plus ancien"];
      return order.filter(k => groups[k]).map(k => ({ label: k, tasks: groups[k] }));
    };

    const TaskRow = ({ task, projectId, showProject = false }) => {
      const priorityBadge = getPriorityBadge(task.priority);
      const isCommenting = commentingTaskId === task.id;
      const typeColors = getTypeColors(task.projectType);

      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 group">
            <button
              onClick={() => toggleTaskComplete(task, projectId)}
              disabled={togglingTaskId === task.id}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${togglingTaskId === task.id ? 'opacity-50' : 'border-gray-300 hover:border-emerald-500 hover:bg-emerald-50'}`}
            >
              {togglingTaskId === task.id && <div className="animate-spin h-3 w-3 border border-gray-400 rounded-full border-t-transparent" />}
            </button>
            <a href={task.url} target="_blank" rel="noopener" className="text-sm text-gray-700 hover:text-purple-600 flex-1 min-w-0 truncate">{task.name}</a>
            {showProject && task.projectName && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${typeColors.badge} truncate max-w-[120px]`}>{task.projectName}</span>
            )}
            {task.dossierName && (
              <a href={task.dossierUrl} target="_blank" rel="noopener" className="text-xs px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 hover:bg-cyan-200 truncate max-w-[100px]" title={task.dossierName}>
                📁 {task.dossierName}
              </a>
            )}
            {priorityBadge && <span className={`text-xs px-1.5 py-0.5 rounded ${priorityBadge.color}`}>{priorityBadge.text}</span>}
            {task.date && <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(task.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>}
            {projectId && (
              <button
                onClick={() => { setCommentingTaskId(isCommenting ? null : task.id); setCommentText(''); }}
                className={`p-1 rounded transition-colors ${isCommenting ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50 opacity-0 group-hover:opacity-100'}`}
                title="Ajouter un commentaire"
              >
                <Icon name="message" className="w-4 h-4" />
              </button>
            )}
          </div>
          {isCommenting && projectId && (
            <div className="flex gap-2 ml-7">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addComment(task, projectId)}
                placeholder="Ajouter un commentaire..."
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              <button
                onClick={() => addComment(task, projectId)}
                disabled={!commentText.trim() || sendingComment}
                className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {sendingComment ? '...' : 'OK'}
              </button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Tableau de Bord</h2>
            <p className="text-gray-500 text-sm">{totalTasks} tâches ouvertes{responsableFilter ? ` pour ${responsableFilter}` : ''}</p>
          </div>
          <button onClick={loadTasks} disabled={loadingTasks} className="flex items-center gap-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 rounded-lg text-sm text-purple-700 transition-colors">
            {loadingTasks ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" /> : <Icon name="refresh" className="w-4 h-4" />}
            Actualiser
          </button>
        </div>

        {/* WhatsApp alert */}
        {!connected && !connecting && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><Icon name="wifi" className="w-4 h-4 text-amber-500" /><span className="text-amber-800 text-sm">WhatsApp déconnecté</span></div>
            <button onClick={() => setView('settings')} className="px-3 py-1 bg-emerald-500 text-white rounded text-xs hover:bg-emerald-600">Connecter</button>
          </div>
        )}

        {/* Responsable filter */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setResponsableFilter(null)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!responsableFilter ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Toutes
          </button>
          <button onClick={() => setResponsableFilter('Jeremy')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${responsableFilter === 'Jeremy' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
            Jeremy
          </button>
          <button onClick={() => setResponsableFilter('Perrine')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${responsableFilter === 'Perrine' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}>
            Perrine
          </button>
        </div>

        {/* View tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setDashboardView('projet')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${dashboardView === 'projet' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-2">
              <Icon name="folder" className="w-4 h-4" />
              Par projet
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">{taskProjects.length}</span>
            </span>
          </button>
          <button
            onClick={() => setDashboardView('orphan')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${dashboardView === 'orphan' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-2">
              <Icon name="alert" className="w-4 h-4" />
              Sans projet
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">{orphanTasks.length}</span>
            </span>
          </button>
          <button
            onClick={() => setDashboardView('date')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${dashboardView === 'date' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-2">
              <Icon name="clock" className="w-4 h-4" />
              Par date
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">{totalTasks}</span>
            </span>
          </button>
        </div>

        {/* Content based on view */}
        {loadingTasks && !tasksLoaded ? (
          <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto" /></div>
        ) : (
          <>
            {/* VIEW: Par projet */}
            {dashboardView === 'projet' && (
              <div className="space-y-3">
                {taskProjects.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">Aucun projet avec des tâches</div>
                ) : (
                  taskProjects.map(project => {
                    const colors = getTypeColors(project.type);
                    return (
                      <div key={project.id} className={`${colors.bg} rounded-xl border-l-4 ${colors.border} overflow-hidden`}>
                        <div className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a href={project.url} target="_blank" rel="noopener" className="font-semibold text-gray-900 hover:text-purple-600">{project.name}</a>
                              {project.type && <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{project.type}</span>}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{project.tasks.length} tâche{project.tasks.length !== 1 ? 's' : ''}</div>
                          </div>
                          <a href={project.url} target="_blank" rel="noopener" className="p-1.5 hover:bg-white/50 rounded" title="Ouvrir dans Notion">
                            <Icon name="external" className="w-4 h-4 text-gray-400" />
                          </a>
                        </div>
                        <div className="px-4 pb-3 space-y-2">
                          {project.tasks.map(task => (
                            <TaskRow key={task.id} task={task} projectId={project.id} />
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* VIEW: Sans projet */}
            {dashboardView === 'orphan' && (
              <div className="space-y-3">
                {orphanTasks.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">Aucune tâche sans projet</div>
                ) : (
                  <div className="bg-orange-50 rounded-xl border-l-4 border-l-orange-400 overflow-hidden">
                    <div className="px-4 py-3">
                      <div className="font-semibold text-gray-700">Tâches sans projet</div>
                      <div className="text-xs text-gray-400">{orphanTasks.length} tâche{orphanTasks.length !== 1 ? 's' : ''} à organiser</div>
                    </div>
                    <div className="px-4 pb-3 space-y-2">
                      {orphanTasks.map(task => (
                        <TaskRow key={task.id} task={task} projectId={null} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW: Par date */}
            {dashboardView === 'date' && (
              <div className="space-y-3">
                {allTasksList.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">Aucune tâche</div>
                ) : (
                  groupByDate(allTasksList).map(group => (
                    <div key={group.label} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-gray-700">{group.label}</div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{group.tasks.length}</span>
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {group.tasks.map(task => (
                          <TaskRow key={task.id} task={task} projectId={task.projectId} showProject={true} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ==================== PIPELINE (Projects) ====================
  const PIPELINE_COLS = [
    { type: 'Lead', icon: '⚡', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', activeBg: 'bg-purple-100', ring: 'ring-purple-400' },
    { type: 'Gestion', icon: '🛠', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', activeBg: 'bg-blue-100', ring: 'ring-blue-400' },
    { type: 'Sinistre', icon: '💥', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', activeBg: 'bg-red-100', ring: 'ring-red-400' },
  ];
  const Kanban = () => {
    const priorityDot = (p) => p?.includes('Urg') ? '🔴' : p === 'Important' ? '🟠' : null;
    // Exclure les projets terminés (niveau = Terminé, Done, Fait, Clos)
    const activeProjects = pipelineProjects.filter(p =>
      !['Terminé', 'Done', 'Fait', 'Clos', 'Clôturé'].includes(p.niveau)
    );
    const filteredProjects = (pipelineFilter
      ? activeProjects.filter(p => p.type === pipelineFilter)
      : activeProjects
    ).sort((a, b) => {
      const priorityOrder = { 'Urg & Imp': 4, 'Urgent': 3, 'Important': 2 };
      const getNextDeadline = (project) => {
        const pending = project.tasks.filter(t => !['Terminé','Done','Fait'].includes(t.status) && t.date);
        if (pending.length === 0) return Infinity;
        return Math.min(...pending.map(t => new Date(t.date).getTime()));
      };
      switch (pipelineSortBy) {
        case 'priority':
          return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        case 'tasks':
          const aTasks = a.tasks.filter(t => !['Terminé','Done','Fait'].includes(t.status)).length;
          const bTasks = b.tasks.filter(t => !['Terminé','Done','Fait'].includes(t.status)).length;
          return bTasks - aTasks;
        case 'deadline':
          return getNextDeadline(a) - getNextDeadline(b);
        case 'date':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'name':
          return a.name.localeCompare(b.name, 'fr');
        default:
          return 0;
      }
    });

    // Eisenhower priority tasks for sidebar (limit 15)
    const priorityTasks = allTasks
      .filter(t => !t.completed)
      .sort((a, b) => {
        // 1. Urg & Imp + overdue/today first
        const aScore = (a.priority === 'Urg & Imp' ? 100 : 0) + (a.dateStatus === 'overdue' || a.dateStatus === 'today' ? 50 : 0)
          + (a.priority === 'Important' ? 30 : 0) + (a.dateStatus === 'overdue' ? 20 : 0);
        const bScore = (b.priority === 'Urg & Imp' ? 100 : 0) + (b.dateStatus === 'overdue' || b.dateStatus === 'today' ? 50 : 0)
          + (b.priority === 'Important' ? 30 : 0) + (b.dateStatus === 'overdue' ? 20 : 0);
        return bScore - aScore;
      })
      .slice(0, 15);

    return (
    <div className="flex gap-6">
      {/* Pipeline main area (70%) */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="text-2xl font-bold text-gray-900">Pipeline</h2><p className="text-gray-500 text-sm mt-1">Projets actifs par type</p></div>
          <div className="flex items-center gap-2">
            <select
              value={pipelineSortBy}
              onChange={(e) => setPipelineSortBy(e.target.value)}
              className="px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 cursor-pointer hover:border-gray-300"
            >
              <option value="priority">Priorité</option>
              <option value="tasks">Tâches en cours</option>
              <option value="deadline">Échéance proche</option>
              <option value="date">Date création</option>
              <option value="name">Nom A-Z</option>
            </select>
            <button onClick={loadPipelineProjects} disabled={loadingPipeline} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors disabled:opacity-50">{loadingPipeline ? '...' : '🔄 Actualiser'}</button>
          </div>
        </div>

        {/* KPI Filter Cards */}
        <div className="grid grid-cols-3 gap-3">
          {PIPELINE_COLS.map(col => {
            const count = activeProjects.filter(p => p.type === col.type).length;
            const isActive = pipelineFilter === col.type;
            return (
              <button
                key={col.type}
                onClick={() => setPipelineFilter(isActive ? null : col.type)}
                className={`rounded-xl border-2 p-4 transition-all ${isActive ? `${col.activeBg} ${col.border} ring-2 ${col.ring} shadow-md` : `bg-white ${col.border} hover:shadow-sm`}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{col.icon}</span>
                  <div className="text-left">
                    <p className={`text-2xl font-bold ${col.text}`}>{count}</p>
                    <p className="text-xs text-gray-500 font-medium">{col.type}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {loadingPipeline && pipelineProjects.length === 0 ? (
          <div className="space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Aucun projet {pipelineFilter ? `de type ${pipelineFilter}` : ''}</div>
        ) : (
          <div className="space-y-2">
            {filteredProjects.map(p => {
              const col = PIPELINE_COLS.find(c => c.type === p.type) || PIPELINE_COLS[0];
              const linkedConv = p.dossierId ? conversations.find(c => c.notion_dossier_id === p.dossierId) : null;
              const pendingTasks = p.tasks.filter(t => !['Terminé','Done','Fait'].includes(t.status));
              const completedTasks = p.tasks.filter(t => ['Terminé','Done','Fait'].includes(t.status));
              return (
                <div
                  key={p.id}
                  onClick={() => linkedConv && openConversation(linkedConv)}
                  className={`bg-white rounded-xl border border-gray-200 p-4 group hover:shadow-md transition-shadow ${linkedConv ? 'cursor-pointer hover:border-emerald-300' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${col.bg} ${col.text}`}>{col.icon} {p.type}</span>
                        {priorityDot(p.priority) && <span className="text-xs">{priorityDot(p.priority)}</span>}
                        {p.niveau && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">{p.niveau}</span>}
                        {pendingTasks.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                            📋 {pendingTasks.length} tâche{pendingTasks.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-sm text-gray-900 mt-1.5 truncate">{p.name}</p>
                      {p.dossierName && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate flex items-center gap-1">
                          📁 {p.dossierName}
                          {linkedConv && <span className="text-emerald-500">💬</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href={p.url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" title="Ouvrir dans Notion"><svg className="w-4 h-4" viewBox="0 0 100 100" fill="currentColor"><path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z"/><path fill="#fff" d="M61.35 36.293L31.523 38.18c-2.72.097-3.303.78-3.303 2.527v36.82c0 1.747.778 3.017 2.527 2.917l28.86-1.65c2.14-.097 2.917-1.167 2.917-2.72V38.82c0-1.553-.97-2.623-2.917-2.527h-.257zm-1.553 4.08v31.377l-23.61 1.36V42.233l23.61-1.86z"/></svg></a>
                    </div>
                  </div>
                  {p.tasks.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${(completedTasks.length / p.tasks.length) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500 flex-shrink-0">{completedTasks.length}/{p.tasks.length}</span>
                    </div>
                  )}
                  {pendingTasks.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {pendingTasks.slice(0, 3).map(t => {
                        const isOverdue = t.date && new Date(t.date) < new Date();
                        const isToday = t.date && new Date(t.date).toDateString() === new Date().toDateString();
                        return (
                          <div key={t.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 ${isOverdue ? 'border-red-400 bg-red-50' : 'border-orange-300 bg-orange-50'}`}>
                            </span>
                            <span className="truncate flex-1">{t.name}</span>
                            {t.date && (
                              <span className={`text-[10px] flex-shrink-0 ${isOverdue ? 'text-red-600 font-semibold' : isToday ? 'text-orange-600' : 'text-gray-400'}`}>
                                {isOverdue && '⚠️'}{new Date(t.date).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {pendingTasks.length > 3 && <p className="text-[10px] text-gray-400 ml-5">+{pendingTasks.length - 3} autres</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tasks sidebar (30%) */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 sticky top-4">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Tâches Prioritaires
            </h3>
            <button onClick={loadAllTasks} disabled={loadingAllTasks} className="text-xs text-gray-400 hover:text-gray-600">
              {loadingAllTasks ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" /> : '↻'}
            </button>
          </div>
          {loadingAllTasks && allTasks.length === 0 ? (
            <div className="p-4 space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-50 rounded" />)}</div>
          ) : priorityTasks.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-400">Aucune tâche en cours</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[calc(100vh-200px)] overflow-y-auto">
              {priorityTasks.map(t => (
                <div key={t.id} className="px-3 py-2.5 hover:bg-gray-50 group/task">
                  <div className="flex items-start gap-2">
                    <span className="text-xs flex-shrink-0 mt-0.5">
                      {t.priority === 'Urg & Imp' ? '🔴' : t.priority === 'Important' ? '🟡' : t.priority === 'Urgent' ? '🟠' : '⚪'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 truncate">{t.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {t.dossier?.name && <span className="text-[10px] text-gray-400 truncate max-w-[100px]">📁 {t.dossier.name}</span>}
                        {t.date && (
                          <span className={`text-[10px] flex-shrink-0 ${t.dateStatus === 'overdue' ? 'text-red-600 font-semibold' : t.dateStatus === 'today' ? 'text-orange-600 font-semibold' : 'text-gray-400'}`}>
                            {t.dateStatus === 'overdue' && '⚠️ '}{new Date(t.date).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}
                          </span>
                        )}
                      </div>
                    </div>
                    {t.contact?.jid && (
                      <button
                        onClick={() => { const conv = conversations.find(c => c.jid === t.contact.jid); if (conv) openConversation(conv); }}
                        className="flex-shrink-0 p-1 rounded hover:bg-emerald-50 text-emerald-500 opacity-0 group-hover/task:opacity-100 transition-opacity"
                        title={`Ouvrir ${t.contact.name}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );};

  // ==================== CONVERSATIONS LIST ====================
  const ConversationsList = () => {
    const activeConvs = conversations.filter(c => c.status !== 'hsva');
    const archivedConvs = conversations.filter(c => c.status === 'hsva');
    const baseConvs = showArchived ? archivedConvs : activeConvs;
    const statusCounts = {
      client: conversations.filter(c => c.status === 'client').length,
      assurance: conversations.filter(c => c.status === 'assurance').length,
      prospect: conversations.filter(c => c.status === 'prospect').length,
      apporteur: conversations.filter(c => c.status === 'apporteur').length,
      inbox: conversations.filter(c => c.status === 'inbox').length,
    };
    const getFiltered = () => {
      let base = baseConvs;
      if (!showArchived && activeLabel !== 'tous') base = baseConvs.filter(c => c.status === activeLabel);
      return base.filter(c => getName(c).toLowerCase().includes(searchQuery.toLowerCase()) || (c.last_message||'').toLowerCase().includes(searchQuery.toLowerCase()));
    };
    const filtered = getFiltered();
    const tabs = showArchived ? [] : [{ id:'tous', label:'Tous', count:activeConvs.length, activeBg:'bg-gray-900 text-white' }, { id:'inbox', label:'À classer', count:statusCounts.inbox, activeBg:'bg-slate-600 text-white' }, { id:'client', label:'Client', count:statusCounts.client, activeBg:'bg-emerald-600 text-white' }, { id:'assurance', label:'Assurance', count:statusCounts.assurance, activeBg:'bg-blue-600 text-white' }, { id:'prospect', label:'Prospect', count:statusCounts.prospect, activeBg:'bg-purple-600 text-white' }, { id:'apporteur', label:'Apporteur', count:statusCounts.apporteur, activeBg:'bg-amber-600 text-white' }];
    return (<div className="space-y-4">
      <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold text-gray-900">{showArchived ? 'Archives (HSVA)' : 'Conversations'}</h2><p className="text-gray-500 text-sm mt-1">{showArchived ? `${archivedConvs.length} conversations archivées` : 'Filtrées par statut'}</p></div></div>
      {!showArchived && <div className="flex gap-2 flex-wrap">{tabs.map(tab => (<button key={tab.id} onClick={() => setActiveLabel(tab.id)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeLabel === tab.id ? tab.activeBg : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{tab.label} <span className={`ml-1 ${activeLabel===tab.id?'opacity-80':'opacity-60'}`}>({tab.count})</span></button>))}</div>}
      {!showArchived && <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg"><span className="text-xs text-gray-500 px-2 flex-shrink-0">Période :</span>{TIME_FILTERS.map(tf => (<button key={tf.id||'all'} onClick={() => setActiveTimePeriod(tf.id)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTimePeriod === tf.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{tf.label}</button>))}</div>}
      <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Rechercher..." defaultValue={searchQuery || ''} onChange={(e) => {
                const val = e.target.value;
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                searchTimeoutRef.current = setTimeout(() => {
                  setSearchQuery(val);
                }, 300);
              }} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">{filtered.map(c => <ConversationRow key={c.jid} conv={c} onClick={() => openConversation(c)} />)}{filtered.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">{conversations.length===0?(connected?'Aucune conv avec cette étiquette':'Connecte WhatsApp'):'Aucun résultat'}</div>}</div>
      <button onClick={() => { setShowArchived(!showArchived); setActiveLabel('tous'); }} className={`w-full py-2.5 text-sm font-medium rounded-xl border transition-colors ${showArchived ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{showArchived ? '← Retour aux actifs' : `Voir archives HSVA (${archivedConvs.length})`}</button>
    </div>); };

  // ==================== CONVERSATIONS V2 (new layout) ====================
  // States are lifted to parent level to prevent reset on re-render

  // Filter conversations for V2
  const v2Conversations = useMemo(() => {
    let result = v2ShowArchived
      ? conversations.filter(c => c.status === 'hsva')
      : conversations.filter(c => c.status !== 'hsva');

    // Auto-hide LID duplicates: if a @lid conversation has a linked_jid pointing to a @s.whatsapp.net, hide the LID
    // Also hide conversations whose linked_jid exists (they're duplicates)
    const linkedJids = new Set(result.filter(c => c.linked_jid).map(c => c.jid));
    // Auto-detect: hide @lid convs when a @s.whatsapp.net conv shares the same notion_dossier_id
    const dossierToClassicJid = {};
    for (const c of result) {
      if (c.notion_dossier_id && c.jid.includes('@s.whatsapp.net')) {
        dossierToClassicJid[c.notion_dossier_id] = c.jid;
      }
    }
    result = result.filter(c => {
      // Hide if explicitly linked as duplicate
      if (c.linked_jid) return false;
      // Hide @lid if a classic jid shares the same dossier
      if (c.jid.includes('@lid') && c.notion_dossier_id && dossierToClassicJid[c.notion_dossier_id]) return false;
      return true;
    });

    return result;
  }, [conversations, v2ShowArchived]);

  // Load messages when conversation selected (V2) — merges LID/classic messages
  const handleV2SelectConversation = useCallback(async (conv) => {
    if (!conv) {
      setV2SelectedConv(null);
      setV2Messages([]);
      return;
    }
    setV2SelectedConv(conv);
    setV2IsLoadingMessages(true);
    if (conv.notion_dossier_id) loadDossierDetails(conv.notion_dossier_id);
    else setDossierDetails(null);
    try {
      // Find all jids to load (linked + same dossier LIDs)
      const jidsToLoad = [conv.jid];
      if (conv.linked_jid) jidsToLoad.push(conv.linked_jid);
      // Find LID or classic counterpart with same dossier
      if (conv.notion_dossier_id) {
        const linkedConvs = conversations.filter(c =>
          c.notion_dossier_id === conv.notion_dossier_id && c.jid !== conv.jid && !jidsToLoad.includes(c.jid)
        );
        linkedConvs.forEach(c => jidsToLoad.push(c.jid));
      }

      // Load and merge messages from all jids
      const allMessages = [];
      for (const jid of jidsToLoad) {
        const res = await fetch(`/api/whatsapp/messages/${encodeURIComponent(jid)}`);
        const data = await res.json();
        allMessages.push(...(data.messages || []));
      }
      // Dedupe by message id and sort chronologically
      const seen = new Set();
      const deduped = allMessages.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      deduped.sort((a, b) => a.timestamp - b.timestamp);
      setV2Messages(deduped);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
    setV2IsLoadingMessages(false);
  }, [conversations]);

  // Send message (V2) — prefer @s.whatsapp.net over @lid for sending
  const handleV2SendMessage = useCallback(async (jid, text) => {
    if (!text.trim() || v2IsSending) return;
    setV2IsSending(true);

    // Prefer classic jid (@s.whatsapp.net) for sending, not LID
    let sendJid = jid;
    if (sendJid.includes('@lid')) {
      const conv = conversations.find(c => c.jid === sendJid);
      if (conv) {
        // Check linked_jid
        if (conv.linked_jid && conv.linked_jid.includes('@s.whatsapp.net')) {
          sendJid = conv.linked_jid;
        } else if (conv.notion_dossier_id) {
          // Find classic jid with same dossier
          const classicConv = conversations.find(c =>
            c.jid.includes('@s.whatsapp.net') && c.notion_dossier_id === conv.notion_dossier_id
          );
          if (classicConv) sendJid = classicConv.jid;
        }
      }
    }

    const optId = `opt_${Date.now()}`;
    const optMsg = { id: optId, text, from_me: true, timestamp: Date.now() };
    setV2Messages(prev => [...prev, optMsg]);
    try {
      await api('send', 'POST', { jid: sendJid, text });
      loadConversations();
    } catch (err) {
      setV2Messages(prev => prev.filter(m => m.id !== optId));
      console.error('Send error:', err);
    }
    setV2IsSending(false);
  }, [v2IsSending, loadConversations, conversations]);

  // Update status (V2) — accepte 1 ou 2 args (ChatHeader passe 1 seul)
  const handleV2UpdateStatus = useCallback(async (statusOrJid, maybeStatus) => {
    try {
      let jid, status;
      if (maybeStatus === undefined) {
        jid = v2SelectedConvRef.current?.jid;
        status = statusOrJid;
      } else {
        jid = statusOrJid;
        status = maybeStatus;
      }
      if (!jid || !status) return;
      await api('update-status', 'POST', { jid, status });
      setV2SelectedConv(prev => prev?.jid === jid ? { ...prev, status } : prev);
      loadConversations();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  }, [loadConversations]);

  // Link/unlink conversations (dedup)
  const handleLinkConversation = useCallback(async (sourceJid, targetJid) => {
    await api('link-conversation', 'POST', { sourceJid, targetJid });
    loadConversations();
  }, [loadConversations]);

  const handleUnlinkConversation = useCallback(async (sourceJid) => {
    await api('link-conversation', 'POST', { sourceJid, action: 'unlink' });
    loadConversations();
  }, [loadConversations]);

  const ConversationsV2 = () => (
    <div className="h-full">
      <ConversationLayout
        conversations={v2Conversations}
        selectedConversation={v2SelectedConv}
        selectedMessages={v2Messages}
        dossierDetails={dossierDetails}
        isLoadingConversations={conversations.length === 0 && !connected}
        isLoadingMessages={v2IsLoadingMessages}
        isConnected={connected}
        onSelectConversation={handleV2SelectConversation}
        onSendMessage={handleV2SendMessage}
        searchQuery={v2SearchQuery}
        onSearchChange={setV2SearchQuery}
        activeFilter={v2ActiveFilter}
        onFilterChange={setV2ActiveFilter}
        isSending={v2IsSending}
        onUpdateStatus={handleV2UpdateStatus}
        onLinkConversation={handleLinkConversation}
        onUnlinkConversation={handleUnlinkConversation}
        onAddTask={() => setShowV2TaskModal(true)}
        onAddProject={() => window.dispatchEvent(new Event('open-project-modal'))}
        onLinkProject={() => window.dispatchEvent(new Event('open-link-project-modal'))}
      />
      {showV2TaskModal && (
        <TaskFormModal
          isOpen={showV2TaskModal}
          onClose={() => setShowV2TaskModal(false)}
          onSuccess={() => { setShowV2TaskModal(false); }}
          defaultDossierId={v2SelectedConv?.notion_dossier_id}
          defaultDossierName={v2SelectedConv?.notion_dossier_name}
        />
      )}
    </div>
  );

  // ==================== DETAIL (2-column layout) ====================
  const Detail = () => {
    // Message input state - INSIDE Detail to prevent parent re-render on typing
    const [messageText, setMessageText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isImproving, setIsImproving] = useState(false);
    const [detailTab, setDetailTab] = useState('messages'); // 'messages' or 'documents'
    const localInputRef = useRef(null);
    const [currentUser, setCurrentUser] = useState('');

    // Get current user from cookie for signature
    useEffect(() => {
      const cookies = document.cookie.split(';');
      const userCookie = cookies.find(c => c.trim().startsWith('smartvalue_user='));
      if (userCookie) {
        setCurrentUser(decodeURIComponent(userCookie.split('=')[1]));
      }
    }, []);

    // AI Text Improvement function
    const improveText = async () => {
      if (!messageText.trim() || isImproving) return;
      setIsImproving(true);
      try {
        const res = await fetch('/api/ai/improve-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: messageText, context: 'message WhatsApp professionnel mais cordial' })
        });
        const data = await res.json();
        if (data.improved) {
          setMessageText(data.improved);
        }
      } catch (err) {
        console.error('Error improving text:', err);
      }
      setIsImproving(false);
      localInputRef.current?.focus();
    };

    // Get all downloadable media from messages (photos, videos, audios, documents)
    const conversationDocs = selectedMessages.filter(msg => msg.media_url);

    const sendMsg = async () => {
      let text = messageText.trim();
      if (!text || !selectedJid || isSending) return;

      // Add signature for Perrine
      if (currentUser === 'Perrine') {
        text = text + '\n\n_Perrine Lhotel - Smart Value Assurances_';
      }

      setIsSending(true);
      const optId = `opt_${Date.now()}`;
      const opt = { id: optId, text, from_me: true, timestamp: Date.now(), is_document: false };
      setSelectedMessages(prev => [...prev, opt]);
      setMessageText('');
      try {
        await api('send', 'POST', { jid: selectedJid, text });
        loadConversations();
      } catch (err) {
        setSelectedMessages(prev => prev.filter(m => m.id !== optId));
        setMessageText(messageText); // Keep original without signature
        console.error('Send error:', err);
      }
      setIsSending(false);
      localInputRef.current?.focus();
    };

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
          <button onClick={() => { setView('conversations'); setSelectedJid(null); window.history.pushState({}, '', '/'); }} className="p-2 hover:bg-gray-100 rounded-lg"><Icon name="back" className="w-5 h-5 text-gray-600" /></button>
          <div className={`w-10 h-10 rounded-full ${c.avatar_color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>{getInitialsFor(c)}</div>
          <div className="flex-1 min-w-0 ml-1">
            {/* LIGNE PRINCIPALE : NOM | DOSSIER */}
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
              {/* 1. NOM DU CONTACT */}
              <h2 className="text-xl font-bold text-gray-900 truncate flex items-center gap-1.5">
                {getName(c)}
                <button onClick={() => { setEditNameValue(c.custom_name || c.whatsapp_name || getName(c)); setShowNameSourceModal(true); }} className="p-1 hover:bg-gray-100 rounded">
                  <Icon name="edit" className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
                {c.name_source && c.name_source !== 'whatsapp' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${c.name_source === 'contact' ? 'bg-emerald-100 text-emerald-700' : c.name_source === 'dossier' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {c.name_source === 'contact' ? '📇' : c.name_source === 'dossier' ? '📁' : '✏️'}
                  </span>
                )}
                {c.notion_contact_id ? (
                  <a href={c.notion_contact_url} target="_blank" rel="noopener" className="p-1 hover:bg-emerald-50 rounded text-emerald-500" title="Contact Notion lié">✅</a>
                ) : (<>
                  <button onClick={() => { setLinkSearchQuery(getName(c)); setShowLinkContactModal(true); searchNotionContacts(getName(c)); }} className="p-1 hover:bg-indigo-50 rounded text-indigo-400 hover:text-indigo-600 text-sm" title="Lier un contact Notion existant">🔗</button>
                  <button onClick={() => { setCreateContactForm({ name: getName(c), phone: c.phone || '', email: c.email || '' }); setShowCreateContactModal(true); }} className="p-1 hover:bg-blue-50 rounded text-blue-400 hover:text-blue-600 text-sm" title="Créer un contact Notion">👤+</button>
                </>)}
              </h2>

              {/* SEPARATEUR VISUEL */}
              <span className="text-gray-300 text-2xl font-light">/</span>

              {/* 2. DOSSIER (Même importance visuelle) */}
              <div className="relative group flex items-center">
                {c.notion_dossier_id ? (
                  <>
                    <a
                      href={dossierDetails?.dossier?.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xl font-bold text-indigo-900 hover:text-indigo-700 hover:underline decoration-2 underline-offset-4 transition-all"
                      title="Ouvrir le dossier dans Notion"
                    >
                      📁 {c.notion_dossier_name || 'Sans nom'}
                    </a>
                    <button
                      onClick={() => setIsLinkingDossier(true)}
                      className="ml-2 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                      title="Modifier le dossier rattaché"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsLinkingDossier(true)}
                    className="flex items-center gap-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-full shadow-sm transition-colors animate-pulse"
                  >
                    ➕ Lier un dossier
                  </button>
                )}

                {/* POPUP RECHERCHE */}
                {isLinkingDossier && (
                  <div className="absolute top-10 left-0 z-50 w-80 bg-white shadow-2xl rounded-xl border border-gray-200 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-bold text-gray-800">Rattacher à un dossier</h4>
                      <button onClick={() => { setIsLinkingDossier(false); setDossierSearch(''); setDossierResults([]); }} className="text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full p-1">✕</button>
                    </div>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Rechercher (ex: Elbaz)..."
                      className="w-full text-sm p-2.5 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      value={dossierSearch}
                      onChange={(e) => searchDossiersForLink(e.target.value)}
                    />
                    <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1">
                      {dossierResults.map(d => (
                        <button
                          key={d.id}
                          onClick={() => linkContactToDossier(d.id, d.name, d.url)}
                          className="text-left text-sm p-2.5 hover:bg-indigo-50 rounded-lg text-gray-700 flex items-center gap-3 transition-colors group/item"
                        >
                          <span className="text-xl">📁</span>
                          <span className="font-semibold group-hover/item:text-indigo-700">{d.name}</span>
                        </button>
                      ))}
                      {dossierResults.length === 0 && dossierSearch.length > 2 && (
                        <div className="text-sm text-gray-500 p-4 text-center italic bg-gray-50 rounded-lg">Aucun dossier trouvé</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* LIGNE SECONDAIRE : INFOS TECHNIQUES */}
            <div className="flex items-center gap-3 mt-1 pl-0.5">
              {editingPhone ? (
                <div className="flex items-center gap-1">
                  <input type="tel" value={editPhoneValue} onChange={e => setEditPhoneValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') updatePhone(c.jid, editPhoneValue); if (e.key === 'Escape') setEditingPhone(false); }} className="text-xs px-1.5 py-0.5 rounded border border-gray-300 bg-white w-36 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="+33 6 12 34 56 78" autoFocus />
                  <button onClick={() => updatePhone(c.jid, editPhoneValue)} className="text-emerald-600 text-xs">✓</button>
                  <button onClick={() => setEditingPhone(false)} className="text-gray-400 text-xs">✕</button>
                </div>
              ) : (
                <p className="text-sm font-mono text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-1" onClick={() => { setEditPhoneValue(c.phone || ''); setEditingPhone(true); }}>
                  <span className="hover:underline">{c.phone || 'Ajouter téléphone'}</span>
                </p>
              )}
              {!c.notion_contact_id && !c.notion_dossier_id && (
                <span className="text-xs text-red-500">🔴 Non lié</span>
              )}
              {c.notion_contact_id && (
                <span className="text-xs text-emerald-600">🟢 Contact : {c.notion_contact_name || 'Lié'}</span>
              )}
              {c.notion_dossier_id && (
                <span className="text-xs text-emerald-600">🟢 Dossier : {c.notion_dossier_name || 'Lié'}</span>
              )}
              {/* Sibling navigation */}
              {dossierDetails?.siblings?.filter(sib => sib.id !== c.notion_contact_id).length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {dossierDetails.siblings.filter(sib => sib.id !== c.notion_contact_id).map(sib => (
                    <button key={sib.id} onClick={() => { if (sib.jid) { openConversation({ jid: sib.jid }); } else { window.open(sib.url, '_blank'); } }} className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all text-[10px] ${sib.has_whatsapp ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 font-medium' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                      {sib.has_whatsapp ? '💬' : '🔗'} {sib.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Star button */}
          <button onClick={() => toggleStar(c.jid, c.starred)} className={`p-2 rounded-lg transition-colors ${c.starred ? 'bg-amber-100 text-amber-500' : 'hover:bg-gray-100 text-gray-400'}`} title={c.starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            <svg className="w-5 h-5" fill={c.starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
          </button>
          {/* Reminder button */}
          <button onClick={() => { setReminderDate(c.reminder_at ? new Date(c.reminder_at).toISOString().split('T')[0] : ''); setReminderTime(c.reminder_at ? new Date(c.reminder_at).toTimeString().slice(0,5) : '09:00'); setReminderNote(c.reminder_note || ''); setShowReminderModal(true); }} className={`p-2 rounded-lg transition-colors relative ${c.reminder_at ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-400'}`} title={c.reminder_at ? `Rappel: ${new Date(c.reminder_at).toLocaleString('fr-FR')}` : 'Ajouter un rappel'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            {c.reminder_at && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />}
          </button>
          <select value={c.status} onChange={e => updateStatus(c.jid, e.target.value)} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${STATUSES[c.status]?.color||''}`}>{Object.entries(STATUSES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-2 flex-wrap pb-4">
          <span className="text-xs text-gray-500">Tags :</span>
          {CATEGORIES.map(tag => {
            const projects = c.tag_projects?.[tag] || [];
            const isActive = projects.length > 0;
            const colors = TAG_COLORS[tag];
            return (
              <div key={tag} className="flex items-center gap-0.5">
                <button onClick={() => {
                  if (!c.notion_dossier_id && !c.notion_contact_id) { alert('Créez d\'abord un contact (👤+)'); return; }
                  setTagProjectModal({ tag, jid: c.jid });
                }} className={`text-xs px-2 py-1 rounded-full border transition-colors ${isActive ? colors.full : 'bg-gray-50 text-gray-400 border-gray-200 border-dashed hover:bg-gray-100'}`}>
                  {isActive && '✓ '}{tag}{projects.length > 1 ? ` (${projects.length})` : ''}
                </button>
                {isActive && (
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    const newTagProjects = {...(c.tag_projects || {})};
                    delete newTagProjects[tag];
                    const newTags = (c.tags || []).filter(t => t !== tag);
                    await api('update-status', 'POST', { jid: c.jid, tag_projects: newTagProjects, tags: newTags });
                    loadConversations();
                    if (selectedJid === c.jid) loadMessages(c.jid);
                  }} className="text-xs text-gray-400 hover:text-red-500 px-0.5" title="Délier">✕</button>
                )}
              </div>
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
        </div>

        {/* Drive / Gemini / Réveil / Copier buttons */}
        <div className="flex items-center gap-2 pb-2 flex-wrap">
          {dossierDetails?.dossier?.driveUrl && (
            <a href={dossierDetails.dossier.driveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-gray-200">
              📁 Drive
            </a>
          )}
          {(dossierDetails?.dossier?.geminiUrl || dossierLinks.gemini) ? (
            <a href={dossierDetails?.dossier?.geminiUrl || dossierLinks.gemini} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-indigo-100 shadow-sm">
              ✨ Ouvrir Gemini
            </a>
          ) : c.notion_dossier_id ? (
            !isEditingGemini ? (
              <button onClick={initGeminiChat} className="flex items-center justify-center gap-1.5 bg-white border border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                ✨ Créer Chat IA
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  placeholder="Colle l'URL Gemini ici..."
                  className="text-[11px] px-2 py-1.5 border border-indigo-300 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newGeminiUrl}
                  onChange={e => setNewGeminiUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveGeminiLink(); if (e.key === 'Escape') { setIsEditingGemini(false); setNewGeminiUrl(''); } }}
                />
                <button onClick={saveGeminiLink} className="bg-indigo-600 text-white px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700">OK</button>
                <button onClick={() => { setIsEditingGemini(false); setNewGeminiUrl(''); }} className="text-gray-400 hover:text-gray-600 text-xs px-1">✕</button>
              </div>
            )
          ) : null}
          <button onClick={() => setShowWakeupModal(true)} className="flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-100 transition-colors">
            ⏰ Réveil
          </button>
          <button
            onClick={() => resyncConversation(c.jid)}
            disabled={isResyncing}
            className="flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100 transition-colors disabled:opacity-50"
            title="Resynchroniser les médias de cette conversation"
          >
            {isResyncing ? (
              <><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg> Resync...</>
            ) : (
              <>🔄 Resync</>
            )}
          </button>
          <button
            onClick={async () => {
              const text = selectedMessages.map(m => {
                const d = new Date(m.timestamp);
                const time = d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
                const date = d.toLocaleDateString('fr-FR');
                const sender = m.from_me ? 'Moi' : (m.sender_name || c.display_name || c.name);
                return `[${date} ${time}] ${sender}: ${m.text || '(média)'}`;
              }).join('\n');
              const header = `CONVERSATION: ${c.display_name || c.name}\nTél: ${c.phone}\n${'─'.repeat(40)}\n`;
              await navigator.clipboard.writeText(header + text);
              alert('Conversation copiée !');
            }}
            className="flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-purple-100 transition-colors"
            title="Copier la conversation pour Gemini"
          >
            📋 Copier
          </button>
        </div>
        {resyncResult && (
          <div className={`text-xs px-3 py-1.5 rounded-lg mb-2 ${resyncResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {resyncResult.message}
          </div>
        )}

        {/* 2-column layout */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* LEFT COLUMN: Messages (60%) */}
          <div className="w-[60%] flex flex-col min-h-0">
            {notionSuccess && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700 flex items-center gap-2 mb-2"><Icon name="check" className="w-4 h-4" /> {notionSuccess}</div>}
            {suggestedContact && !c.notion_contact_id && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2 mb-2">
                <span className="text-indigo-600">🔍 Contact suggéré : <strong>{suggestedContact.name}</strong>{suggestedContact.phone ? ` (${suggestedContact.phone})` : ''}</span>
                <button onClick={() => handleLinkNotionContact(suggestedContact)} className="ml-auto px-2 py-1 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-600 font-medium">Lier</button>
                <button onClick={() => setSuggestedContact(null)} className="text-indigo-300 hover:text-indigo-500 text-xs">✕</button>
              </div>
            )}
            {/* Tabs: Messages / Fichiers */}
            <div className="flex gap-1 mb-2 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setDetailTab('messages')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${detailTab === 'messages' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Messages
              </button>
              <button onClick={() => setDetailTab('documents')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${detailTab === 'documents' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Fichiers {conversationDocs.length > 0 && <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{conversationDocs.length}</span>}
              </button>
            </div>
            {/* Documents Tab */}
            {detailTab === 'documents' && (
              <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 overflow-y-auto">
                {conversationDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-sm">Aucun média dans cette conversation</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 mb-3">{conversationDocs.length} fichier{conversationDocs.length > 1 ? 's' : ''}</p>
                    {conversationDocs.map((doc, idx) => {
                      const filename = doc.text?.replace('📎 ', '') || 'Fichier';
                      const isImage = doc.media_mimetype?.startsWith('image/');
                      const isVideo = doc.media_mimetype?.startsWith('video/');
                      const isAudio = doc.media_mimetype?.startsWith('audio/');
                      const isPdf = doc.media_mimetype?.includes('pdf');
                      const date = new Date(doc.timestamp);
                      const typeLabel = isImage ? 'IMG' : isVideo ? 'VID' : isAudio ? 'MP3' : isPdf ? 'PDF' : 'DOC';
                      const typeColor = isImage ? '#10b981' : isVideo ? '#8b5cf6' : isAudio ? '#f59e0b' : isPdf ? '#ef4444' : '#3b82f6';
                      const typeBg = isImage ? 'bg-emerald-100' : isVideo ? 'bg-purple-100' : isAudio ? 'bg-amber-100' : isPdf ? 'bg-red-100' : 'bg-blue-100';
                      return (
                        <div key={doc.id || idx} className="flex items-center gap-3 p-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                          {isImage ? (
                            <img src={doc.media_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                          ) : isVideo ? (
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${typeBg} relative overflow-hidden`}>
                              <video src={doc.media_url} className="absolute inset-0 w-full h-full object-cover opacity-50" muted />
                              <span className="text-xs font-bold relative z-10" style={{color: typeColor}}>{typeLabel}</span>
                            </div>
                          ) : (
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${typeBg}`}>
                              <span className="text-xs font-bold" style={{color: typeColor}}>{typeLabel}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{isImage ? 'Photo' : isVideo ? 'Vidéo' : isAudio ? 'Audio' : filename}</p>
                            <p className="text-xs text-gray-400">{date.toLocaleDateString('fr-FR')} à {date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})} · {doc.from_me ? 'Envoyé' : 'Reçu'}</p>
                          </div>
                          <div className="flex gap-1">
                            {(isImage || isPdf) && (
                              <button onClick={() => isImage ? window.open(doc.media_url, '_blank') : setPreviewDoc({url: doc.media_url, filename, mimetype: doc.media_mimetype})} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors" title="Aperçu">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </button>
                            )}
                            <a href={doc.media_url} download={filename} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="Télécharger">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* Messages Tab */}
            {detailTab === 'messages' && <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 bg-[#e5ddd5] rounded-xl border border-gray-200 p-4 space-y-2 overflow-y-auto" style={{backgroundImage:'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAG1BMVEXd2tfd2tfd2tfd2tfd2tfd2tfd2tfd2tfd2tcEcYl5AAAACXRSTlMABAgMEBQYHCAk1OKnAAAAP0lEQVQ4y2NgGAWjYBSMgsENGP8TBIx/EQSMfxEE/+8iBhj/IggY/yIIGP8iBv4iBBj/IgQY/yIEGP8OUgAAAPsED0TzS7oAAAAASUVORK5CYII=")'}}>
              {selectedMessages.map((msg, idx) => {
                const prevMsg = idx > 0 ? selectedMessages[idx - 1] : null;
                const curDate = getDateSeparator(msg.timestamp);
                const prevDate = prevMsg ? getDateSeparator(prevMsg.timestamp) : null;
                const showSep = curDate !== prevDate;
                return (<div key={msg.id}>
                {showSep && <div className="flex items-center justify-center my-2"><span className="bg-white/80 text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm">{curDate}</span></div>}
                <div className={`flex ${msg.from_me?'justify-end':'justify-start'}`}>
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
                </div>);
              })}
              {selectedMessages.length===0 && <div className="text-center text-gray-400 text-sm py-4">Aucun message</div>}
              <div ref={messagesEndRef} />
              {/* Scroll to bottom button */}
              <button onClick={scrollToBottom} className="sticky bottom-2 left-[calc(100%-3rem)] w-10 h-10 bg-white/90 hover:bg-white shadow-lg rounded-full flex items-center justify-center text-gray-600 hover:text-emerald-600 transition-all border border-gray-200" title="Aller en bas">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </button>
            </div>}
            {/* Brain Result Toast */}
            {brainResult && (
              <div className={`p-3 rounded-xl text-sm ${brainResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {brainResult.message || brainResult.error || 'Action effectuée'}
              </div>
            )}
            {connected && (
              <div className="flex gap-2 mt-3">
                <input
                  ref={localInputRef}
                  type="text"
                  placeholder="Écrire un message..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                  disabled={isSending || isImproving}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                  autoComplete="off"
                />
                {/* AI Improve button */}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); improveText(); }}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={isImproving || !messageText.trim()}
                  className={`px-3 py-2.5 rounded-xl transition-all flex items-center gap-1 ${isImproving ? 'bg-amber-300 text-amber-700' : messageText.trim() ? 'bg-amber-100 hover:bg-amber-200 text-amber-700' : 'bg-gray-100 text-gray-400'}`}
                  title="Améliorer avec l'IA"
                >
                  {isImproving ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  ) : (
                    <>
                      <span>✨</span>
                      <span className="text-xs font-medium">IA</span>
                    </>
                  )}
                </button>
                <button
                  onClick={sendMsg}
                  disabled={isSending || !messageText.trim()}
                  className={`px-4 py-2.5 rounded-xl transition-all ${isSending ? 'bg-gray-400' : messageText.trim() ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-gray-300'} text-white`}
                >
                  {isSending ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  ) : (
                    <Icon name="send" className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={brainProcessing}
                  className={`px-4 py-2.5 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : brainProcessing ? 'bg-gray-300 text-gray-500' : 'bg-purple-500 text-white hover:bg-purple-600'}`}
                  title={isRecording ? 'Stop' : 'Commander (voix)'}
                >
                  {brainProcessing ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  ) : isRecording ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 2.76 2.24 5 5 5s5-2.24 5-5h2c0 4.08-3.06 7.44-7 7.93V19h4v2H8v-2h4v-3.07z"/></svg>
                  )}
                </button>
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
                  {/* Action Buttons */}
                  <div className="flex justify-between items-center mb-2">
                    <button
                      onClick={() => setActiveDossierChat({ id: c.notion_dossier_id, nom: c.notion_dossier_name || getName(c) })}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                      title="Chat Claude - Assistant IA"
                    >
                      <span>💬</span>
                      Chat Claude
                    </button>
                    <button
                      onClick={() => loadDossierDetails(c.notion_dossier_id, true)}
                      disabled={loadingDetails}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Actualiser les données Notion"
                    >
                      <svg className={`w-3.5 h-3.5 ${loadingDetails ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M3 21v-5h5" />
                      </svg>
                      {loadingDetails ? 'Actualisation...' : 'Actualiser'}
                    </button>
                  </div>
                  {/* Contracts Section */}
                  {dossierDetails.contracts?.length > 0 && (() => {
                    const contratsActifs = dossierDetails.contracts.filter(ct => !ct.desactive);
                    const contratsResilies = dossierDetails.contracts.filter(ct => ct.desactive);
                    return (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50 cursor-pointer hover:bg-gray-100 select-none" onClick={() => setIsContractsOpen(!isContractsOpen)}>
                        <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">📋 Contrats <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full">{contratsActifs.length}{contratsResilies.length > 0 ? `+${contratsResilies.length}` : ''}</span></h4>
                        <span className="text-gray-400 text-xs transition-transform duration-200" style={{ transform: isContractsOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
                      </div>
                      {isContractsOpen && (
                        <>
                          <div className="divide-y divide-gray-50">
                            {contratsActifs.map(ct => (
                              <div key={ct.id} className="flex items-start gap-0 border-l-4 border-l-blue-400">
                                <a href={ct.url} target="_blank" rel="noopener" className="flex-1 block p-3 hover:bg-gray-50 transition-colors min-w-0">
                                  <p className="font-bold text-sm text-gray-900 truncate">{ct.name}</p>
                                  <div className="flex flex-wrap gap-2 mt-1 mb-1">
                                    {ct.type_assurance && (
                                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-medium">
                                        {ct.type_assurance}
                                      </span>
                                    )}
                                    {ct.cie_details && (
                                      <span className="text-[10px] text-gray-500 flex items-center bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                        🆔 {ct.cie_details}
                                      </span>
                                    )}
                                  </div>
                                  {ct.details && <p className="text-xs text-gray-500 mt-0.5 italic truncate">{ct.details}</p>}
                                  {ct.dateEffet && (
                                    <p className="text-xs text-gray-400 mt-0.5">Depuis {new Date(ct.dateEffet).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                  )}
                                </a>
                                <button onClick={() => {
                                  setProjectForm({ name: `Sinistre ${ct.name} - ${ct.productType || ''}`.trim(), type: 'Sinistre', priority: 'À prioriser', niveau: '', contratId: ct.id });
                                  setShowCreateOpp(true);
                                }} className="p-2 mt-2 mr-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0" title="Déclarer un sinistre">🚨+</button>
                              </div>
                            ))}
                          </div>
                          {contratsResilies.length > 0 && (
                            <div className="border-t border-gray-100">
                              <button onClick={() => setShowResilies(!showResilies)} className="w-full px-3 py-2 text-left text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                                {showResilies ? '▼' : '▶'} Résiliés ({contratsResilies.length})
                              </button>
                              {showResilies && (
                                <div className="divide-y divide-gray-50">
                                  {contratsResilies.map(ct => (
                                    <a key={ct.id} href={ct.url} target="_blank" rel="noopener" className="block p-3 hover:bg-gray-50 transition-colors border-l-4 border-l-gray-300 opacity-50">
                                      <p className="font-bold text-sm text-gray-900 truncate">{ct.name}</p>
                                      <div className="flex flex-wrap gap-2 mt-1 mb-1">
                                        {ct.type_assurance && (
                                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-medium">
                                            {ct.type_assurance}
                                          </span>
                                        )}
                                        {ct.cie_details && (
                                          <span className="text-[10px] text-gray-500 flex items-center bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                            🆔 {ct.cie_details}
                                          </span>
                                        )}
                                      </div>
                                      {ct.details && <p className="text-xs text-gray-500 mt-0.5 italic truncate">{ct.details}</p>}
                                      {ct.dateResiliation && (
                                        <p className="text-xs text-red-400 mt-0.5">Résilié le {new Date(ct.dateResiliation).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                      )}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    );
                  })()}

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
                                    const isCompleted = t.completed || t.status === 'Terminé' || t.status === 'Done';
                                    return (
                                      <div key={t.id} className="py-1.5 px-2 hover:bg-gray-50 rounded transition-colors group">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isCompleted}
                                            disabled={togglingTaskId === t.id}
                                            onChange={(e) => { e.stopPropagation(); toggleTaskCompletion(t, e.target.checked); }}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                                          />
                                          <span className="text-xs">{t.priority?.includes('Urg') ? '🔴' : t.priority === 'Important' ? '🟠' : ''}</span>
                                          <a href={t.url} target="_blank" rel="noopener" className={`text-xs flex-1 truncate ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{t.name}</a>
                                          {t.date && !isCompleted && <span className={`text-xs ${dateStatus === 'overdue' ? 'text-red-600 font-medium' : dateStatus === 'today' ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>{new Date(t.date).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}</span>}
                                          {t.note && <span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block flex-shrink-0" title="Commentaires"></span>}
                                        </div>
                                      </div>
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
                          const isCompleted = t.completed || t.status === 'Terminé' || t.status === 'Done';
                          return (
                            <div key={t.id} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isCompleted}
                                  disabled={togglingTaskId === t.id}
                                  onChange={(e) => { e.stopPropagation(); toggleTaskCompletion(t, e.target.checked); }}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                                />
                                <span className="text-xs">{t.priority?.includes('Urg') ? '🔴' : t.priority === 'Important' ? '🟠' : ''}</span>
                                <a href={t.url} target="_blank" rel="noopener" className={`text-xs flex-1 truncate ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{t.name}</a>
                                {t.date && !isCompleted && <span className={`text-xs ${dateStatus === 'overdue' ? 'text-red-600 font-medium' : dateStatus === 'today' ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>{new Date(t.date).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}</span>}
                                {t.note && <span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block flex-shrink-0" title="Commentaires"></span>}
                              </div>
                            </div>
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
                                  <a href={contact.url} target="_blank" rel="noopener" className="text-gray-400 hover:text-gray-600 px-2 py-1" title="Ouvrir dans Notion"><svg className="w-3.5 h-3.5" viewBox="0 0 100 100" fill="currentColor"><path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z"/><path fill="#fff" d="M61.35 36.293L31.523 38.18c-2.72.097-3.303.78-3.303 2.527v36.82c0 1.747.778 3.017 2.527 2.917l28.86-1.65c2.14-.097 2.917-1.167 2.917-2.72V38.82c0-1.553-.97-2.623-2.917-2.527h-.257zm-1.553 4.08v31.377l-23.61 1.36V42.233l23.61-1.86z"/></svg></a>
                                </div>
                              </div>
                              {isLinked && <p className="text-xs text-emerald-600 mt-1">✓ Lié à cette conversation</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Done Projects */}
                  {dossierDetails.doneProjects?.length > 0 && (
                    <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <summary className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50 cursor-pointer hover:bg-gray-100 list-none">
                        <h4 className="font-semibold text-gray-500 text-sm flex items-center gap-2">
                          <Icon name="check" className="w-4 h-4 text-green-500" /> Projets terminés
                          <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{dossierDetails.doneProjects.length}</span>
                        </h4>
                        <Icon name="chevron" className="w-4 h-4 text-gray-400" />
                      </summary>
                      <div className="divide-y divide-gray-50">
                        {dossierDetails.doneProjects.map(p => {
                          const borderColor = p.type === 'Gestion' ? 'border-l-green-300' : p.type === 'Lead' ? 'border-l-purple-300' : p.type === 'Sinistre' ? 'border-l-red-300' : 'border-l-gray-200';
                          return (
                            <div key={p.id} className={`border-l-4 ${borderColor} opacity-60`}>
                              <a href={p.url} target="_blank" rel="noopener" className="flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-gray-600 truncate line-through">{p.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${p.type === 'Lead' ? 'bg-purple-50 text-purple-500' : p.type === 'Sinistre' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>{p.type}</span>
                                    {p.niveau && <span className="text-xs text-gray-400">{p.niveau}</span>}
                                  </div>
                                </div>
                                <Icon name="external" className="w-4 h-4 text-gray-300" />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {/* Stats */}
                  <div className="bg-gray-50 rounded-lg p-3 text-center text-xs text-gray-500">
                    {dossierDetails.stats?.contracts || 0} contrats · {(dossierDetails.stats?.activeProjects || 0) + (dossierDetails.stats?.doneProjects || 0)} projets · {dossierDetails.stats?.pendingTasks || 0} tâches
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
            ) : c.notion_contact_id && contactDetails ? (
              /* Contact linked, no dossier — show contact projects */
              <>
                {/* Contact Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center"><span className="text-lg">👤</span></div>
                      <div>
                        <h3 className="font-bold">{contactDetails.contact?.name}</h3>
                        <p className="text-emerald-200 text-xs">{contactDetails.contact?.phone || 'Contact Notion'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadContactDetails(c.notion_contact_id)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg" title="Actualiser">🔄</button>
                      <a href={contactDetails.contact?.url} target="_blank" rel="noopener" className="p-2 bg-white/10 hover:bg-white/20 rounded-lg" title="Ouvrir dans Notion"><svg className="w-4 h-4" viewBox="0 0 100 100" fill="currentColor"><path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z"/><path fill="#fff" d="M61.35 36.293L31.523 38.18c-2.72.097-3.303.78-3.303 2.527v36.82c0 1.747.778 3.017 2.527 2.917l28.86-1.65c2.14-.097 2.917-1.167 2.917-2.72V38.82c0-1.553-.97-2.623-2.917-2.527h-.257zm-1.553 4.08v31.377l-23.61 1.36V42.233l23.61-1.86z"/></svg></a>
                    </div>
                  </div>
                </div>

                {/* Contact Projects with Tasks */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Icon name="project" className="w-4 h-4 text-purple-500" /> Projets</h4>
                    <button onClick={() => { setShowCreateOpp(true); setShowCreateTask(false); }} className="text-xs text-purple-600 hover:underline">+ Nouveau</button>
                  </div>
                {contactDetails.projects?.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                      {contactDetails.projects.map(p => {
                        const borderColor = p.type === 'Gestion' ? 'border-l-green-500' : p.type === 'Lead' ? 'border-l-purple-500' : p.type === 'Sinistre' ? 'border-l-red-500' : 'border-l-gray-300';
                        return (
                          <div key={p.id} className={`border-l-4 ${borderColor}`}>
                            <a href={p.url} target="_blank" rel="noopener" className="flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 truncate">{p.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${p.type === 'Lead' ? 'bg-purple-100 text-purple-700' : p.type === 'Sinistre' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{p.type}</span>
                                  {p.niveau && <span className="text-xs text-gray-400">{p.niveau}</span>}
                                </div>
                              </div>
                              <Icon name="chevron" className="w-4 h-4 text-gray-400" />
                            </a>
                            {p.tasks?.length > 0 && (
                              <div className="ml-4 border-l-2 border-gray-100 pl-3 pb-2">
                                {p.tasks.map(t => {
                                  const isCompleted = t.completed || t.status === 'Terminé' || t.status === 'Done';
                                  return (
                                    <div key={t.id} className="py-1.5 px-2 hover:bg-gray-50 rounded transition-colors">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={isCompleted}
                                          disabled={togglingTaskId === t.id}
                                          onChange={(e) => { e.stopPropagation(); toggleTaskCompletion(t, e.target.checked); }}
                                          className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                                        />
                                        <span className="text-xs">{t.priority?.includes('Urg') ? '🔴' : t.priority === 'Important' ? '🟠' : ''}</span>
                                        <a href={t.url} target="_blank" rel="noopener" className={`text-xs flex-1 truncate ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{t.name}</a>
                                        {t.date && !isCompleted && <span className={`text-xs ${getDateStatus(t.date) === 'overdue' ? 'text-red-600 font-medium' : getDateStatus(t.date) === 'today' ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>{new Date(t.date).toLocaleDateString('fr-FR', {day:'numeric',month:'short'})}</span>}
                                        {t.note && <span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block flex-shrink-0" title="Commentaires"></span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-400 text-sm">
                      Aucun projet · Cliquez sur "+ Nouveau" pour créer un projet Lead
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="bg-gray-50 rounded-lg p-3 text-center text-xs text-gray-500">
                  {contactDetails.stats?.activeProjects || 0} projets actifs · {contactDetails.stats?.pendingTasks || 0} tâches
                </div>

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

                {/* Link dossier option */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-xs text-gray-400 mb-2">Lier aussi un dossier ?</p>
                  {!showNotionLink ? (
                    <button onClick={() => { setShowNotionLink(true); searchDossiers(''); }} className="px-4 py-2 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200">Rechercher un dossier</button>
                  ) : (
                    <div className="space-y-2 text-left">
                      <div className="flex items-center gap-2">
                        <input type="text" placeholder="Rechercher..." value={notionSearch} onChange={e => { setNotionSearch(e.target.value); searchDossiers(e.target.value); }} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                        <button onClick={() => setShowNotionLink(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">✕</button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {notionSearching && <p className="text-xs text-gray-400 text-center py-2">Recherche...</p>}
                        {notionResults.map(d => (
                          <button key={d.id} onClick={() => linkDossier(d)} disabled={notionLoading} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-gray-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">N</div>
                            <span className="text-sm text-gray-800 truncate">{d.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* No dossier and no contact linked */
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
  const DocumentsView = () => {
    const [filter, setFilter] = useState('all');
    const [contactFilter, setContactFilter] = useState('all');
    const [docSearch, setDocSearch] = useState('');
    const [selectedDocs, setSelectedDocs] = useState(new Set());
    const [downloading, setDownloading] = useState(false);

    // Get unique contacts from documents
    const uniqueContacts = useMemo(() => {
      const contacts = new Map();
      documents.forEach(d => {
        const name = d.notion_dossier_name || d.notion_contact_name || d.conversation_name;
        const key = d.conversation_jid || name;
        if (key && !contacts.has(key)) {
          contacts.set(key, { jid: d.conversation_jid, name: name || 'Sans nom', count: 0 });
        }
        if (key) contacts.get(key).count++;
      });
      return Array.from(contacts.values()).sort((a, b) => b.count - a.count);
    }, [documents]);

    // Filter by status, contact, and search
    const filtered = useMemo(() => {
      let result = documents;
      if (filter !== 'all') result = result.filter(d => d.status === filter);
      if (contactFilter !== 'all') result = result.filter(d => d.conversation_jid === contactFilter);
      if (docSearch.trim()) {
        const q = docSearch.toLowerCase();
        result = result.filter(d =>
          d.filename?.toLowerCase().includes(q) ||
          d.conversation_name?.toLowerCase().includes(q) ||
          d.notion_dossier_name?.toLowerCase().includes(q)
        );
      }
      return result;
    }, [documents, filter, contactFilter, docSearch]);
    const downloadableDocs = filtered.filter(d => d.local_path);

    const toggleSelectDoc = (docId) => {
      setSelectedDocs(prev => {
        const next = new Set(prev);
        if (next.has(docId)) next.delete(docId);
        else next.add(docId);
        return next;
      });
    };

    const selectAll = () => {
      if (selectedDocs.size === downloadableDocs.length) {
        setSelectedDocs(new Set());
      } else {
        setSelectedDocs(new Set(downloadableDocs.map(d => d.id)));
      }
    };

    const downloadSelected = async () => {
      const toDownload = downloadableDocs.filter(d => selectedDocs.has(d.id));
      if (toDownload.length === 0) return;

      setDownloading(true);

      // Download each file sequentially with a small delay
      const downloadedIds = [];
      for (const doc of toDownload) {
        try {
          const url = `/api/whatsapp/media/${encodeURIComponent(doc.local_path.split('/').pop())}`;
          const response = await fetch(url);
          const blob = await response.blob();
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);

          // Build filename: dossier/contact name + original filename
          const contactName = doc.notion_dossier_name || doc.notion_contact_name || doc.conversation_name || 'Document';
          const cleanName = contactName.replace(/[<>:"/\\|?*]/g, '_').trim(); // Remove invalid chars
          const originalName = doc.filename || 'document';
          link.download = `${cleanName} - ${originalName}`;

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          downloadedIds.push(doc.id);
          await new Promise(r => setTimeout(r, 300)); // Small delay between downloads
        } catch (err) {
          console.error('Erreur téléchargement:', doc.filename, err);
        }
      }

      // Mark all downloaded docs as "téléchargé"
      for (const docId of downloadedIds) {
        await updateDocStatus(docId, 'telecharge');
      }

      setDownloading(false);
      setSelectedDocs(new Set());
    };

    const downloadAll = async () => {
      if (downloadableDocs.length === 0) return;
      setSelectedDocs(new Set(downloadableDocs.map(d => d.id)));
      // Trigger download after state update
      setTimeout(() => downloadSelected(), 100);
    };

    // Count expired docs (no local_path)
    const expiredDocs = filtered.filter(d => !d.local_path);
    const [deletingExpired, setDeletingExpired] = useState(false);

    const deleteExpiredDocs = async () => {
      if (!confirm(`Supprimer ${expiredDocs.length} document(s) expiré(s) ?\n\nCes fichiers ne peuvent plus être récupérés depuis WhatsApp.`)) return;
      setDeletingExpired(true);
      try {
        for (const doc of expiredDocs) {
          await fetch('/api/documents/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docId: doc.id })
          });
        }
        loadDocuments();
      } catch (err) {
        alert('Erreur: ' + err.message);
      }
      setDeletingExpired(false);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
            <p className="text-gray-500 text-sm mt-1">
              {filtered.length}/{documents.length} documents
              {expiredDocs.length > 0 && <span className="text-red-500 ml-2">({expiredDocs.length} expirés)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {expiredDocs.length > 0 && (
              <button
                onClick={deleteExpiredDocs}
                disabled={deletingExpired}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 text-sm font-medium"
              >
                {deletingExpired ? '🗑️ Suppression...' : `🗑️ Supprimer expirés (${expiredDocs.length})`}
              </button>
            )}
            {selectedDocs.size > 0 && (
              <button
                onClick={downloadSelected}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
              >
                <Icon name="download" className="w-4 h-4" />
                {downloading ? 'Téléchargement...' : `Télécharger (${selectedDocs.size})`}
              </button>
            )}
            <button
              onClick={() => setSelectedDocs(new Set(downloadableDocs.map(d => d.id)))}
              disabled={downloading || downloadableDocs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium"
            >
              <Icon name="download" className="w-4 h-4" />
              Tout sélectionner ({downloadableDocs.length})
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {[{id:'all',label:'Tous',count:documents.length},...Object.entries(DOC_STATUSES).map(([k,v])=>({id:k,label:v,count:documents.filter(d=>d.status===k).length}))].map(f => (
              <button key={f.id} onClick={() => { setFilter(f.id); setSelectedDocs(new Set()); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter===f.id?'bg-gray-900 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Contact filter */}
          <select
            value={contactFilter}
            onChange={(e) => { setContactFilter(e.target.value); setSelectedDocs(new Set()); }}
            className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">👤 Tous les contacts ({uniqueContacts.length})</option>
            {uniqueContacts.map(c => (
              <option key={c.jid} value={c.jid}>{c.name} ({c.count})</option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            placeholder="Rechercher un document..."
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[200px]"
          />

          {downloadableDocs.length > 0 && (
            <button onClick={selectAll} className="text-xs text-gray-500 hover:text-gray-700 ml-auto">
              {selectedDocs.size === downloadableDocs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(doc => {
            const isPdf = doc.mimetype?.includes('pdf');
            const isImage = doc.mimetype?.startsWith('image/');
            const docUrl = doc.local_path ? `/api/whatsapp/media/${encodeURIComponent(doc.local_path.split('/').pop())}` : null;
            const isSelected = selectedDocs.has(doc.id);

            return (
              <div key={doc.id} className={`bg-white rounded-xl border-2 overflow-hidden group transition-colors ${isSelected ? 'border-emerald-500' : 'border-gray-200'}`}>
                {/* Checkbox overlay */}
                {docUrl && (
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectDoc(doc.id)}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                )}
                <div className="relative">
                  {docUrl ? (
                    <button onClick={() => setPreviewDoc({url:docUrl,filename:doc.filename,mimetype:doc.mimetype})} className="w-full block hover:opacity-90 cursor-pointer">
                      {isImage ? (
                        <div className="h-36 bg-gray-50 flex items-center justify-center overflow-hidden">
                          <img src={docUrl} alt={doc.filename} className="max-h-full max-w-full object-contain" loading="lazy" />
                        </div>
                      ) : isPdf ? (
                        <div className="h-36 bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-12 h-14 mx-auto bg-white rounded-lg shadow-sm border border-red-200 flex items-center justify-center">
                              <span className="text-red-500 font-bold text-sm">PDF</span>
                            </div>
                            <p className="text-xs text-red-400 mt-2 opacity-0 group-hover:opacity-100">Aperçu</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-28 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                          <Icon name="file" className="w-10 h-10 text-blue-300" />
                        </div>
                      )}
                    </button>
                  ) : (
                    <div className="h-28 bg-red-50 flex items-center justify-center relative">
                      <div className="text-center">
                        <Icon name="file" className="w-10 h-10 text-red-300 mx-auto" />
                        <p className="text-xs text-red-500 mt-1">Expiré</p>
                      </div>
                      <div className="absolute top-2 right-2">
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">❌</span>
                      </div>
                    </div>
                  )}
                  {/* Selection checkbox */}
                  {docUrl && (
                    <div className="absolute top-2 left-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectDoc(doc.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-5 h-5 rounded border-2 border-white shadow-sm text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-400">{doc.file_size ? `${(doc.file_size/1024).toFixed(0)} KB` : ''}</span>
                      <button onClick={() => { const c = conversations.find(cv => cv.jid === doc.conversation_jid); if(c) openConversation(c); }} className="text-xs text-emerald-600 hover:underline truncate">
                        {doc.conversation_name}
                      </button>
                    </div>
                    <select value={doc.status} onChange={e => updateDocStatus(doc.id, e.target.value)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOC_COLORS[doc.status] || ''}`}>
                      {Object.entries(DOC_STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              Aucun document
            </div>
          )}
        </div>
      </div>
    );
  };

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

  // ==================== CONTACTS VIEW ====================
  // Helper functions for contacts
  const findConversationByPhone = useCallback((phone) => {
    if (!phone) return null;
    const cleanPhone = phone.replace(/\D/g, '').slice(-9);
    return conversations.find(c => {
      const convPhone = (c.phone || c.jid?.split('@')[0] || '').replace(/\D/g, '').slice(-9);
      return convPhone === cleanPhone;
    });
  }, [conversations]);

  const filteredContacts = useMemo(() => {
    let filtered = notionContacts;
    if (playlistView === 'today') {
      filtered = filtered.filter(c => contactPlaylist.today.includes(c.id));
    } else if (playlistView === 'week') {
      filtered = filtered.filter(c => contactPlaylist.week.includes(c.id));
    }
    if (contactSearch.trim()) {
      const q = contactSearch.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [notionContacts, playlistView, contactPlaylist, contactSearch]);

  const getContactInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formatContactPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('33')) {
      return cleaned.replace(/(\d{2})(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})/, '+$1 $2 $3 $4 $5 $6');
    }
    return phone;
  };

  const ContactsView = () => {

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
            <p className="text-gray-500 text-sm mt-1">{filteredContacts.length}/{notionContacts.length} contacts</p>
          </div>
          <button
            onClick={() => loadNotionContacts(true)}
            disabled={loadingContacts}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
          >
            {loadingContacts ? '...' : '🔄 Actualiser'}
          </button>
        </div>

        {/* Playlist Tabs + Search */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { id: 'all', label: 'Tous', count: notionContacts.length },
              { id: 'today', label: "Aujourd'hui", count: contactPlaylist.today.length },
              { id: 'week', label: 'Semaine', count: contactPlaylist.week.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPlaylistView(tab.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  playlistView === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label} {tab.count > 0 && <span className="ml-1 text-xs text-gray-400">({tab.count})</span>}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Rechercher un contact..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Contacts List */}
        {loadingContacts && notionContacts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 animate-pulse">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-gray-50" />)}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {playlistView !== 'all' ? 'Aucun contact dans cette playlist' : 'Aucun contact trouvé'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {filteredContacts.map(contact => {
              const waConv = findConversationByPhone(contact.phone);
              const inToday = contactPlaylist.today.includes(contact.id);
              const inWeek = contactPlaylist.week.includes(contact.id);

              return (
                <div key={contact.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {getContactInitials(contact.name)}
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">{contact.name}</h3>
                      {contact.statut?.map(s => (
                        <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{s}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      {contact.phone && <span>{formatContactPhone(contact.phone)}</span>}
                      {contact.email && <span className="truncate">{contact.email}</span>}
                      {waConv?.last_message_time && (
                        <span className={`text-xs ${Math.floor((Date.now() - waConv.last_message_time) / 86400000) > 30 ? 'text-red-500' : Math.floor((Date.now() - waConv.last_message_time) / 86400000) > 7 ? 'text-orange-500' : 'text-emerald-600'}`}>
                          💬 {Math.floor((Date.now() - waConv.last_message_time) / 86400000)}j
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* WhatsApp */}
                    {waConv ? (
                      <button
                        onClick={() => { setSelectedJid(waConv.jid); setView('detail'); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Icon name="message" className="w-3.5 h-3.5" />
                        WA
                      </button>
                    ) : contact.phone ? (
                      <a
                        href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Icon name="message" className="w-3.5 h-3.5" />
                      </a>
                    ) : null}

                    {/* Dossier */}
                    {contact.dossierId && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/notion/dossiers/${contact.dossierId}`);
                            const data = await res.json();
                            if (data.dossier) {
                              setSelectedDossier(data.dossier);
                              setView('dossierDetail');
                            }
                          } catch {}
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Icon name="folder" className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Notion */}
                    <a
                      href={contact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold transition-colors"
                    >
                      N
                    </a>

                    {/* Playlist buttons */}
                    <div className="flex gap-1 ml-2 pl-2 border-l border-gray-200">
                      <button
                        onClick={() => inToday ? removeFromPlaylist(contact.id, 'today') : addToPlaylist(contact.id, 'today')}
                        className={`p-1.5 rounded-lg transition-colors ${inToday ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 hover:text-amber-600'}`}
                        title={inToday ? "Retirer d'aujourd'hui" : "Ajouter à aujourd'hui"}
                      >
                        ☀️
                      </button>
                      <button
                        onClick={() => inWeek ? removeFromPlaylist(contact.id, 'week') : addToPlaylist(contact.id, 'week')}
                        className={`p-1.5 rounded-lg transition-colors ${inWeek ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 hover:text-blue-600'}`}
                        title={inWeek ? "Retirer de la semaine" : "Ajouter à la semaine"}
                      >
                        📅
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ==================== SALES STATS ====================
  const [statsMonthOffset, setStatsMonthOffset] = useState(0);
  const SalesStats = () => {
    if (loadingSalesStats && !salesStats) return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}</div>
        <div className="h-64 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-xl" />)}</div>
      </div>
    );
    if (!salesStats) return <div className="text-center py-12 text-gray-400">Erreur de chargement</div>;

    const { kpi, chart, tables, allContracts } = salesStats;
    const maxAmount = Math.max(...chart.map(m => m.amount), 1);

    const fmtEuro = (n) => n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k €` : `${Math.round(n).toLocaleString('fr-FR')} €`;
    const fmtEuroFull = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;

    // Moving average (3-month) calculation
    const movingAvg = chart.map((_, idx) => {
      const window = chart.slice(Math.max(0, idx - 2), idx + 1);
      return window.reduce((s, m) => s + m.amount, 0) / window.length;
    });

    // Navigable month table
    const navDate = new Date();
    navDate.setMonth(navDate.getMonth() + statsMonthOffset);
    const navMonth = navDate.getMonth();
    const navYear = navDate.getFullYear();
    const navMonthLabel = navDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    const navContracts = (allContracts || [])
      .filter(c => c.month === navMonth && c.year === navYear)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const navTotal = navContracts.reduce((s, c) => s + c.amount, 0);

    // Navigate to conversation linked to a dossier
    const navigateToDossier = (dossierId) => {
      const conv = conversations.find(conv => conv.notion_dossier_id === dossierId);
      if (conv) {
        openConversation(conv);
      }
    };

    const StatRow = ({ c }) => (
      <div className="flex items-start gap-3 py-3 border-b border-gray-100 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{c.contract_num}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              c.type === 'Santé' || c.type === 'Mutuelle Collective' ? 'bg-pink-100 text-pink-700' :
              c.type === 'Prévoyance' ? 'bg-blue-100 text-blue-700' :
              c.type === 'IARD' ? 'bg-orange-100 text-orange-700' :
              c.type === 'Vie' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-600'
            }`}>{c.type}</span>
          </div>
          {c.dossier_name && (
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => c.dossier_id && navigateToDossier(c.dossier_id)}
                className="text-sm font-semibold text-gray-900 hover:text-emerald-600 text-left"
              >
                {c.dossier_name}
              </button>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600" title="Ouvrir dans Notion">
                <svg className="w-3.5 h-3.5" viewBox="0 0 100 100" fill="currentColor"><path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z"/><path fill="#fff" d="M61.35 36.293L31.523 38.18c-2.72.097-3.303.78-3.303 2.527v36.82c0 1.747.778 3.017 2.527 2.917l28.86-1.65c2.14-.097 2.917-1.167 2.917-2.72V38.82c0-1.553-.97-2.623-2.917-2.527h-.257zm-1.553 4.08v31.377l-23.61 1.36V42.233l23.61-1.86z"/></svg>
              </a>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {c.assureur_name && <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">{c.assureur_name}</span>}
            <span className="text-[10px] text-gray-400">{c.date ? new Date(c.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
          </div>
        </div>
        <div className="shrink-0 ml-4 text-right">
          <p className="text-lg font-bold text-emerald-700">{fmtEuroFull(c.amount)}</p>
        </div>
      </div>
    );

    // Top dossiers by number of contracts
    const topDossiers = (() => {
      const dossierCounts = {};
      (allContracts || []).filter(c => c.year === 2026 && c.dossier_name).forEach(c => {
        if (!dossierCounts[c.dossier_name]) {
          dossierCounts[c.dossier_name] = { name: c.dossier_name, count: 0, total: 0, url: c.url, dossier_id: c.dossier_id };
        }
        dossierCounts[c.dossier_name].count++;
        dossierCounts[c.dossier_name].total += c.amount;
      });
      return Object.values(dossierCounts).sort((a, b) => b.count - a.count).slice(0, 5);
    })();

    const ContractTable = ({ title, emoji, data, emptyMsg }) => (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">{emoji} {title}</h3>
        {(!data || data.length === 0) ? (
          <p className="text-sm text-gray-400 text-center py-6 flex-1 flex items-center justify-center">{emptyMsg || 'Aucune donnée'}</p>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[400px]">
            {data.map((c, i) => <StatRow key={c.id || i} c={c} />)}
          </div>
        )}
      </div>
    );

    return (<div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">Statistiques</h2><p className="text-gray-500 text-sm mt-1">Production commerciale depuis Sept. 2025</p></div>
        <button onClick={() => loadSalesStats(true)} disabled={loadingSalesStats} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors disabled:opacity-50">{loadingSalesStats ? '...' : '🔄 Actualiser'}</button>
      </div>

      {/* KPI Cards - 2026 only */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-emerald-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-xl">💰</div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{fmtEuroFull(kpi.total26)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Commissions 2026</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📝</div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{(allContracts || []).filter(c => c.year === 2026).length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Contrats 2026</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-purple-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-xl">📊</div>
            <div>
              <p className="text-2xl font-bold text-purple-700">{fmtEuro((allContracts || []).filter(c => c.year === 2026).length > 0 ? kpi.total26 / (allContracts || []).filter(c => c.year === 2026).length : 0)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Moyenne / contrat</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bar Chart with Moving Average */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-gray-900">Commissions par mois</h3>
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> Commissions</span>
            <span className="flex items-center gap-1"><span className="w-6 border-t-2 border-dashed border-orange-400 inline-block" /> Moy. mobile 3 mois</span>
          </div>
        </div>
        {chart.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
        ) : (
          <div className="relative">
            <div className="flex items-end gap-2 h-56">
              {chart.map((m, idx) => {
                const pct = maxAmount > 0 ? Math.max((m.amount / maxAmount) * 100, 4) : 4;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 min-w-0 group/bar">
                    <div className="w-full flex flex-col items-center" style={{ height: '200px' }}>
                      <div className="w-full mt-auto relative">
                        <div
                          className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-md transition-all duration-500 hover:from-emerald-600 hover:to-emerald-500 cursor-pointer flex flex-col items-center justify-end pb-2"
                          style={{ height: `${(pct / 100) * 200}px`, minHeight: '45px' }}
                          title={`${m.label}\n${fmtEuroFull(m.amount)} — ${m.count} contrat${m.count > 1 ? 's' : ''}\nMoy. 3 mois: ${fmtEuroFull(movingAvg[idx])}`}
                        >
                          <span className="text-white font-bold text-xs drop-shadow-sm">{fmtEuro(m.amount)}</span>
                          <span className="text-white/80 font-semibold text-[10px] drop-shadow-sm">{m.count} contrat{m.count > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-semibold text-gray-700 capitalize leading-tight block">{m.label.split(' ')[0]}</span>
                      <span className="text-[9px] text-gray-400">{m.label.split(' ')[1]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Moving Average SVG overlay */}
            {chart.length >= 2 && (
              <svg className="absolute pointer-events-none" style={{ top: '20px', left: 0, right: 0, height: '190px', width: '100%' }} viewBox={`0 0 ${chart.length * 100} 190`} preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="3"
                  strokeDasharray="8,4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={movingAvg.map((avg, i) => {
                    const x = (i + 0.5) * (100);
                    const y = maxAmount > 0 ? 190 - (avg / maxAmount) * 190 : 190;
                    return `${x},${y}`;
                  }).join(' ')}
                />
                {movingAvg.map((avg, i) => {
                  const x = (i + 0.5) * 100;
                  const y = maxAmount > 0 ? 190 - (avg / maxAmount) * 190 : 190;
                  return <circle key={i} cx={x} cy={y} r="4" fill="#f97316" />;
                })}
              </svg>
            )}
          </div>
        )}
      </div>

      {/* 3 Tables: Top Dossiers, Top 2026, Navigable Month */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Dossiers by contract count */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">🏢 Top Dossiers 2026</h3>
          {topDossiers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 flex-1 flex items-center justify-center">Aucun dossier</p>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[400px] space-y-2">
              {topDossiers.map((d, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
                  <span className="text-lg font-bold text-gray-300 w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => d.dossier_id && navigateToDossier(d.dossier_id)} className="text-sm font-medium text-gray-900 hover:text-emerald-600 truncate text-left">{d.name}</button>
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 flex-shrink-0" title="Ouvrir dans Notion">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 100 100" fill="currentColor"><path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z"/><path fill="#fff" d="M61.35 36.293L31.523 38.18c-2.72.097-3.303.78-3.303 2.527v36.82c0 1.747.778 3.017 2.527 2.917l28.86-1.65c2.14-.097 2.917-1.167 2.917-2.72V38.82c0-1.553-.97-2.623-2.917-2.527h-.257zm-1.553 4.08v31.377l-23.61 1.36V42.233l23.61-1.86z"/></svg>
                      </a>
                    </div>
                    <p className="text-[10px] text-gray-400">{d.count} contrat{d.count > 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700">{fmtEuro(d.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <ContractTable title="Top Contrats 2026" emoji="🏆" data={tables.top2026} emptyMsg="Pas encore de contrats en 2026" />

        {/* Navigable month table */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setStatsMonthOffset(o => o - 1)} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="text-center">
              <h3 className="font-semibold text-sm text-gray-900 capitalize">{navMonthLabel}</h3>
              <p className="text-[10px] text-gray-400">{navContracts.length} contrat{navContracts.length !== 1 ? 's' : ''} — {fmtEuroFull(navTotal)}</p>
            </div>
            <button onClick={() => setStatsMonthOffset(o => Math.min(o + 1, 0))} disabled={statsMonthOffset >= 0} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {navContracts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 flex-1 flex items-center justify-center">Aucun contrat</p>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[400px]">
              {navContracts.map((c, i) => <StatRow key={c.id || i} c={c} />)}
            </div>
          )}
        </div>
      </div>
    </div>);
  };

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
    <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold text-gray-900">Analytics</h2><p className="text-gray-500 text-sm mt-1">KPIs business &amp; suivi d'activité</p></div><button onClick={() => loadNotionAnalytics(true)} disabled={loadingAnalytics} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors disabled:opacity-50">{loadingAnalytics ? '...' : '🔄 Actualiser'}</button></div>
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
    return (<div className="space-y-6"><div><h2 className="text-2xl font-bold text-gray-900">Paramètres</h2></div>
    <div className="bg-white rounded-xl border border-gray-200 p-6"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Icon name="wifi" className="w-5 h-5 text-emerald-600" /></div><div><h3 className="font-semibold text-gray-900">Connexion WhatsApp</h3><p className="text-sm text-gray-500">Via QR code</p></div></div>
    {connected ? (<div className="flex items-center justify-between bg-emerald-50 rounded-lg p-4"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" /><span className="text-sm font-medium text-emerald-800">Connecté ✓</span></div><div className="flex items-center gap-3"><button onClick={async () => { await fetch('/api/whatsapp/reconnect', { method: 'POST' }); }} className="text-sm text-amber-600 hover:underline">🔄 Forcer reconnexion</button><button onClick={handleDisconnect} className="text-sm text-red-600 hover:underline">Déconnecter</button></div></div>)
    : connecting && qrImage ? (<div className="text-center py-4"><img src={qrImage} alt="QR" className="mx-auto w-64 h-64 rounded-xl border-2 border-gray-200" /><p className="text-sm text-gray-600 mt-4 font-medium">Scannez avec WhatsApp</p><p className="text-xs text-gray-400 mt-1">WhatsApp → ⋮ → Appareils connectés → Connecter</p><div className="mt-3 flex items-center justify-center gap-2 text-amber-600 text-xs"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> En attente...</div><button onClick={handleDisconnect} className="mt-4 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">Annuler</button></div>)
    : connecting ? (<div className="text-center py-8"><div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto" /><p className="text-sm text-gray-600 mt-4">QR code...</p><button onClick={async () => { await handleDisconnect(); setConnecting(false); }} className="mt-4 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">Annuler</button></div>)
    : (<div className="text-center py-8"><div className="w-48 h-48 bg-gray-100 rounded-xl mx-auto flex items-center justify-center border-2 border-dashed border-gray-300"><Icon name="qr" className="w-20 h-20 text-gray-400" /></div><p className="text-sm text-gray-600 mt-4">Connecter WhatsApp</p><button onClick={handleConnect} className="mt-4 px-8 py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600">🔗 Connecter</button></div>)}</div>
    <div className="bg-white rounded-xl border border-gray-200 p-6"><h3 className="font-semibold text-gray-900 mb-2">Comment ça marche</h3><div className="space-y-3 text-sm text-gray-600"><p>1. Cliquez sur <strong>Connecter</strong></p><p>2. Scannez le QR code</p><p>3. WhatsApp → ⋮ → <strong>Appareils connectés</strong></p><p>4. ✅ Messages en temps réel</p></div></div>

    {/* Reset session for full sync */}
    <div className="bg-white rounded-xl border border-amber-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><span className="text-lg">🔄</span></div>
          <div>
            <h3 className="font-semibold text-gray-900">Reset & Sync complet</h3>
            <p className="text-sm text-gray-500">Supprime la session et force un nouveau scan QR avec sync de tout l'historique</p>
          </div>
        </div>
        <button onClick={async () => {
          if (confirm('⚠️ Reset complet de la session WhatsApp\n\nCela va :\n1. Te déconnecter de WhatsApp Web\n2. Supprimer les données de session\n3. Demander un nouveau QR code\n4. Synchroniser tout l\'historique des messages\n\nContinuer ?')) {
            await fetch('/api/whatsapp/reset', { method: 'POST' });
            setConnected(false);
            setQrImage(null);
            alert('Session réinitialisée ! Clique sur "Connecter" pour scanner un nouveau QR code.');
          }
        }} className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-2 text-sm font-medium">🔄 Reset & Re-scan</button>
      </div>
    </div>

    {/* Vider le cache navigateur */}
    <div className="bg-white rounded-xl border border-blue-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><span className="text-lg">🧹</span></div>
          <div>
            <h3 className="font-semibold text-gray-900">Vider le cache</h3>
            <p className="text-sm text-gray-500">Force le rechargement complet de l'application (CSS, JS, pages)</p>
          </div>
        </div>
        <button onClick={async () => {
          if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
          }
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          }
          window.location.reload(true);
        }} className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2 text-sm font-medium">🧹 Vider & Recharger</button>
      </div>
    </div>

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

    {/* Logout Section */}
    <div className="bg-white rounded-xl border border-red-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><span className="text-lg">🚪</span></div>
          <div>
            <h3 className="font-semibold text-gray-900">Déconnexion</h3>
            <p className="text-sm text-gray-500">Se déconnecter de l'agent Smart Value</p>
          </div>
        </div>
        <button onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
          window.location.href = '/login';
        }} className="px-4 py-2 bg-red-50 text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 text-sm font-medium">🚪 Déconnexion</button>
      </div>
    </div>
  </div>);};

  // ==================== CODES COURTAGE VIEW ====================
  const CodesView = () => {
    const [showPassword, setShowPassword] = useState({});
    const [searchCode, setSearchCode] = useState('');
    const [formData, setFormData] = useState({ compagnie: '', type: '', identifiant: '', mot_de_passe: '', url: '', commentaires: '' });

    useEffect(() => {
      if (!brokerCodesHasLoaded && !loadingBrokerCodes) loadBrokerCodes();
    }, []);

    useEffect(() => {
      if (editingCode) {
        setFormData(editingCode.id ? editingCode : { compagnie: '', type: '', identifiant: '', mot_de_passe: '', url: '', commentaires: '' });
      }
    }, [editingCode]);

    const handleSubmit = (e) => {
      e.preventDefault();
      saveBrokerCode(formData);
      setFormData({ compagnie: '', type: '', identifiant: '', mot_de_passe: '', url: '', commentaires: '' });
    };

    const filteredCodes = brokerCodes.filter(code => {
      if (!searchCode.trim()) return true;
      const search = searchCode.toLowerCase();
      return (
        code.compagnie?.toLowerCase().includes(search) ||
        code.type?.toLowerCase().includes(search) ||
        code.identifiant?.toLowerCase().includes(search) ||
        code.commentaires?.toLowerCase().includes(search)
      );
    });

    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Codes Courtage</h2>
            <p className="text-gray-500 text-sm mt-1">Identifiants et accès compagnies — Synchro Notion</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadBrokerCodes} disabled={loadingBrokerCodes} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors disabled:opacity-50">
              {loadingBrokerCodes ? '...' : '🔄 Actualiser'}
            </button>
            <button onClick={() => setEditingCode({})} className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white transition-colors">
              + Ajouter
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une compagnie, identifiant..."
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          {searchCode && (
            <button onClick={() => setSearchCode('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingBrokerCodes && brokerCodes.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Chargement depuis Notion...</div>
          ) : brokerCodes.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Icon name="key" className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Aucun code enregistré</p>
              <button onClick={() => setEditingCode({})} className="mt-3 text-emerald-600 text-sm hover:underline">Ajouter un code</button>
            </div>
          ) : filteredCodes.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p>Aucun résultat pour "{searchCode}"</p>
              <button onClick={() => setSearchCode('')} className="mt-2 text-emerald-600 text-sm hover:underline">Effacer la recherche</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Compagnie</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Identifiant</th>
                  <th className="px-4 py-3 text-left font-medium">Mot de passe</th>
                  <th className="px-4 py-3 text-left font-medium">Site</th>
                  <th className="px-4 py-3 text-left font-medium">Commentaires</th>
                  <th className="px-4 py-3 text-center font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCodes.map(code => (
                  <tr key={code.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{code.compagnie || '-'}</td>
                    <td className="px-4 py-3">
                      {code.type ? <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{code.type}</span> : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{code.identifiant || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-700">
                          {showPassword[code.id] ? (code.mot_de_passe || '-') : '••••••••'}
                        </span>
                        <button onClick={() => setShowPassword(p => ({ ...p, [code.id]: !p[code.id] }))} className="text-gray-400 hover:text-gray-600 text-xs">
                          {showPassword[code.id] ? '🙈' : '👁️'}
                        </button>
                        {code.mot_de_passe && (
                          <button onClick={() => { navigator.clipboard.writeText(code.mot_de_passe); }} className="text-gray-400 hover:text-gray-600 text-xs" title="Copier">
                            📋
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {code.url ? (
                        <a href={code.url} target="_blank" rel="noopener" className="text-emerald-600 hover:underline text-xs truncate block max-w-[150px]">
                          {code.url.replace(/^https?:\/\//, '').split('/')[0]}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate" title={code.commentaires}>{code.commentaires || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {code.notion_url && (
                          <a href={code.notion_url} target="_blank" rel="noopener" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Ouvrir dans Notion">
                            <svg className="w-4 h-4" viewBox="0 0 100 100" fill="currentColor"><path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z"/><path fill="#fff" d="M61.35 36.293L31.523 38.18c-2.72.097-3.303.78-3.303 2.527v36.82c0 1.747.778 3.017 2.527 2.917l28.86-1.65c2.14-.097 2.917-1.167 2.917-2.72V38.82c0-1.553-.97-2.623-2.917-2.527h-.257zm-1.553 4.08v31.377l-23.61 1.36V42.233l23.61-1.86z"/></svg>
                          </a>
                        )}
                        <button onClick={() => setEditingCode(code)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Modifier">
                          <Icon name="edit" className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteBrokerCode(code.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Archiver">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit/Add Modal */}
        {editingCode && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{editingCode.id ? 'Modifier' : 'Ajouter'} un code</h3>
                <button onClick={() => setEditingCode(null)} className="p-1 hover:bg-gray-100 rounded">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Compagnie *</label>
                    <input type="text" value={formData.compagnie} onChange={e => setFormData(f => ({ ...f, compagnie: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                    <input type="text" value={formData.type || ''} onChange={e => setFormData(f => ({ ...f, type: e.target.value }))} placeholder="Ex: SVA, Courtier..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Identifiant</label>
                    <input type="text" value={formData.identifiant} onChange={e => setFormData(f => ({ ...f, identifiant: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe</label>
                    <input type="text" value={formData.mot_de_passe} onChange={e => setFormData(f => ({ ...f, mot_de_passe: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">URL du site</label>
                  <input type="url" value={formData.url} onChange={e => setFormData(f => ({ ...f, url: e.target.value }))} placeholder="https://" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Commentaires</label>
                  <textarea value={formData.commentaires} onChange={e => setFormData(f => ({ ...f, commentaires: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setEditingCode(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== DOSSIERS HANDLERS ====================
  const handleSelectDossier = (dossier) => {
    setSelectedDossier(dossier);
    setView('dossierDetail');
  };

  const handleBackFromDossier = () => {
    setSelectedDossier(null);
    setView('dossiers');
  };

  const handleOpenConversationFromDossier = (phone) => {
    const cleanPhone = phone.replace(/\D/g, '');
    // Find the conversation with this phone number
    const conv = conversations.find(c => {
      const convPhone = (c.phone || c.jid.split('@')[0]).replace(/\D/g, '');
      return convPhone === cleanPhone || convPhone.endsWith(cleanPhone) || cleanPhone.endsWith(convPhone);
    });
    if (conv) {
      openConversation(conv);
    } else {
      // Set contactToOpen so ConversationsList can auto-select when found
      setContactToOpen(cleanPhone);
      setSearchQuery(cleanPhone);
      setView('conversations');
      window.history.pushState({}, '', `?contact=${cleanPhone}`);
    }
  };

  // Auto-open contact when contactToOpen is set and we're on conversations view
  useEffect(() => {
    if (!contactToOpen || view !== 'conversations') return;
    const conv = conversations.find(c => {
      const convPhone = (c.phone || c.jid.split('@')[0]).replace(/\D/g, '');
      return convPhone === contactToOpen || convPhone.endsWith(contactToOpen) || contactToOpen.endsWith(convPhone);
    });
    if (conv) {
      openConversation(conv);
      setContactToOpen(null);
    }
  }, [contactToOpen, view, conversations]);

  // ==================== RENDER ====================
  const renderView = () => {
    if (view === 'detail' && selectedJid) return <Detail />;
    if (view === 'dossierDetail' && selectedDossier) {
      return (
        <DossierDetail
          dossier={selectedDossier}
          onBack={handleBackFromDossier}
          onOpenConversation={handleOpenConversationFromDossier}
        />
      );
    }
    switch(view) {
      case 'dashboard': return <DashboardView
  conversations={conversations}
  onNavigate={(view, params) => { setView(view); }}
  onOpenConversation={(jid) => { setSelectedJid(jid); setView('detail'); }}
  onOpenTask={(task) => setEntityPanel({ type: 'task', id: task.id })}
  onOpenProject={(projectId) => setEntityPanel({ type: 'project', id: projectId })}
  onCreateProject={(type) => {
    setProjectForm({ name: '', type: type, priority: 'À prioriser', niveau: '', contratId: null });
    setShowCreateOpp(true);
  }}
  onCreateTask={(info) => setDashboardTaskModal(info)}
/>;
      case 'kanban': return <PipelineView onOpenConversation={(jid) => { setSelectedJid(jid); setView('detail'); }} conversations={conversations} onOpenEntity={(type, id) => setEntityPanel({ type, id })} onCreateContract={(opts) => setContractModal(opts || {})} />;
      case 'conversations': return <ConversationsList />;
      case 'conversations2': return <ConversationsV2 />;
      case 'dossiers': return <DossierList
        onSelectDossier={handleSelectDossier}
        highlightedDossierId={highlightedDossierId}
        onClearHighlight={() => setHighlightedDossierId(null)}
      />;
      case 'contacts': return <ContactsView />;
      case 'tasks': return <TasksView
        onOpenConversation={handleOpenConversationFromDossier}
        onOpenProject={(projectId) => setEntityPanel({ type: 'project', id: projectId })}
        onOpenDossier={(dossierId) => setEntityPanel({ type: 'dossier', id: dossierId })}
        tasksData={tasksData}
        tasksLastUpdate={tasksLastUpdate}
        tasksHasLoaded={tasksHasLoaded}
        onTasksLoaded={(data) => { setTasksData(data); setTasksLastUpdate(new Date()); setTasksHasLoaded(true); }}
      />;
      case 'projects': return <ProjectsView
        projectsData={projectsData}
        projectsHasLoaded={projectsHasLoaded}
        onProjectsLoaded={(data) => { setProjectsData(data); setProjectsHasLoaded(true); }}
        highlightedProjectId={highlightedProjectId}
        onClearHighlight={() => setHighlightedProjectId(null)}
      />;
      case 'calendar': return <CalendarView
        tasksData={tasksData}
        onTasksLoaded={(data) => { setTasksData(data); setTasksLastUpdate(new Date()); setTasksHasLoaded(true); }}
        onOpenDossier={(dossierId) => setEntityPanel({ type: 'dossier', id: dossierId })}
        onOpenProject={(projectId) => {
          setEntityPanel({ type: 'project', id: projectId });
        }}
      />;
      case 'documents': return <DocumentsView />;
      case 'emails': return <EmailsView
        onOpenProject={(projectId) => setEntityPanel({ type: 'project', id: projectId })}
        onOpenDossier={(dossierId) => setEntityPanel({ type: 'dossier', id: dossierId })}
        onCreateProject={(type) => {
          setProjectForm({ name: '', type: type, priority: 'À prioriser', niveau: '', contratId: null });
          setShowCreateOpp(true);
        }}
        onCreateTask={(emailData) => setEmailTaskModal(emailData)}
      />;
      case 'drive': return <DriveExplorer
        driveUrl="https://drive.google.com/drive/folders/1co4mv9J4ZpqdoVypCA5tZUnndj6JQhXN"
        folderName="Dossier Clients"
        compact={false}
        maxHeight="calc(100vh - 200px)"
      />;
      case 'journal': return <JournalView />;
      case 'stats': return <SalesStats />;
      case 'analytics': return <Analytics />;
      case 'contrats': return <ContratsView onOpenEntity={(type, id) => setEntityPanel({ type, id })} onCreateContract={(opts) => setContractModal(opts || {})} />;
      case 'finance': return <FinanceView />;
      case 'commissions': return <CommissionsView onOpenEntity={(type, id) => setEntityPanel({ type, id })} onCreateContract={(opts) => setContractModal(opts || {})} />;
      case 'codes': return <CodesView />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (<div className="flex h-screen bg-gray-100 text-gray-900 overflow-hidden">
    <Sidebar />
    {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <div className="flex-1 flex flex-col min-w-0">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:hidden"><button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg"><Icon name="menu" className="w-5 h-5 text-gray-600" /></button><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center"><Icon name="message" className="w-4 h-4 text-white" /></div><span className="font-bold text-sm">WA Agent</span></div><div className={`ml-auto flex items-center gap-1.5 text-xs ${connected?'text-emerald-600':'text-red-500'}`}><div className={`w-2 h-2 rounded-full ${connected?'bg-emerald-500 animate-pulse':'bg-red-500'}`} />{connected?'Connecté':'Déconnecté'}</div></div>
      <div className={`flex-1 ${view === 'conversations2' ? 'overflow-hidden' : 'overflow-y-auto p-4 lg:p-6'}`}>{renderView()}</div>
    </div>
    {previewDoc && (<div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}><div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50"><div className="flex items-center gap-3 min-w-0"><div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${previewDoc.mimetype?.includes('pdf')?'bg-red-100':'bg-blue-100'}`}><span className={`text-xs font-bold ${previewDoc.mimetype?.includes('pdf')?'text-red-500':'text-blue-500'}`}>{previewDoc.mimetype?.includes('pdf')?'PDF':'DOC'}</span></div><p className="text-sm font-medium text-gray-900 truncate">{previewDoc.filename}</p></div>
      <div className="flex items-center gap-2 flex-shrink-0"><a href={previewDoc.url} download={previewDoc.filename} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Télécharger</a><a href={previewDoc.url} target="_blank" rel="noopener" className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Ouvrir ↗</a><button onClick={() => setPreviewDoc(null)} className="p-1.5 hover:bg-gray-200 rounded-lg"><svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
      <div className="flex-1 overflow-hidden bg-gray-100" style={{minHeight:'60vh'}}>{previewDoc.mimetype?.includes('pdf') ? <iframe src={previewDoc.url} className="w-full h-full border-0" style={{minHeight:'60vh'}} title={previewDoc.filename} /> : previewDoc.mimetype?.startsWith('image/') ? <div className="w-full h-full flex items-center justify-center p-4"><img src={previewDoc.url} alt={previewDoc.filename} className="max-w-full max-h-full object-contain" /></div> : <div className="w-full h-full flex items-center justify-center"><div className="text-center p-8"><Icon name="file" className="w-16 h-16 text-gray-300 mx-auto" /><p className="text-gray-500 mt-3">Aperçu non disponible</p><a href={previewDoc.url} download={previewDoc.filename} className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Télécharger</a></div></div>}</div>
    </div></div>)}

    {/* Email → Task Modal */}
    {emailTaskModal && (
      <TaskFormModal
        isOpen={!!emailTaskModal}
        onClose={() => setEmailTaskModal(null)}
        onSuccess={() => setEmailTaskModal(null)}
        mode="create"
        defaultProjectId={emailTaskModal.projectId}
        defaultDossierId={emailTaskModal.dossierId}
        defaultDossierName={emailTaskModal.dossierName}
        defaultTitle={emailTaskModal.name}
        defaultComment={emailTaskModal.comment}
      />
    )}

    {/* Dashboard → Task Modal */}
    {dashboardTaskModal && (
      <TaskFormModal
        isOpen={!!dashboardTaskModal}
        onClose={() => setDashboardTaskModal(null)}
        onSuccess={() => setDashboardTaskModal(null)}
        mode="create"
        defaultProjectId={dashboardTaskModal.projectId}
        defaultDossierId={dashboardTaskModal.dossierId}
        defaultDossierName={dashboardTaskModal.dossierName}
      />
    )}

    {/* Tag → Project Linking Modal */}
    {tagProjectModal && (() => {
      const conv = conversations.find(c => c.jid === tagProjectModal.jid);
      const linkedProjects = conv?.tag_projects?.[tagProjectModal.tag] || [];
      const linkedIds = new Set(linkedProjects.map(p => p.id));
      const allProjects = dossierDetails?.projects || contactDetails?.projects || [];
      const availableProjects = allProjects.filter(p => p.type === tagProjectModal.tag && !linkedIds.has(p.id));

      return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setTagProjectModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`p-4 ${tagProjectModal.tag === 'Gestion' ? 'bg-green-500' : tagProjectModal.tag === 'Lead' ? 'bg-purple-500' : 'bg-red-500'} text-white`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Projets "{tagProjectModal.tag}"</h3>
                <button onClick={() => setTagProjectModal(null)} className="p-1 hover:bg-white/20 rounded-lg">✕</button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Linked projects */}
              {linkedProjects.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Projets liés :</p>
                  <div className="space-y-2">
                    {linkedProjects.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50">
                        <a href={p.url} target="_blank" rel="noopener" className="font-medium text-gray-900 hover:text-blue-600 hover:underline text-sm flex items-center gap-1.5">{p.name} <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 100 100" fill="currentColor"><path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z"/><path fill="#fff" d="M61.35 36.293L31.523 38.18c-2.72.097-3.303.78-3.303 2.527v36.82c0 1.747.778 3.017 2.527 2.917l28.86-1.65c2.14-.097 2.917-1.167 2.917-2.72V38.82c0-1.553-.97-2.623-2.917-2.527h-.257zm-1.553 4.08v31.377l-23.61 1.36V42.233l23.61-1.86z"/></svg></a>
                        <button onClick={async () => {
                          const newArr = linkedProjects.filter(lp => lp.id !== p.id);
                          const newTagProjects = {...(conv.tag_projects || {})};
                          if (newArr.length === 0) {
                            delete newTagProjects[tagProjectModal.tag];
                            const newTags = (conv.tags || []).filter(t => t !== tagProjectModal.tag);
                            await api('update-status', 'POST', { jid: tagProjectModal.jid, tag_projects: newTagProjects, tags: newTags });
                          } else {
                            newTagProjects[tagProjectModal.tag] = newArr;
                            await api('update-status', 'POST', { jid: tagProjectModal.jid, tag_projects: newTagProjects });
                          }
                          loadConversations();
                          if (selectedJid === tagProjectModal.jid) loadMessages(tagProjectModal.jid);
                          if (newArr.length === 0) setTagProjectModal(null);
                        }} className="text-xs text-red-600 hover:underline">Délier</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available projects */}
              {availableProjects.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Projets disponibles :</p>
                  <div className="space-y-2">
                    {availableProjects.map(p => (
                      <button key={p.id} onClick={async () => {
                        const newArr = [...linkedProjects, { id: p.id, name: p.name, url: p.url }];
                        const newTagProjects = {...(conv?.tag_projects || {}), [tagProjectModal.tag]: newArr};
                        const newTags = (conv?.tags || []).includes(tagProjectModal.tag) ? conv.tags : [...(conv?.tags || []), tagProjectModal.tag];
                        await api('update-status', 'POST', { jid: tagProjectModal.jid, tag_projects: newTagProjects, tags: newTags });
                        loadConversations();
                        if (selectedJid === tagProjectModal.jid) loadMessages(tagProjectModal.jid);
                      }} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                        <p className="font-medium text-gray-900">{p.name}</p>
                        {p.niveau && <p className="text-xs text-gray-500">{p.niveau}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {linkedProjects.length === 0 && availableProjects.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">Aucun projet "{tagProjectModal.tag}" disponible</p>
              )}

              {/* Create new project button */}
              <button onClick={() => {
                setProjectForm({ name: '', type: tagProjectModal.tag, priority: 'À prioriser', niveau: '', contratId: null });
                setShowCreateOpp(true);
                setTagProjectModal(null);
              }} className={`w-full py-2 rounded-lg text-sm font-medium text-white ${tagProjectModal.tag === 'Gestion' ? 'bg-green-500 hover:bg-green-600' : tagProjectModal.tag === 'Lead' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-red-500 hover:bg-red-600'}`}>
                + Créer un projet {tagProjectModal.tag}
              </button>
            </div>
          </div>
        </div>
      );
    })()}

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

    {/* Reminder Modal */}
    {showReminderModal && selectedConv && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowReminderModal(false)}>
        <div className="bg-white rounded-xl w-full max-w-sm p-4 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">🔔 Rappel</h3>
            <button onClick={() => setShowReminderModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <p className="text-sm text-gray-600">Définir un rappel pour <strong>{getName(selectedConv)}</strong></p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Date</label>
              <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Heure</label>
              <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Note (optionnel)</label>
              <input type="text" value={reminderNote} onChange={e => setReminderNote(e.target.value)} placeholder="Ex: Relancer pour le devis..." className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            {selectedConv.reminder_at && (
              <button onClick={() => { clearReminderFor(selectedConv.jid); setShowReminderModal(false); }} className="flex-1 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 font-medium">Supprimer</button>
            )}
            <button onClick={() => saveReminder(selectedConv.jid)} disabled={!reminderDate} className="flex-1 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium">{selectedConv.reminder_at ? 'Modifier' : 'Définir'}</button>
          </div>
          {/* Quick options */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Raccourcis :</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Demain 9h', days: 1, time: '09:00' },
                { label: 'Dans 3j', days: 3, time: '09:00' },
                { label: 'Dans 1 sem', days: 7, time: '09:00' },
                { label: 'Dans 2 sem', days: 14, time: '09:00' },
              ].map(opt => {
                const d = new Date(); d.setDate(d.getDate() + opt.days);
                return <button key={opt.label} onClick={() => { setReminderDate(d.toISOString().split('T')[0]); setReminderTime(opt.time); }} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">{opt.label}</button>;
              })}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Floating Brain Mic Button - hidden on conversations2 */}
    {view !== 'conversations2' && (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={brainProcessing}
      className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse scale-110' : brainProcessing ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700 hover:scale-105'}`}
      title={isRecording ? 'Stop enregistrement' : 'Commande vocale'}
    >
      {brainProcessing ? (
        <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
      ) : isRecording ? (
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
      ) : (
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 2.76 2.24 5 5 5s5-2.24 5-5h2c0 4.08-3.06 7.44-7 7.93V19h4v2H8v-2h4v-3.07z"/></svg>
      )}
    </button>
    )}
    {/* Brain Result Toast (Global) - hidden on conversations2 */}
    {view !== 'conversations2' && brainResult && !selectedJid && (
      <div className={`fixed bottom-24 right-6 z-40 max-w-xs p-4 rounded-xl shadow-lg ${brainResult.error ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
        {brainResult.message || brainResult.error || 'Action effectuée'}
      </div>
    )}

    {/* Wakeup / Réveil Modal */}
    {showWakeupModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowWakeupModal(false)}>
        <div className="bg-white p-5 rounded-xl shadow-2xl w-80" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold mb-4">⏰ Programmer un Réveil</h3>
          <input type="text" placeholder="Message..." className="w-full p-2 border rounded-lg mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            value={wakeupData.message} onChange={e => setWakeupData({...wakeupData, message: e.target.value})} />
          <div className="flex gap-2 mb-4">
            <input type="date" className="flex-1 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" min={new Date().toISOString().split('T')[0]} value={wakeupData.date} onChange={e => setWakeupData({...wakeupData, date: e.target.value})} />
            <input type="time" className="w-24 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" value={wakeupData.time} onChange={e => setWakeupData({...wakeupData, time: e.target.value})} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowWakeupModal(false)} className="px-3 py-1.5 text-gray-500 text-sm hover:bg-gray-100 rounded-lg">Annuler</button>
            <button onClick={saveWakeup} disabled={!wakeupData.date || !wakeupData.time} className="px-3 py-1.5 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 disabled:opacity-50">Valider</button>
          </div>
        </div>
      </div>
    )}

    {/* Create Contact Modal */}
    {showCreateContactModal && selectedConv && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateContactModal(false)}>
        <div className="bg-white rounded-xl w-full max-w-sm p-4 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">👤 Créer un contact Notion</h3>
            <button onClick={() => setShowCreateContactModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Nom</label>
              <input type="text" value={createContactForm.name} onChange={e => setCreateContactForm({...createContactForm, name: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Téléphone</label>
              <input type="tel" value={createContactForm.phone} onChange={e => setCreateContactForm({...createContactForm, phone: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Email</label>
              <input type="email" value={createContactForm.email} onChange={e => setCreateContactForm({...createContactForm, email: e.target.value})} className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <button onClick={createAndLinkContact} disabled={creatingContact || !createContactForm.name} className="w-full py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-medium">{creatingContact ? 'Création...' : '✓ Créer et lier'}</button>
        </div>
      </div>
    )}

    {/* Link Existing Contact Modal */}
    {showLinkContactModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowLinkContactModal(false); setLinkSearchResults([]); setLinkSearchQuery(''); }}>
        <div className="bg-white rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">🔗 Lier un contact Notion</h3>
            <button onClick={() => { setShowLinkContactModal(false); setLinkSearchResults([]); setLinkSearchQuery(''); }} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="p-4">
            <div className="relative mb-3">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={linkSearchQuery} onChange={e => { setLinkSearchQuery(e.target.value); searchNotionContacts(e.target.value); }} placeholder="Rechercher par nom ou téléphone..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
            </div>
            {isSearchingContact && <div className="text-center text-gray-400 text-sm py-4">Recherche...</div>}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {linkSearchResults.map(contact => (
                <div key={contact.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {contact.phone && <span>{contact.phone}</span>}
                      {contact.email && <span>{contact.email}</span>}
                    </div>
                    {contact.statut?.length > 0 && <div className="flex gap-1 mt-1">{contact.statut.map(s => <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{s}</span>)}</div>}
                  </div>
                  <button onClick={() => handleLinkNotionContact(contact)} className="px-3 py-1.5 bg-indigo-500 text-white text-xs rounded-lg hover:bg-indigo-600 font-medium flex-shrink-0">Lier</button>
                </div>
              ))}
              {!isSearchingContact && linkSearchQuery.length >= 2 && linkSearchResults.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-gray-400 text-sm">Aucun contact trouvé</p>
                  <button onClick={() => { setShowLinkContactModal(false); setCreateContactForm({ name: linkSearchQuery, phone: selectedConv?.phone || '', email: selectedConv?.email || '' }); setShowCreateContactModal(true); setLinkSearchQuery(''); }} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">Créer un nouveau contact</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* DossierChat Modal */}
    {activeDossierChat && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
        <div className="bg-white rounded-xl w-[90vw] h-[85vh] overflow-hidden shadow-2xl">
          <DossierChat
            dossierId={activeDossierChat.id}
            dossierNom={activeDossierChat.nom}
            onClose={() => setActiveDossierChat(null)}
          />
        </div>
      </div>
    )}

    {/* Entity Detail Panels (global slide-overs) */}
    {entityPanel?.type === 'project' && (
      <ProjectDetailPanel
        projectId={entityPanel.id}
        onClose={() => setEntityPanel(null)}
        onOpenDossier={(dossierId) => setEntityPanel({ type: 'dossier', id: dossierId })}
        onOpenTask={(taskId) => setEntityPanel({ type: 'task', id: taskId })}
        onTaskUpdated={() => loadTasks()}
        onOpenConversation={(jid) => { setSelectedJid(jid); setView('detail'); setEntityPanel(null); }}
        onCreateContract={(opts) => setContractModal(opts || {})}
        conversations={conversations}
      />
    )}
    {entityPanel?.type === 'dossier' && (
      <DossierDetailPanel
        dossierId={entityPanel.id}
        onClose={() => setEntityPanel(null)}
        onOpenProject={(projectId) => setEntityPanel({ type: 'project', id: projectId })}
        onOpenTask={(taskId) => setEntityPanel({ type: 'task', id: taskId })}
        onOpenEntity={(type, id) => setEntityPanel({ type, id })}
        onOpenConversation={(jid) => { setSelectedJid(jid); setView('detail'); setEntityPanel(null); }}
        onCreateContract={(opts) => setContractModal(opts || {})}
        conversations={conversations}
      />
    )}
    {entityPanel?.type === 'task' && (
      <TaskDetailPanel
        taskId={entityPanel.id}
        onClose={() => setEntityPanel(null)}
        onOpenProject={(projectId) => setEntityPanel({ type: 'project', id: projectId })}
        onOpenDossier={(dossierId) => setEntityPanel({ type: 'dossier', id: dossierId })}
        onOpenTask={(taskId) => setEntityPanel({ type: 'task', id: taskId })}
        onTaskUpdated={() => loadTasks()}
      />
    )}
    {entityPanel?.type === 'contract' && (
      <ContractDetailPanel
        contractId={entityPanel.id}
        onClose={() => setEntityPanel(null)}
        onOpenDossier={(id) => setEntityPanel({ type: 'dossier', id })}
      />
    )}
    {/* Contract creation modal */}
    {contractModal && (
      <ContractFormModal
        isOpen={!!contractModal}
        onClose={() => setContractModal(null)}
        onSuccess={() => { setContractModal(null); window.dispatchEvent(new Event('contract-created')); }}
        defaultDossierId={contractModal.dossierId || ''}
        defaultDossierName={contractModal.dossierName || ''}
        defaultProjectId={contractModal.projectId || ''}
        defaultCompagnieId={contractModal.compagnieId || ''}
        defaultCompagnieName={contractModal.compagnieName || ''}
        defaultSouscripteurId={contractModal.souscripteurId || ''}
      />
    )}
    {/* ─── Modal global création projet (fonctionne depuis Dashboard) ─── */}
    {showCreateOpp && !selectedJid && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              {projectForm.type === 'Lead' ? '🩷 Nouveau Lead' :
               projectForm.type === 'Gestion' ? '🟢 Nouvelle Gestion' :
               '🔵 Nouveau Sinistre'}
            </h3>
            <button onClick={() => setShowCreateOpp(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          <input type="text" placeholder="Nom du projet..." value={projectForm.name}
            onChange={e => setProjectForm({...projectForm, name: e.target.value})}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400" autoFocus />

          <div className="flex gap-2 mb-3">
            <select value={projectForm.type} onChange={e => setProjectForm({...projectForm, type: e.target.value})}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
              <option value="Lead">🩷 Lead</option>
              <option value="Gestion">🟢 Gestion</option>
              <option value="Sinistre">🔵 Sinistre</option>
            </select>
            <select value={projectForm.priority} onChange={e => setProjectForm({...projectForm, priority: e.target.value})}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg">
              <option value="À prioriser">À prioriser</option>
              <option value="Haute">🔴 Haute</option>
              <option value="Moyenne">🟡 Moyenne</option>
              <option value="Basse">🟢 Basse</option>
            </select>
          </div>

          <select value={projectForm.niveau} onChange={e => setProjectForm({...projectForm, niveau: e.target.value})}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg mb-3">
            <option value="">Étape initiale...</option>
            {projectForm.type === 'Gestion' ? (
              <>
                <option value="Ouverture">📋 Ouverture</option>
                <option value="En cours">⚙️ En cours</option>
                <option value="Attente pièces">📎 Attente pièces</option>
                <option value="Attente tiers">⏳ Attente tiers</option>
                <option value="Résolution">✅ Résolution</option>
              </>
            ) : projectForm.type === 'Sinistre' ? (
              <>
                <option value="Déclaration">📝 Déclaration</option>
                <option value="Instruction">🔍 Instruction</option>
                <option value="Expertise">👁️ Expertise</option>
                <option value="Attente pièces">📎 Attente pièces</option>
                <option value="Indemnisation">💰 Indemnisation</option>
              </>
            ) : (
              <>
                <option value="Prise de connaissance">Prise de connaissance</option>
                <option value="Recueil d'infos">Recueil d'infos</option>
                <option value="Devis">Devis</option>
                <option value="Proposition">Proposition</option>
                <option value="Échange">Échange</option>
                <option value="Signature">Signature</option>
                <option value="Mise en place">Mise en place</option>
              </>
            )}
          </select>

          <button onClick={async () => {
            if (!projectForm.name) return;
            setNotionLoading(true);
            try {
              const r = await fetch('/api/notion/create-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: projectForm.name,
                  type: projectForm.type,
                  priority: projectForm.priority,
                  niveau: projectForm.niveau || null,
                }),
              });
              const d = await r.json();
              if (d.success) {
                setShowCreateOpp(false);
                setProjectForm({ name: '', type: 'Lead', priority: 'À prioriser', niveau: '', contratId: null });
                setNotionSuccess('Projet créé !');
                setTimeout(() => setNotionSuccess(null), 3000);
              } else {
                alert('Erreur: ' + (d.error || '?'));
              }
            } catch (e) { alert('Erreur: ' + e.message); }
            setNotionLoading(false);
          }} disabled={notionLoading || !projectForm.name}
            className="w-full py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 disabled:opacity-50 font-medium">
            {notionLoading ? 'Création...' : '✓ Créer'}
          </button>
        </div>
      </div>
    )}
  </div>);
}


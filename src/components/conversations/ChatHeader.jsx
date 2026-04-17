'use client';

import { useState, useEffect } from 'react';

// Status indicator colors for CRM
const STATUS_COLORS = {
  client: 'bg-emerald-500',
  assurance: 'bg-blue-500',
  prospect: 'bg-purple-500',
  apporteur: 'bg-amber-500',
  hsva: 'bg-gray-400',
  inbox: 'bg-slate-400',
};

const STATUS_LABELS = {
  client: 'Client',
  assurance: 'Assurance',
  prospect: 'Prospect',
  apporteur: 'Apporteur',
  hsva: 'HSVA',
  inbox: 'À classer',
};

// Get initials from name
function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

// Format "last seen" time
function formatLastSeen(timestamp) {
  if (!timestamp) return '';

  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return 'en ligne';
  if (mins < 60) return `vu(e) il y a ${mins} min`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vu(e) il y a ${hours}h`;

  const d = new Date(timestamp);
  return `vu(e) ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function ChatHeader({
  conversation,
  onBack,
  onToggleCRMPanel,
  onSearch,
  onMenu,
  onAddTask,
  onAddProject,
  onShowDocuments,
  onToggleSelection,
  onUpdateStatus,
  onLinkProject,
  onCollectAllToDrive,
  isCollecting = false,
  selectionMode = false,
  documentCount = 0,
  showCRMPanel = false,
  isMobile = false
}) {
  if (!conversation) return null;

  const {
    display_name,
    name,
    whatsapp_name,
    phone,
    avatar_initials,
    avatar_color = 'bg-gray-500',
    status,
    last_message_time,
    notion_dossier_id,
    notion_dossier_name
  } = conversation;

  const displayName = display_name || name || whatsapp_name || phone || 'Contact';
  const initials = avatar_initials || getInitials(displayName);
  const [localStatus, setLocalStatus] = useState(status || 'inbox');

  useEffect(() => {
    setLocalStatus(status || 'inbox');
  }, [status]);

  const statusColor = STATUS_COLORS[localStatus] || STATUS_COLORS.inbox;
  const statusLabel = STATUS_LABELS[localStatus] || 'À classer';
  const lastSeen = formatLastSeen(last_message_time);
  const hasDossier = !!notion_dossier_id;

  return (
    <div className="bg-white px-4 py-2 flex items-center gap-3 border-b border-gray-200 shadow-sm">
      {/* Back button (mobile) */}
      {isMobile && (
        <button
          onClick={onBack}
          className="p-1.5 -ml-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Avatar with status indicator */}
      <div className="relative flex-shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${avatar_color}`}>
          {initials}
        </div>
        {/* CRM Status dot */}
        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${statusColor}`} />
      </div>

      {/* Contact info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900 truncate">
            {displayName}
          </h2>
          <select
            value={localStatus}
            onChange={(e) => {
              const newStatus = e.target.value;
              setLocalStatus(newStatus);
              if (onUpdateStatus) {
                onUpdateStatus(newStatus);
              } else {
                // Direct API call as fallback if callback not wired
                const jid = conversation?.jid;
                if (jid) {
                  fetch('/api/whatsapp/update-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jid, status: newStatus })
                  }).then(() => window.location.reload());
                }
              }
            }}
            className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor} text-white border-0 cursor-pointer appearance-auto`}
          >
            {Object.entries(STATUS_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
          {hasDossier && (
            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">
              📁 {notion_dossier_name || 'Dossier'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {phone && <span>{phone}</span>}
          {lastSeen && <span>· {lastSeen}</span>}
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
        {/* Quick add task */}
        <button
          onClick={onAddTask}
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
          title="Ajouter une tâche"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Tâche
        </button>

        {/* Quick add project */}
        <button
          onClick={(e) => { e.stopPropagation(); if (onAddProject) onAddProject(); else window.dispatchEvent(new Event('open-project-modal')); }}
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
          title="Créer un nouveau projet"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Projet
        </button>
        {/* Link existing project */}
        <button
          onClick={(e) => { e.stopPropagation(); if (onLinkProject) onLinkProject(); else window.dispatchEvent(new Event('open-link-project-modal')); }}
          className="flex items-center gap-1 px-1.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          title="Lier un projet existant"
        >
          🔗
        </button>
      </div>

      {/* Other action buttons */}
      <div className="flex items-center gap-0.5">
        {/* Show documents */}
        <button
          onClick={onShowDocuments}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors relative"
          title="Documents"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          {documentCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {documentCount}
            </span>
          )}
        </button>

        {/* Collect all docs to A TRIER */}
        <button
          onClick={onCollectAllToDrive}
          disabled={isCollecting}
          className={`p-2 rounded-full transition-colors ${isCollecting ? 'bg-blue-100 text-blue-600 animate-pulse' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
          title="Envoyer tous les docs vers A TRIER"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </button>

        {/* Select documents */}
        <button
          onClick={onToggleSelection}
          className={`p-2 rounded-full transition-colors ${selectionMode ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Sélectionner des documents"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Search in conversation */}
        <button
          onClick={onSearch}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          title="Rechercher"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {/* Toggle CRM Panel */}
        <button
          onClick={onToggleCRMPanel}
          className={`p-2 rounded-full transition-colors ${
            showCRMPanel
              ? 'bg-indigo-100 text-indigo-600'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
          title={showCRMPanel ? 'Masquer le panneau CRM' : 'Afficher le panneau CRM'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>

        {/* Menu */}
        <button
          onClick={onMenu}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          title="Menu"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 7a2 2 0 100-4 2 2 0 000 4zm0 7a2 2 0 100-4 2 2 0 000 4zm0 7a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export { STATUS_COLORS, getInitials, formatLastSeen };

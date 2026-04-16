'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import ClaudeButton from '@/components/shared/ClaudeButton';
import AiNotesPanel from '@/components/shared/AiNotesPanel';

// Status options for dropdown
const STATUSES = [
  { id: 'inbox', label: 'À classer', color: 'bg-slate-500' },
  { id: 'prospect', label: 'Prospect', color: 'bg-purple-500' },
  { id: 'client', label: 'Client', color: 'bg-emerald-500' },
  { id: 'assurance', label: 'Assurance', color: 'bg-blue-500' },
  { id: 'apporteur', label: 'Apporteur', color: 'bg-amber-500' },
  { id: 'hsva', label: 'HSVA', color: 'bg-gray-400' },
];

// Section component with collapse functionality
function Section({ title, icon, children, defaultOpen = true, badge = null }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-400">{icon}</span>}
          <span className="font-medium text-[#111b21] text-sm">{title}</span>
          {badge !== null && (
            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// Contact section - Compact version
function ContactSection({ conversation, notionEmail, onUpdateStatus, onUpdateName, onUpdateEmail, onUpdatePhone, onLinkEmail }) {
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [localStatus, setLocalStatus] = useState(conversation?.status || 'inbox');

  useEffect(() => {
    setNameValue(conversation?.custom_name || conversation?.display_name || '');
    setEmailValue(conversation?.email || '');
    setLocalStatus(conversation?.status || 'inbox');
  }, [conversation]);

  if (!conversation) return null;

  const currentStatus = STATUSES.find(s => s.id === conversation.status) || STATUSES[0];
  const phone = conversation.phone || conversation.jid?.split('@')[0] || '-';
  const hasNotionEmail = !!notionEmail && notionEmail !== conversation.email;

  return (
    <div className="space-y-2">
      {/* Status + Name on same row */}
      <div className="flex gap-2">
        <div className="w-28 flex-shrink-0">
          <select
            value={localStatus}
            onChange={(e) => {
              const newStatus = e.target.value;
              setLocalStatus(newStatus);
              if (onUpdateStatus) {
                onUpdateStatus(newStatus);
              } else {
                const jid = conversation?.jid;
                if (jid) {
                  fetch('/api/whatsapp/update-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jid, status: newStatus })
                  });
                }
              }
            }}
            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          >
            {STATUSES.map(status => (
              <option key={status.id} value={status.id}>{status.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          {editingName ? (
            <div className="flex gap-1">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onUpdateName?.(nameValue); setEditingName(false); }
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                placeholder="Nom..."
                autoFocus
              />
              <button onClick={() => { onUpdateName?.(nameValue); setEditingName(false); }} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">✓</button>
            </div>
          ) : (
            <div onClick={() => setEditingName(true)} className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs cursor-pointer hover:bg-gray-100 truncate">
              {conversation.custom_name || conversation.display_name || 'Nom...'}
            </div>
          )}
        </div>
      </div>

      {/* Phone + Email on same row */}
      <div className="flex gap-2 text-xs">
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded border border-gray-100 flex-1 min-w-0">
          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span className="text-gray-600 truncate">{phone}</span>
        </div>
        <div className="flex-1 min-w-0">
          {editingEmail ? (
            <div className="flex gap-1">
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onUpdateEmail?.(emailValue); setEditingEmail(false); }
                  if (e.key === 'Escape') setEditingEmail(false);
                }}
                className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                placeholder="email@..."
                autoFocus
              />
              <button onClick={() => { onUpdateEmail?.(emailValue); setEditingEmail(false); }} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">✓</button>
            </div>
          ) : (
            <div onClick={() => setEditingEmail(true)} className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded border border-gray-100 cursor-pointer hover:bg-gray-100">
              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className={`truncate ${conversation.email ? 'text-gray-600' : 'text-gray-400'}`}>
                {conversation.email || 'Email...'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Suggest Notion email if different */}
      {hasNotionEmail && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
          <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-amber-800 flex-1 truncate">Email Notion: {notionEmail}</span>
          <button
            onClick={() => onLinkEmail?.(notionEmail)}
            className="px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] hover:bg-amber-700 flex-shrink-0"
          >
            Utiliser
          </button>
        </div>
      )}
    </div>
  );
}

// Dossier section
function DossierSection({ dossier, onLink, onUnlink, isLoading }) {
  if (!dossier) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-[#667781] mb-3">Aucun dossier lié</p>
        <button
          onClick={onLink}
          disabled={isLoading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          🔗 Lier un dossier
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-indigo-600">📁</span>
          <div>
            <p className="text-sm font-medium text-indigo-900">{dossier.name}</p>
            {dossier.identifiant && (
              <p className="text-xs text-indigo-600">{dossier.identifiant}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {dossier.url && (
            <a
              href={dossier.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg"
              title="Ouvrir dans Notion"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// Lead stage colors and order
const STAGE_COLORS = {
  'Prise de connaissance': 'bg-slate-100 text-slate-700',
  "Recueil d'infos": 'bg-amber-100 text-amber-700',
  'Devis': 'bg-blue-100 text-blue-700',
  'Proposition': 'bg-indigo-100 text-indigo-700',
  'Échange': 'bg-purple-100 text-purple-700',
  'Signature': 'bg-pink-100 text-pink-700',
  'Mise en place': 'bg-emerald-100 text-emerald-700',
  'Gagné': 'bg-green-100 text-green-700',
  'Perdu': 'bg-red-100 text-red-700',
};
const STAGES_ORDER = ['Prise de connaissance', "Recueil d'infos", 'Devis', 'Proposition', 'Échange', 'Signature', 'Mise en place', 'Gagné'];

// Contracts section — affiche les contrats du dossier lié
function ContractsSection({ contracts = [], onOpenContract, isLoading }) {
  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-10 bg-gray-100 rounded-lg" />
        <div className="h-10 bg-gray-100 rounded-lg" />
      </div>
    );
  }
  if (contracts.length === 0) {
    return <p className="text-sm text-[#667781] py-2">Aucun contrat</p>;
  }
  return (
    <div className="space-y-1.5">
      {contracts.map(c => (
        <button
          key={c.id}
          onClick={() => onOpenContract?.(c.id)}
          className="w-full text-left border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[#111b21] truncate">{c.name}</span>
            <span className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded-full ${c.desactive ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {c.desactive ? 'Résilié' : 'Actif'}
            </span>
          </div>
          {(c.productType || c.type_assurance || c.cie_details) && (
            <div className="text-xs text-gray-500 mt-0.5 truncate">
              {c.productType || c.type_assurance}{c.cie_details ? ` · ${c.cie_details}` : ''}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// Projects section
function ProjectsSection({ projects = [], onCreateProject, onToggleTask, onOpenTask, isLoading }) {
  const [expandedProject, setExpandedProject] = useState(null);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-12 bg-gray-100 rounded-lg" />
        <div className="h-12 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-[#667781] mb-3">Aucun projet</p>
        <button
          onClick={onCreateProject}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
        >
          + Nouveau projet
        </button>
      </div>
    );
  }

  const TYPE_COLORS = {
    Lead: 'bg-purple-100 text-purple-700 border-purple-200',
    Sinistre: 'bg-red-100 text-red-700 border-red-200',
    Gestion: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <div className="space-y-2">
      {projects.map(project => (
        <div key={project.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs px-2 py-0.5 rounded border ${TYPE_COLORS[project.type] || 'bg-gray-100'}`}>
                {project.type || 'Projet'}
              </span>
              <span className="text-sm font-medium text-[#111b21] truncate">{project.name}</span>
              {project.type === 'Lead' && (project.niveau || project.level) && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${STAGE_COLORS[project.niveau || project.level] || 'bg-gray-100 text-gray-700'}`}>
                  {project.niveau || project.level}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {project.type === 'Lead' && (project.niveau || project.level) && (() => {
                const currentStage = project.niveau || project.level;
                const idx = STAGES_ORDER.indexOf(currentStage);
                if (idx >= 0 && idx < STAGES_ORDER.length - 1) {
                  const nextStage = STAGES_ORDER[idx + 1];
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetch('/api/notion/update-project-stage', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ projectId: project.id, stage: nextStage }),
                        });
                      }}
                      className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors whitespace-nowrap"
                      title={`Avancer vers : ${nextStage}`}
                    >
                      Avancer →
                    </button>
                  );
                }
                return null;
              })()}
              {project.tasks?.length > 0 && (
                <span className="text-xs text-[#667781]">
                  {project.tasks.filter(t => t.completed).length}/{project.tasks.length}
                </span>
              )}
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedProject === project.id ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* Tasks */}
          {expandedProject === project.id && project.tasks?.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-2 space-y-1 bg-gray-50">
              {project.tasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-start gap-2 py-1 hover:bg-white px-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => onToggleTask?.(task.id, !task.completed)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <button
                    onClick={() => onOpenTask?.(task)}
                    className={`text-sm text-left hover:underline ${task.completed ? 'text-gray-400 line-through' : 'text-[#3b4a54]'}`}
                  >
                    {task.name}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={onCreateProject}
        className="w-full px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <span>+</span> Nouveau projet
      </button>
    </div>
  );
}

// Documents section
function DocumentsSection({ documents = [], onPreview }) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-[#667781] text-center py-4">
        Aucun document partagé
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {documents.slice(0, 5).map(doc => (
        <div
          key={doc.id}
          onClick={() => onPreview?.(doc)}
          className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <div className="w-8 h-8 rounded flex items-center justify-center bg-red-100 text-red-600 text-xs font-bold flex-shrink-0">
            {doc.mimetype?.includes('pdf') ? 'PDF' : 'DOC'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#111b21] truncate">{doc.filename || 'Document'}</p>
            <p className="text-xs text-[#667781]">
              {new Date(doc.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
      ))}
      {documents.length > 5 && (
        <p className="text-xs text-center text-[#667781]">
          +{documents.length - 5} autres documents
        </p>
      )}
    </div>
  );
}

// Notes section
function NotesSection({ notes, onUpdateNotes }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(notes || '');

  useEffect(() => {
    setValue(notes || '');
  }, [notes]);

  return (
    <div>
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            rows={4}
            placeholder="Ajouter des notes..."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                onUpdateNotes?.(value);
                setIsEditing(false);
              }}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-100 min-h-[80px]"
        >
          {notes || <span className="text-[#667781]">Ajouter des notes...</span>}
        </div>
      )}
    </div>
  );
}

// Claude IA section — bouton Claude + Notes IA
function ClaudeSection({ conversation }) {
  const dossierId = conversation?.notion_dossier_id;
  const dossierName = conversation?.notion_dossier_name || '';
  if (!dossierId) return <p className="text-xs text-[#667781]">Liez un dossier pour activer Claude IA.</p>;
  return (
    <div className="space-y-3">
      <ClaudeButton dossierId={dossierId} dossierName={dossierName} />
      <AiNotesPanel dossierId={dossierId} />
    </div>
  );
}

// Linked conversation section (dedup)
function LinkedConversationSection({ conversation, allConversations = [], onLink, onUnlink }) {
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState(false);

  const linkedJid = conversation?.linked_jid;
  const linkedConv = linkedJid ? allConversations.find(c => c.jid === linkedJid) : null;
  const linkedName = linkedConv?.display_name || linkedConv?.name || linkedConv?.whatsapp_name || linkedConv?.phone || linkedJid;

  const searchResults = useMemo(() => {
    if (!search.trim() || !showSearch) return [];
    const q = search.toLowerCase();
    return allConversations
      .filter(c => c.jid !== conversation.jid && c.jid !== linkedJid)
      .filter(c => {
        const name = (c.display_name || c.name || c.whatsapp_name || c.phone || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 8);
  }, [search, showSearch, allConversations, conversation?.jid, linkedJid]);

  const handleLink = useCallback(async (targetJid) => {
    setLinking(true);
    try {
      await onLink?.(conversation.jid, targetJid);
      setShowSearch(false);
      setSearch('');
    } catch (e) { console.error(e); }
    setLinking(false);
  }, [conversation?.jid, onLink]);

  const handleUnlink = useCallback(async () => {
    setLinking(true);
    try { await onUnlink?.(conversation.jid); } catch (e) { console.error(e); }
    setLinking(false);
  }, [conversation?.jid, onUnlink]);

  if (linkedJid) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm">🔗</span>
            <span className="text-sm font-medium text-blue-800 truncate">{linkedName}</span>
          </div>
          <button
            onClick={handleUnlink}
            disabled={linking}
            className="text-xs text-red-600 hover:underline flex-shrink-0"
          >
            {linking ? '...' : 'Délier'}
          </button>
        </div>
        <p className="text-xs text-gray-500">Cette conversation est liée. Les deux partagent le même dossier.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
        >
          🔗 Lier à un autre contact
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou numéro..."
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={() => { setShowSearch(false); setSearch(''); }}
              className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {searchResults.map(c => (
                <button
                  key={c.jid}
                  onClick={() => handleLink(c.jid)}
                  disabled={linking}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {c.display_name || c.name || c.whatsapp_name || c.phone}
                  </p>
                  {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                </button>
              ))}
            </div>
          )}
          {search.trim() && searchResults.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-2">Aucun résultat</p>
          )}
        </div>
      )}
    </div>
  );
}

// Main CRM Panel component
export default function CRMPanel({
  conversation,
  dossierDetails,
  documents = [],
  messages = [],
  allConversations = [],
  isLoading = false,
  onClose,
  onUpdateStatus,
  onUpdateName,
  onUpdateEmail,
  onUpdatePhone,
  onUpdateNotes,
  onLinkDossier,
  onUnlinkDossier,
  onCreateProject,
  onCreateTask,
  onToggleTask,
  onOpenTask,
  onPreviewDoc,
  onLinkConversation,
  onUnlinkConversation,
  onOpenContract,
}) {
  if (!conversation) return null;

  const dossier = dossierDetails?.dossier || (conversation.notion_dossier_id ? {
    id: conversation.notion_dossier_id,
    name: conversation.notion_dossier_name,
    url: conversation.notion_dossier_url
  } : null);

  const projects = dossierDetails?.projects || [];
  const contracts = dossierDetails?.contracts || [];

  // Get email from Notion contact or dossier
  const notionEmail = dossierDetails?.contact?.email || dossierDetails?.dossier?.email || null;

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <h2 className="font-semibold text-gray-800 text-sm">Fiche Contact</h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Contact - No title, more compact */}
        <div className="px-3 py-3 border-b border-gray-100">
          <ContactSection
            conversation={conversation}
            notionEmail={notionEmail}
            onUpdateStatus={onUpdateStatus}
            onUpdateName={onUpdateName}
            onUpdateEmail={onUpdateEmail}
            onUpdatePhone={onUpdatePhone}
            onLinkEmail={(email) => onUpdateEmail?.(email)}
          />
        </div>

        {/* Dossier Notion */}
        <Section
          title="Dossier Notion"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
        >
          <DossierSection
            dossier={dossier}
            onLink={onLinkDossier}
            onUnlink={onUnlinkDossier}
            isLoading={isLoading}
          />
        </Section>

        {/* Projects */}
        {dossier && (
          <Section
            title="Projets"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
            badge={projects.length || null}
          >
            <ProjectsSection
              projects={projects}
              onCreateProject={onCreateProject}
              onToggleTask={onToggleTask}
              onOpenTask={onOpenTask}
              isLoading={isLoading}
            />
          </Section>
        )}

        {/* Contrats */}
        {dossier && (
          <Section
            title="Contrats"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            badge={contracts.length || null}
          >
            <ContractsSection
              contracts={contracts}
              onOpenContract={onOpenContract}
              isLoading={isLoading}
            />
          </Section>
        )}

        {/* Documents */}
        <Section
          title="Documents"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
          badge={documents.length || null}
          defaultOpen={false}
        >
          <DocumentsSection documents={documents} onPreview={onPreviewDoc} />
        </Section>

        {/* Notes */}
        <Section
          title="Notes"
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
          defaultOpen={false}
        >
          <NotesSection notes={conversation.notes} onUpdateNotes={onUpdateNotes} />
        </Section>

        {/* Claude IA */}
        <Section
          title="Claude IA"
          icon={<span className="text-sm">💬</span>}
          defaultOpen={!!conversation?.notion_dossier_id}
        >
          <ClaudeSection conversation={conversation} />
        </Section>

        {/* Linked conversation (dedup) */}
        <Section
          title={conversation.linked_jid ? 'Conversation liée' : 'Doublons'}
          icon={<span className="text-sm">🔗</span>}
          defaultOpen={!!conversation.linked_jid}
        >
          <LinkedConversationSection
            conversation={conversation}
            allConversations={allConversations}
            onLink={onLinkConversation}
            onUnlink={onUnlinkConversation}
          />
        </Section>
      </div>
    </div>
  );
}

export { Section, ContactSection, DossierSection, ProjectsSection, DocumentsSection, NotesSection, LinkedConversationSection };

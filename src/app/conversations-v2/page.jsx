'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ConversationLayout } from '@/components/conversations';

// API helper
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/whatsapp/${path}`, opts);
  return res.json();
}

export default function ConversationsV2Page() {
  // State
  const [allConversations, setAllConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [dossierDetails, setDossierDetails] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [currentUser, setCurrentUser] = useState('');

  // Loading states
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingDossier, setIsLoadingDossier] = useState(false);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeTimeFilter, setActiveTimeFilter] = useState(null);

  // Recording/sending state
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState(null);

  // Refs for recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const eventSourceRef = useRef(null);

  // Filter conversations: active vs archived (HSVA)
  const conversations = useMemo(() => {
    if (showArchived) {
      return allConversations.filter(c => c.status === 'hsva');
    }
    return allConversations.filter(c => c.status !== 'hsva');
  }, [allConversations, showArchived]);

  // Count archived
  const archivedCount = useMemo(() => {
    return allConversations.filter(c => c.status === 'hsva').length;
  }, [allConversations]);

  // Check if user is Jeremy (can see archives)
  const canSeeArchives = currentUser.toLowerCase() === 'jeremy';

  // Load conversations
  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const data = await api('conversations');
      setAllConversations(data.conversations || []);
    } catch (e) {
      console.error('Load conversations error:', e);
    }
    setIsLoadingConversations(false);
  }, []);

  // Load messages for a conversation
  const loadMessages = useCallback(async (jid) => {
    setIsLoadingMessages(true);
    try {
      const data = await api(`messages/${encodeURIComponent(jid)}`);
      setSelectedMessages(data.messages || []);
      setDocuments(data.documents || []);

      // Update selected conversation with fresh data
      if (data.conversation) {
        setSelectedConversation(prev => ({ ...prev, ...data.conversation }));
      }
    } catch (e) {
      console.error('Load messages error:', e);
    }
    setIsLoadingMessages(false);
  }, []);

  // Load dossier details
  const loadDossierDetails = useCallback(async (dossierId) => {
    if (!dossierId) {
      setDossierDetails(null);
      return;
    }
    setIsLoadingDossier(true);
    try {
      const res = await fetch(`/api/notion/dossier-details?dossierId=${encodeURIComponent(dossierId)}`);
      const data = await res.json();
      setDossierDetails(data.error ? null : data);
    } catch (e) {
      console.error('Load dossier error:', e);
      setDossierDetails(null);
    }
    setIsLoadingDossier(false);
  }, []);

  // Check connection status
  const checkStatus = useCallback(async () => {
    try {
      const data = await api('status');
      setIsConnected(data.status === 'connected');
    } catch (e) {
      setIsConnected(false);
    }
  }, []);

  // Get current user from cookie
  useEffect(() => {
    const cookies = document.cookie.split(';');
    const userCookie = cookies.find(c => c.trim().startsWith('smartvalue_user='));
    if (userCookie) {
      setCurrentUser(decodeURIComponent(userCookie.split('=')[1]));
    }
  }, []);

  // Initial load
  useEffect(() => {
    checkStatus();
    loadConversations();

    // Set up SSE for real-time updates
    const setupSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource('/api/whatsapp/events');
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connection') {
            setIsConnected(data.status === 'connected');
          }

          if (data.type === 'message') {
            // Refresh conversations list
            loadConversations();

            // If the message is for the selected conversation, add it
            if (data.message?.conversation_jid === selectedConversation?.jid) {
              setSelectedMessages(prev => [...prev, data.message]);
            }
          }
        } catch (e) {
          console.error('SSE parse error:', e);
        }
      };

      es.onerror = () => {
        es.close();
        // Reconnect after 5 seconds
        setTimeout(setupSSE, 5000);
      };
    };

    setupSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [checkStatus, loadConversations]);

  // Handle conversation selection
  const handleSelectConversation = useCallback((conv) => {
    if (!conv) {
      setSelectedConversation(null);
      setSelectedMessages([]);
      setDossierDetails(null);
      setDocuments([]);
      return;
    }

    setSelectedConversation(conv);
    loadMessages(conv.jid);

    if (conv.notion_dossier_id) {
      loadDossierDetails(conv.notion_dossier_id);
    } else {
      setDossierDetails(null);
    }

    // Update URL
    const phone = conv.phone || conv.jid?.split('@')[0];
    window.history.pushState({}, '', `?contact=${phone}`);
  }, [loadMessages, loadDossierDetails]);

  // Send message
  const handleSendMessage = useCallback(async (jid, text) => {
    if (!text || !jid || isSending) return;

    setIsSending(true);

    // Optimistic update
    const optId = `opt_${Date.now()}`;
    const optimisticMsg = {
      id: optId,
      text,
      from_me: true,
      timestamp: Date.now(),
      message_type: 'text'
    };
    setSelectedMessages(prev => [...prev, optimisticMsg]);

    try {
      await api('send', 'POST', { jid, text });
      loadConversations();
    } catch (err) {
      // Remove optimistic message on error
      setSelectedMessages(prev => prev.filter(m => m.id !== optId));
      console.error('Send error:', err);
    }

    setIsSending(false);
  }, [isSending, loadConversations]);

  // Update conversation status
  const handleUpdateStatus = useCallback(async (status) => {
    if (!selectedConversation?.jid) return;

    try {
      await api('update-status', 'POST', { jid: selectedConversation.jid, status });
      setSelectedConversation(prev => ({ ...prev, status }));
      loadConversations();
    } catch (e) {
      console.error('Update status error:', e);
    }
  }, [selectedConversation, loadConversations]);

  // Update name
  const handleUpdateName = useCallback(async (name) => {
    if (!selectedConversation?.jid || !name?.trim()) return;

    try {
      await api('update-status', 'POST', { jid: selectedConversation.jid, custom_name: name.trim() });
      setSelectedConversation(prev => ({ ...prev, custom_name: name.trim(), display_name: name.trim() }));
      loadConversations();
    } catch (e) {
      console.error('Update name error:', e);
    }
  }, [selectedConversation, loadConversations]);

  // Update email
  const handleUpdateEmail = useCallback(async (email) => {
    if (!selectedConversation?.jid) return;

    try {
      await api('update-status', 'POST', { jid: selectedConversation.jid, email: email?.trim() || '' });
      setSelectedConversation(prev => ({ ...prev, email: email?.trim() || '' }));
    } catch (e) {
      console.error('Update email error:', e);
    }
  }, [selectedConversation]);

  // Update phone
  const handleUpdatePhone = useCallback(async (phone) => {
    if (!selectedConversation?.jid) return;

    try {
      await api('update-status', 'POST', { jid: selectedConversation.jid, phone: phone?.trim() || '' });
      setSelectedConversation(prev => ({ ...prev, phone: phone?.trim() || '' }));
    } catch (e) {
      console.error('Update phone error:', e);
    }
  }, [selectedConversation]);

  // Update notes
  const handleUpdateNotes = useCallback(async (notes) => {
    if (!selectedConversation?.jid) return;

    try {
      await api('update-status', 'POST', { jid: selectedConversation.jid, notes });
      setSelectedConversation(prev => ({ ...prev, notes }));
    } catch (e) {
      console.error('Update notes error:', e);
    }
  }, [selectedConversation]);

  // Link dossier
  const handleLinkDossier = useCallback(() => {
    // TODO: Open dossier search modal
    alert('TODO: Ouvrir la modal de recherche de dossier');
  }, []);

  // Create project
  const handleCreateProject = useCallback(() => {
    // TODO: Open create project modal
    alert('TODO: Ouvrir la modal de création de projet');
  }, []);

  // Quick add task (from header)
  const handleAddTask = useCallback(() => {
    const taskName = prompt('Nouvelle tâche :');
    if (!taskName?.trim()) return;

    // If there's a linked dossier, create task on dossier
    if (selectedConversation?.notion_dossier_id && dossierDetails?.projects?.length > 0) {
      // Use first project if available
      const project = dossierDetails.projects[0];
      fetch('/api/notion/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: taskName.trim(),
          projectId: project.id,
          dossierId: selectedConversation.notion_dossier_id
        })
      }).then(() => {
        loadDossierDetails(selectedConversation.notion_dossier_id);
        alert('✅ Tâche créée');
      }).catch(e => alert('Erreur: ' + e.message));
    } else {
      alert('Liez d\'abord un dossier Notion pour créer des tâches');
    }
  }, [selectedConversation, dossierDetails, loadDossierDetails]);

  // Quick add project (from header)
  const handleAddProject = useCallback(() => {
    if (!selectedConversation?.notion_dossier_id) {
      alert('Liez d\'abord un dossier Notion pour créer des projets');
      return;
    }

    const projectTypes = ['Lead', 'Sinistre', 'Gestion'];
    const typeChoice = prompt('Type de projet ?\n1. Lead\n2. Sinistre\n3. Gestion\n\nEntrez 1, 2 ou 3:');
    const typeIndex = parseInt(typeChoice) - 1;
    if (isNaN(typeIndex) || typeIndex < 0 || typeIndex > 2) return;

    const projectName = prompt(`Nom du projet ${projectTypes[typeIndex]} :`);
    if (!projectName?.trim()) return;

    fetch('/api/notion/create-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectName.trim(),
        type: projectTypes[typeIndex],
        dossierId: selectedConversation.notion_dossier_id
      })
    }).then(() => {
      loadDossierDetails(selectedConversation.notion_dossier_id);
      alert('✅ Projet créé');
    }).catch(e => alert('Erreur: ' + e.message));
  }, [selectedConversation, loadDossierDetails]);

  // Toggle task
  const handleToggleTask = useCallback(async (taskId, completed) => {
    try {
      await fetch('/api/notion/update-task-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, completed })
      });

      // Refresh dossier details
      if (selectedConversation?.notion_dossier_id) {
        loadDossierDetails(selectedConversation.notion_dossier_id);
      }
    } catch (e) {
      console.error('Toggle task error:', e);
    }
  }, [selectedConversation, loadDossierDetails]);

  // Preview document
  const handlePreviewDoc = useCallback((doc) => {
    setPreviewDoc(doc);
  }, []);

  // Voice recording
  const handleRecordStart = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // TODO: Send audio to brain for processing
        console.log('Audio recorded:', audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording error:', err);
      alert("Impossible d'accéder au microphone");
    }
  }, []);

  const handleRecordStop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
  }, []);

  return (
    <div className="h-screen bg-white">
      {/* Header - CRM style (indigo) */}
      <div className="h-12 bg-gradient-to-r from-indigo-600 to-purple-600 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <a href="/" className="text-white/80 hover:text-white" title="Retour au CRM">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654z"/>
              </svg>
            </div>
            <h1 className="text-white text-sm font-semibold">Conversations</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Archive toggle - Only for Jeremy */}
          {canSeeArchives && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showArchived
                  ? 'bg-white text-indigo-700'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              {showArchived ? 'Retour actifs' : `Archives (${archivedCount})`}
            </button>
          )}

          {/* Connection status */}
          <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-white' : 'text-white/60'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'Connecté' : 'Déconnecté'}
          </div>

          {/* Refresh */}
          <button
            onClick={() => loadConversations()}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
            title="Actualiser"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* User */}
          {currentUser && (
            <span className="text-xs text-white/70">{currentUser}</span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="h-[calc(100vh-3rem)]">
        <ConversationLayout
          // Data
          conversations={conversations}
          selectedConversation={selectedConversation}
          selectedMessages={selectedMessages}
          dossierDetails={dossierDetails}
          documents={documents}

          // Loading states
          isLoadingConversations={isLoadingConversations}
          isLoadingMessages={isLoadingMessages}
          isLoadingDossier={isLoadingDossier}

          // Connection
          isConnected={isConnected}

          // Callbacks
          onSelectConversation={handleSelectConversation}
          onSendMessage={handleSendMessage}
          onPreviewDoc={handlePreviewDoc}
          onRecordStart={handleRecordStart}
          onRecordStop={handleRecordStop}
          onAddTask={handleAddTask}
          onAddProject={handleAddProject}

          // CRM callbacks
          onUpdateStatus={handleUpdateStatus}
          onUpdateName={handleUpdateName}
          onUpdateEmail={handleUpdateEmail}
          onUpdatePhone={handleUpdatePhone}
          onUpdateNotes={handleUpdateNotes}
          onLinkDossier={handleLinkDossier}
          onCreateProject={handleCreateProject}
          onToggleTask={handleToggleTask}

          // Filters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          activeTimeFilter={activeTimeFilter}
          onTimeFilterChange={setActiveTimeFilter}

          // Recording/sending
          isRecording={isRecording}
          isSending={isSending}
        />
      </div>

      {/* Document preview modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${previewDoc.mimetype?.includes('pdf') ? 'bg-red-100' : 'bg-blue-100'}`}>
                  <span className={`text-xs font-bold ${previewDoc.mimetype?.includes('pdf') ? 'text-red-600' : 'text-blue-600'}`}>
                    {previewDoc.mimetype?.includes('pdf') ? 'PDF' : 'DOC'}
                  </span>
                </div>
                <span className="font-medium text-gray-900">{previewDoc.filename}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  download={previewDoc.filename}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Télécharger
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 min-h-[60vh]">
              {previewDoc.mimetype?.includes('pdf') ? (
                <iframe
                  src={previewDoc.url}
                  className="w-full h-full border-0"
                  style={{ minHeight: '60vh' }}
                  title={previewDoc.filename}
                />
              ) : previewDoc.mimetype?.startsWith('image/') ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.filename}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-500 mb-4">Aperçu non disponible</p>
                    <a
                      href={previewDoc.url}
                      download={previewDoc.filename}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Télécharger
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

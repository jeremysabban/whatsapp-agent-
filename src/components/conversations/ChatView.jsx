'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import SaveToDriveModal from './SaveToDriveModal';

export default function ChatView({
  conversation,
  messages = [],
  onSendMessage,
  onBack,
  onToggleCRMPanel,
  onPreviewDoc,
  onRecordStart,
  onRecordStop,
  onAddTask,
  onAddProject,
  onSaveToFolder,
  onCreateTaskFromDoc,
  onShowDocuments,
  onUpdateStatus,
  onLinkProject,
  showCRMPanel = false,
  isRecording = false,
  isSending = false,
  isConnected = true,
  isMobile = false,
  onLoadMoreMessages,
  hasMoreMessages = false,
  isLoadingMore = false
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState(null);

  // Bulk collect all docs to A TRIER
  const handleCollectAllToDrive = useCallback(async () => {
    if (!conversation?.jid || isCollecting) return;
    setIsCollecting(true);
    setCollectResult(null);
    try {
      const res = await fetch('/api/collector/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationJid: conversation.jid })
      });
      const data = await res.json();
      setCollectResult(data);
      setTimeout(() => setCollectResult(null), 5000);
    } catch (err) {
      setCollectResult({ error: err.message });
      setTimeout(() => setCollectResult(null), 5000);
    } finally {
      setIsCollecting(false);
    }
  }, [conversation?.jid, isCollecting]);

  // Toggle media selection
  const toggleMediaSelection = useCallback((messageId) => {
    setSelectedMediaIds(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  // Select all media messages
  const selectAllMedia = useCallback(() => {
    const mediaIds = new Set();
    messages.forEach(msg => {
      if (msg.message_type !== 'text' || msg.media_url) {
        mediaIds.add(msg.id);
      }
    });
    setSelectedMediaIds(mediaIds);
  }, [messages]);

  // Toggle selection mode
  const handleToggleSelection = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) {
        setSelectedMediaIds(new Set());
      }
      return !prev;
    });
  }, []);

  // Handle send message
  const handleSend = useCallback((text) => {
    if (onSendMessage && conversation?.jid) {
      onSendMessage(conversation.jid, text);
    }
  }, [onSendMessage, conversation?.jid]);

  // Handle search toggle
  const handleSearchToggle = useCallback(() => {
    setShowSearch(prev => !prev);
    if (showSearch) {
      setSearchQuery('');
    }
  }, [showSearch]);

  // Get display name for messages
  const contactName = conversation?.display_name ||
    conversation?.name ||
    conversation?.whatsapp_name ||
    conversation?.phone ||
    'Contact';

  // If no conversation selected
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-[#41525d] mb-2">WhatsApp Agent</h3>
          <p className="text-[#667781] max-w-sm">
            Sélectionnez une conversation pour afficher les messages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#efeae2] overflow-hidden relative">
      {/* Header */}
      <ChatHeader
        conversation={conversation}
        onBack={onBack}
        onToggleCRMPanel={onToggleCRMPanel}
        onSearch={handleSearchToggle}
        onMenu={() => {/* TODO: Show menu */}}
        onAddTask={onAddTask}
        onAddProject={onAddProject}
        onShowDocuments={onShowDocuments}
        onUpdateStatus={onUpdateStatus}
        onLinkProject={onLinkProject}
        onToggleSelection={handleToggleSelection}
        onCollectAllToDrive={handleCollectAllToDrive}
        isCollecting={isCollecting}
        selectionMode={selectionMode}
        showCRMPanel={showCRMPanel}
        isMobile={isMobile}
      />

      {/* Search bar (when active) */}
      {showSearch && (
        <div className="bg-white px-4 py-2 border-b border-gray-200 flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans la conversation..."
              className="w-full pl-9 pr-4 py-2 bg-[#f0f2f5] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]/50"
              autoFocus
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#54656f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={handleSearchToggle}
            className="p-2 text-[#54656f] hover:text-[#3b4a54] rounded-full hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        contactName={contactName}
        onPreviewDoc={onPreviewDoc}
        showActions={!!conversation?.notion_dossier_id}
        onSaveToFolder={onSaveToFolder}
        onCreateTaskFromDoc={onCreateTaskFromDoc}
        onLoadMore={onLoadMoreMessages}
        hasMoreMessages={hasMoreMessages}
        isLoadingMore={isLoadingMore}
        selectionMode={selectionMode}
        selectedMediaIds={selectedMediaIds}
        toggleMediaSelection={toggleMediaSelection}
      />

      {/* Connection status warning */}
      {!isConnected && (
        <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-700 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>WhatsApp déconnecté. Reconnectez-vous dans les paramètres.</span>
        </div>
      )}

      {/* Collect result notification */}
      {collectResult && (
        <div className={`absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-20 text-sm ${collectResult.error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {collectResult.error ? `❌ ${collectResult.error}` : `📂 ${collectResult.summary || 'Envoyé au Drive'}`}
        </div>
      )}

      {/* Floating selection action bar */}
      {selectionMode && selectedMediaIds.size > 0 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3 z-20">
          <span className="text-sm">{selectedMediaIds.size} sélectionnés</span>
          <button onClick={() => selectAllMedia()} className="text-xs text-gray-300 hover:text-white">Tout</button>
          <button onClick={() => setShowSaveModal(true)} className="px-3 py-1 bg-green-600 rounded-full text-sm hover:bg-green-700">Sauvegarder</button>
          <button onClick={handleCollectAllToDrive} disabled={isCollecting} className="px-3 py-1 bg-blue-600 rounded-full text-sm hover:bg-blue-700 disabled:opacity-50">
            {isCollecting ? '⏳ Envoi...' : '📂 Tout → A TRIER'}
          </button>
          <button onClick={() => { setSelectionMode(false); setSelectedMediaIds(new Set()); }} className="text-gray-400 hover:text-white text-sm">Annuler</button>
        </div>
      )}

      {/* Save to Drive modal */}
      {showSaveModal && (
        <SaveToDriveModal
          isOpen={showSaveModal}
          onClose={() => { setShowSaveModal(false); setSelectionMode(false); setSelectedMediaIds(new Set()); }}
          selectedMessages={messages.filter(m => selectedMediaIds.has(m.id))}
          dossierDriveUrl={conversation?.drive_url || ''}
          dossierName={conversation?.notion_dossier_name || ''}
          contactName={contactName}
          conversationJid={conversation?.jid}
        />
      )}

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onRecordStart={onRecordStart}
        onRecordStop={onRecordStop}
        isRecording={isRecording}
        isSending={isSending}
        disabled={!isConnected}
        placeholder={isConnected ? 'Tapez un message' : 'WhatsApp déconnecté'}
      />
    </div>
  );
}

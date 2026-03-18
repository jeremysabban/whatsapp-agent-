'use client';

import { useState, useCallback, useEffect } from 'react';
import ConversationList from './ConversationList';
import ChatView from './ChatView';
import CRMPanel from './CRMPanel';

export default function ConversationLayout({
  // Data
  conversations = [],
  selectedConversation,
  selectedMessages = [],
  dossierDetails,
  documents = [],

  // Loading states
  isLoadingConversations = false,
  isLoadingMessages = false,
  isLoadingDossier = false,

  // Connection state
  isConnected = true,

  // Callbacks
  onSelectConversation,
  onSendMessage,
  onPreviewDoc,
  onRecordStart,
  onRecordStop,

  // CRM callbacks
  onUpdateStatus,
  onUpdateName,
  onUpdateEmail,
  onUpdatePhone,
  onUpdateNotes,
  onLinkDossier,
  onUnlinkDossier,
  onCreateProject,
  onToggleTask,
  onAddTask,
  onAddProject,

  // Filters
  searchQuery = '',
  onSearchChange,
  activeFilter = 'all',
  onFilterChange,
  activeTimeFilter = null,
  onTimeFilterChange,

  // Recording/sending state
  isRecording = false,
  isSending = false,

  // Load more
  onLoadMoreMessages,
  hasMoreMessages = false,
  isLoadingMore = false
}) {
  const [showCRMPanel, setShowCRMPanel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-show CRM panel when dossier is linked
  useEffect(() => {
    if (selectedConversation?.notion_dossier_id && !isMobile) {
      setShowCRMPanel(true);
    }
  }, [selectedConversation?.jid, selectedConversation?.notion_dossier_id, isMobile]);

  // Toggle CRM panel
  const handleToggleCRMPanel = useCallback(() => {
    setShowCRMPanel(prev => !prev);
  }, []);

  // Handle conversation select
  const handleSelectConversation = useCallback((conv) => {
    onSelectConversation?.(conv);
    // On mobile, selecting a conversation should hide the list
    // CRM panel logic is handled by the parent
  }, [onSelectConversation]);

  // Handle back (mobile)
  const handleBack = useCallback(() => {
    onSelectConversation?.(null);
  }, [onSelectConversation]);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="flex h-full bg-white">
        {/* Show list or chat based on selection */}
        {!selectedConversation ? (
          <div className="w-full">
            <ConversationList
              conversations={conversations}
              selectedJid={null}
              onSelectConversation={handleSelectConversation}
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
              activeFilter={activeFilter}
              onFilterChange={onFilterChange}
              activeTimeFilter={activeTimeFilter}
              onTimeFilterChange={onTimeFilterChange}
              isLoading={isLoadingConversations}
            />
          </div>
        ) : (
          <div className="w-full flex flex-col">
            <ChatView
              conversation={selectedConversation}
              messages={selectedMessages}
              onSendMessage={onSendMessage}
              onBack={handleBack}
              onToggleCRMPanel={handleToggleCRMPanel}
              onPreviewDoc={onPreviewDoc}
              onRecordStart={onRecordStart}
              onRecordStop={onRecordStop}
              onAddTask={onAddTask}
              onAddProject={onAddProject}
              showCRMPanel={showCRMPanel}
              isRecording={isRecording}
              isSending={isSending}
              isConnected={isConnected}
              isMobile={true}
              onLoadMoreMessages={onLoadMoreMessages}
              hasMoreMessages={hasMoreMessages}
              isLoadingMore={isLoadingMore}
            />

            {/* CRM Panel as overlay on mobile */}
            {showCRMPanel && (
              <div className="fixed inset-0 z-50 flex">
                <div className="flex-1 bg-black/50" onClick={() => setShowCRMPanel(false)} />
                <div className="w-80 h-full">
                  <CRMPanel
                    conversation={selectedConversation}
                    dossierDetails={dossierDetails}
                    documents={documents}
                    isLoading={isLoadingDossier}
                    onClose={() => setShowCRMPanel(false)}
                    onUpdateStatus={onUpdateStatus}
                    onUpdateName={onUpdateName}
                    onUpdateEmail={onUpdateEmail}
                    onUpdatePhone={onUpdatePhone}
                    onUpdateNotes={onUpdateNotes}
                    onLinkDossier={onLinkDossier}
                    onUnlinkDossier={onUnlinkDossier}
                    onCreateProject={onCreateProject}
                    onToggleTask={onToggleTask}
                    onPreviewDoc={onPreviewDoc}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Desktop layout - 3 columns
  return (
    <div className="flex h-full bg-white">
      {/* Left: Conversation List (350px fixed) */}
      <div className="w-[350px] flex-shrink-0 border-r border-gray-200">
        <ConversationList
          conversations={conversations}
          selectedJid={selectedConversation?.jid}
          onSelectConversation={handleSelectConversation}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
          activeTimeFilter={activeTimeFilter}
          onTimeFilterChange={onTimeFilterChange}
          isLoading={isLoadingConversations}
        />
      </div>

      {/* Center: Chat View (flexible) */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatView
          conversation={selectedConversation}
          messages={selectedMessages}
          onSendMessage={onSendMessage}
          onBack={handleBack}
          onToggleCRMPanel={handleToggleCRMPanel}
          onPreviewDoc={onPreviewDoc}
          onRecordStart={onRecordStart}
          onRecordStop={onRecordStop}
          onAddTask={onAddTask}
          onAddProject={onAddProject}
          showCRMPanel={showCRMPanel}
          isRecording={isRecording}
          isSending={isSending}
          isConnected={isConnected}
          isMobile={false}
          onLoadMoreMessages={onLoadMoreMessages}
          hasMoreMessages={hasMoreMessages}
          isLoadingMore={isLoadingMore}
        />
      </div>

      {/* Right: CRM Panel (320px, toggle) */}
      {showCRMPanel && selectedConversation && (
        <div className="w-[320px] flex-shrink-0">
          <CRMPanel
            conversation={selectedConversation}
            dossierDetails={dossierDetails}
            documents={documents}
            isLoading={isLoadingDossier}
            onClose={() => setShowCRMPanel(false)}
            onUpdateStatus={onUpdateStatus}
            onUpdateName={onUpdateName}
            onUpdateEmail={onUpdateEmail}
            onUpdatePhone={onUpdatePhone}
            onUpdateNotes={onUpdateNotes}
            onLinkDossier={onLinkDossier}
            onUnlinkDossier={onUnlinkDossier}
            onCreateProject={onCreateProject}
            onToggleTask={onToggleTask}
            onPreviewDoc={onPreviewDoc}
          />
        </div>
      )}
    </div>
  );
}

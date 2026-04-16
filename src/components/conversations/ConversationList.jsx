'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ConversationListItem from './ConversationListItem';

// Filter options (base)
const BASE_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'unread', label: 'Non lus' },
  { id: 'client', label: 'Clients' },
  { id: 'assurance', label: 'Assurance' },
  { id: 'prospect', label: 'Prospects' },
  { id: 'apporteur', label: 'Apporteurs' },
  { id: 'inbox', label: 'À classer' },
];

const PERSO_FILTER = { id: 'perso', label: 'Perso' };

// Exported FILTERS includes perso for compatibility
const FILTERS = [...BASE_FILTERS, PERSO_FILTER];

// Time period filters
const TIME_FILTERS = [
  { id: null, label: 'Tout' },
  { id: '1h', label: '1h' },
  { id: '1j', label: '1j' },
  { id: '1sem', label: '1 sem' },
];

export default function ConversationList({
  conversations = [],
  selectedJid,
  onSelectConversation,
  onSearch,
  searchQuery = '',
  onSearchChange,
  activeFilter = 'all',
  onFilterChange,
  activeTimeFilter = null,
  onTimeFilterChange,
  isLoading = false
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [isJeremy, setIsJeremy] = useState(false);
  const [hideLinked, setHideLinked] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const searchRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => onSearchChange?.(localSearch), 200);
    return () => clearTimeout(id);
  }, [localSearch]);

  useEffect(() => {
    if (searchQuery !== localSearch && !document.activeElement?.isSameNode(searchRef.current)) {
      setLocalSearch(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('smartvalue_user='));
    setIsJeremy(cookie?.split('=')[1] === 'Jeremy');
  }, []);

  const visibleFilters = useMemo(() => {
    return isJeremy ? [...BASE_FILTERS, PERSO_FILTER] : BASE_FILTERS;
  }, [isJeremy]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => {
        const name = (c.display_name || c.name || c.whatsapp_name || c.phone || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        return name.includes(query) || phone.includes(query);
      });
    }

    // Status filter
    switch (activeFilter) {
      case 'unread':
        result = result.filter(c => c.unread_count > 0);
        break;
      case 'client':
        result = result.filter(c => c.status === 'client');
        break;
      case 'assurance':
        result = result.filter(c => c.status === 'assurance');
        break;
      case 'prospect':
        result = result.filter(c => c.status === 'prospect');
        break;
      case 'apporteur':
        result = result.filter(c => c.status === 'apporteur');
        break;
      case 'inbox':
        result = result.filter(c => c.status === 'inbox');
        break;
      case 'perso':
        result = result.filter(c => {
          const name = (c.display_name || c.name || c.whatsapp_name || '').toLowerCase();
          return c.status === 'perso' || name.includes('sabban') || name.includes('famille');
        });
        break;
      default:
        // 'all' - no additional filter
        break;
    }

    // Hide linked (duplicate) conversations
    if (hideLinked) {
      result = result.filter(c => !c.linked_jid);
    }

    // Sort by last message time (most recent first)
    result.sort((a, b) => (b.last_message_time || 0) - (a.last_message_time || 0));

    return result;
  }, [conversations, searchQuery, activeFilter, hideLinked]);

  // Count stats for filters
  const stats = useMemo(() => ({
    all: conversations.length,
    unread: conversations.filter(c => c.unread_count > 0).length,
    client: conversations.filter(c => c.status === 'client').length,
    assurance: conversations.filter(c => c.status === 'assurance').length,
    prospect: conversations.filter(c => c.status === 'prospect').length,
    apporteur: conversations.filter(c => c.status === 'apporteur').length,
    inbox: conversations.filter(c => c.status === 'inbox').length,
    perso: conversations.filter(c => {
      const name = (c.display_name || c.name || c.whatsapp_name || '').toLowerCase();
      return c.status === 'perso' || name.includes('sabban') || name.includes('famille');
    }).length,
  }), [conversations]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-[#f0f2f5]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[#111b21]">Discussions</h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-full transition-colors ${
              showFilters || activeFilter !== 'all'
                ? 'bg-[#00a884]/10 text-[#00a884]'
                : 'text-[#54656f] hover:bg-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Rechercher ou démarrer une discussion"
            className="w-full pl-10 pr-4 py-2 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]/50 border border-gray-200"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#54656f]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {visibleFilters.map(filter => (
              <button
                key={filter.id}
                onClick={() => onFilterChange?.(filter.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeFilter === filter.id
                    ? 'bg-[#00a884] text-white'
                    : 'bg-white text-[#54656f] hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {filter.label}
                {stats[filter.id] > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                    activeFilter === filter.id
                      ? 'bg-white/20'
                      : 'bg-gray-100'
                  }`}>
                    {stats[filter.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Time filters */}
        {showFilters && (
          <div className="flex gap-1.5 mt-2">
            {TIME_FILTERS.map(filter => (
              <button
                key={filter.id || 'all-time'}
                onClick={() => onTimeFilterChange?.(filter.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  activeTimeFilter === filter.id
                    ? 'bg-[#667781] text-white'
                    : 'bg-gray-100 text-[#667781] hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {/* Hide linked toggle */}
        {showFilters && conversations.some(c => c.linked_jid) && (
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideLinked}
              onChange={(e) => setHideLinked(e.target.checked)}
              className="rounded border-gray-300 text-[#00a884] focus:ring-[#00a884]"
            />
            <span className="text-xs text-[#667781]">Masquer les doublons liés</span>
          </label>
        )}
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          // Loading skeleton
          <div className="space-y-0">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-[#667781]">
              {searchQuery
                ? `Aucun résultat pour "${searchQuery}"`
                : 'Aucune conversation'
              }
            </p>
          </div>
        ) : (
          // Conversation list
          filteredConversations.map(conversation => (
            <ConversationListItem
              key={conversation.jid}
              conversation={conversation}
              isSelected={selectedJid === conversation.jid}
              onClick={onSelectConversation}
            />
          ))
        )}
      </div>

      {/* Stats footer */}
      <div className="px-4 py-2 bg-[#f0f2f5] border-t border-gray-200 text-center">
        <p className="text-xs text-[#667781]">
          {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''}
          {activeFilter !== 'all' && ` (filtre: ${FILTERS.find(f => f.id === activeFilter)?.label})`}
        </p>
      </div>
    </div>
  );
}

export { FILTERS, TIME_FILTERS };

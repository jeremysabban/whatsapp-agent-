'use client';

import { useState, useEffect } from 'react';

const TYPE_COLORS = {
  Lead: 'bg-blue-100 text-blue-700 border-blue-200',
  Sinistre: 'bg-red-100 text-red-700 border-red-200',
  Gestion: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

function Icon({ name, className = 'w-4 h-4' }) {
  const icons = {
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
    folder: <><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></>,
    project: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 7h10" /><path d="M7 12h10" /><path d="M7 17h10" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
  };
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icons[name]}</svg>);
}

// Cache global pour persister entre les changements de vue
const globalCache = globalThis.__dossierCache || (globalThis.__dossierCache = { dossiers: [], hasLoaded: false });

export default function DossierList({ onSelectDossier }) {
  const [dossiers, setDossiers] = useState(globalCache.dossiers);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);

  const loadDossiers = async (searchQuery = '', forceRefresh = false) => {
    // Si déjà chargé et pas de recherche/refresh, ne rien faire
    if (globalCache.hasLoaded && !searchQuery && !forceRefresh) {
      return;
    }
    setLoading(true);
    try {
      const url = searchQuery
        ? `/api/notion/dossiers?search=${encodeURIComponent(searchQuery)}`
        : '/api/notion/dossiers';
      const res = await fetch(url);
      const data = await res.json();
      const newDossiers = data.dossiers || [];
      setDossiers(newDossiers);
      if (!searchQuery) {
        globalCache.dossiers = newDossiers;
        globalCache.hasLoaded = true;
      }
    } catch (err) {
      console.error('Erreur chargement dossiers:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!globalCache.hasLoaded) {
      loadDossiers();
    }
  }, []);

  const handleSearch = (value) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      loadDossiers(value);
    }, 300));
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    // Clean and format French phone numbers
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
    return phone;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Search bar */}
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un dossier..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <button
            onClick={() => loadDossiers('', true)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? '...' : '🔄'}
          </button>
        </div>
      </div>

      {/* Dossiers list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : dossiers.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {search ? 'Aucun dossier trouvé' : 'Aucun dossier'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dossiers.map((dossier) => (
              <div
                key={dossier.id}
                onClick={() => onSelectDossier(dossier)}
                className="p-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-3"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {getInitials(dossier.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{dossier.name}</span>
                    {dossier.projectsCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs flex items-center gap-1">
                        <Icon name="project" className="w-3 h-3" />
                        {dossier.projectsCount}
                      </span>
                    )}
                  </div>
                  {dossier.phone && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                      <Icon name="phone" className="w-3 h-3" />
                      {formatPhone(dossier.phone)}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                {dossier.status && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    dossier.status === 'Client' ? 'bg-emerald-100 text-emerald-700' :
                    dossier.status === 'Prospect' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {dossier.status}
                  </span>
                )}

                {/* Chevron */}
                <Icon name="chevron" className="w-5 h-5 text-gray-400" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

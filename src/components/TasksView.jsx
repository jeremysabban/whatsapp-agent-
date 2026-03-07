'use client';

import { useState, useMemo, useEffect } from 'react';

const TYPE_COLORS = {
  Lead: { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  Sinistre: { bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
  Gestion: { bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' }
};

function Icon({ name, className = 'w-4 h-4' }) {
  const icons = {
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    folder: <><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></>,
    message: <><path strokeLinecap="round" strokeLinejoin="round" d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></>,
    bot: <><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></>,
    arrowDown: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronUp: <path d="m18 15-6-6-6 6" />,
    refresh: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></>,
  };
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icons[name]}</svg>);
}

export default function TasksView({ onOpenConversation, tasksData, tasksLastUpdate, tasksHasLoaded, onTasksLoaded }) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedDossiers, setExpandedDossiers] = useState({});
  const [togglingTaskId, setTogglingTaskId] = useState(null);
  const [newTaskModal, setNewTaskModal] = useState(null); // { dossierId, dossierName, projects: [] }
  const [newTaskName, setNewTaskName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Derive data from props
  const tasks = tasksData?.tasks || [];
  const groupedByDossier = tasksData?.groupedByDossier || [];
  const tasksWithoutDossier = tasksData?.tasksWithoutDossier || [];

  // Auto-load on first mount only if never loaded before
  useEffect(() => {
    if (!tasksHasLoaded && !loading) {
      loadTasks();
    }
  }, [tasksHasLoaded]);

  // Expand all dossiers when data changes
  useEffect(() => {
    if (groupedByDossier.length > 0) {
      const expanded = {};
      groupedByDossier.forEach(g => { expanded[g.dossier.id] = true; });
      setExpandedDossiers(expanded);
    }
  }, [tasksData]);

  const loadTasks = async (completed = showCompleted) => {
    setLoading(true);
    try {
      const url = completed ? '/api/notion/tasks?completed=true' : '/api/notion/tasks';
      const res = await fetch(url);
      const data = await res.json();
      onTasksLoaded(data);
    } catch (err) {
      console.error('Erreur chargement tâches:', err);
    }
    setLoading(false);
  };

  const toggleDossier = (dossierId) => {
    setExpandedDossiers(prev => ({
      ...prev,
      [dossierId]: !prev[dossierId]
    }));
  };

  const toggleTask = async (task, completed) => {
    if (togglingTaskId) return;
    setTogglingTaskId(task.id);

    // Optimistic update in parent state
    const updateTask = (t) => t.id === task.id ? { ...t, completed } : t;
    const updatedData = {
      ...tasksData,
      tasks: tasksData.tasks.map(updateTask),
      groupedByDossier: tasksData.groupedByDossier.map(g => ({
        ...g,
        tasks: g.tasks.map(updateTask)
      })),
      tasksWithoutDossier: tasksData.tasksWithoutDossier.map(updateTask)
    };
    onTasksLoaded(updatedData);

    try {
      const res = await fetch('/api/notion/update-task-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, completed })
      });

      if (!res.ok) {
        // Revert on error
        const revertTask = (t) => t.id === task.id ? { ...t, completed: !completed } : t;
        const revertedData = {
          ...tasksData,
          tasks: tasksData.tasks.map(revertTask),
          groupedByDossier: tasksData.groupedByDossier.map(g => ({
            ...g,
            tasks: g.tasks.map(revertTask)
          })),
          tasksWithoutDossier: tasksData.tasksWithoutDossier.map(revertTask)
        };
        onTasksLoaded(revertedData);
      }
    } catch (err) {
      console.error('Erreur toggle task:', err);
    }

    setTogglingTaskId(null);
  };

  const handleWhatsAppClick = (phone) => {
    if (phone && onOpenConversation) {
      const cleanPhone = phone.replace(/\D/g, '');
      onOpenConversation(cleanPhone);
    }
  };

  // Move dossier group to bottom of the list
  const moveDossierToBottom = (dossierId) => {
    if (!tasksData) return;

    const dossierGroup = tasksData.groupedByDossier.find(g => g.dossier.id === dossierId);
    if (!dossierGroup) return;

    const otherGroups = tasksData.groupedByDossier.filter(g => g.dossier.id !== dossierId);

    const updatedData = {
      ...tasksData,
      groupedByDossier: [...otherGroups, dossierGroup]
    };

    onTasksLoaded(updatedData);
  };

  // Open new task modal and fetch projects for the dossier
  const openNewTaskModal = async (dossierId, dossierName) => {
    setNewTaskModal({ dossierId, dossierName, projects: [] });
    setNewTaskName('');
    setSelectedProjectId('');
    setLoadingProjects(true);

    try {
      const res = await fetch(`/api/notion/dossiers/${dossierId}`);
      if (res.ok) {
        const data = await res.json();
        setNewTaskModal(prev => ({ ...prev, projects: data.projects || [] }));
      }
    } catch (err) {
      console.error('Erreur chargement projets:', err);
    }
    setLoadingProjects(false);
  };

  // Create a new task
  const createTask = async () => {
    if (!newTaskName.trim() || !newTaskModal) return;
    setCreatingTask(true);

    try {
      const res = await fetch('/api/notion/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTaskName.trim(),
          dossierId: newTaskModal.dossierId,
          projectId: selectedProjectId || null
        })
      });

      if (res.ok) {
        // Refresh tasks
        await loadTasks();
        setNewTaskModal(null);
        setNewTaskName('');
        setSelectedProjectId('');
      }
    } catch (err) {
      console.error('Erreur création tâche:', err);
    }

    setCreatingTask(false);
  };

  // Filter logic
  const filteredGroups = useMemo(() => {
    return groupedByDossier
      .map(group => {
        let filteredTasks = group.tasks;

        // Filter by search
        if (search) {
          const searchLower = search.toLowerCase();
          filteredTasks = filteredTasks.filter(t =>
            t.name.toLowerCase().includes(searchLower) ||
            t.project?.name?.toLowerCase().includes(searchLower) ||
            group.dossier.name.toLowerCase().includes(searchLower)
          );
        }

        // Filter by type
        if (typeFilter !== 'all') {
          filteredTasks = filteredTasks.filter(t => t.project?.type === typeFilter);
        }

        return { ...group, tasks: filteredTasks };
      })
      .filter(group => group.tasks.length > 0);
  }, [groupedByDossier, search, typeFilter]);

  const filteredOrphanTasks = useMemo(() => {
    let filtered = tasksWithoutDossier;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.project?.name?.toLowerCase().includes(searchLower)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.project?.type === typeFilter);
    }

    return filtered;
  }, [tasksWithoutDossier, search, typeFilter]);

  const totalFiltered = filteredGroups.reduce((acc, g) => acc + g.tasks.length, 0) + filteredOrphanTasks.length;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            Tâches {tasksData && `(${totalFiltered})`}
          </h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setShowCompleted(newValue);
                  loadTasks(newValue);
                }}
                className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
              />
              Terminées
            </label>
            {tasksLastUpdate && (
              <span className="text-xs text-gray-400">
                {tasksLastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={loadTasks}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
            >
              <Icon name="refresh" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une tâche..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Type filters */}
        <div className="flex gap-2">
          {['all', 'Lead', 'Sinistre', 'Gestion'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? 'Tous' : type === 'Lead' ? 'Leads' : type === 'Sinistre' ? 'Sinistres' : 'Gestions'}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : !tasksData ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : totalFiltered === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {search || typeFilter !== 'all' ? 'Aucune tâche trouvée' : 'Aucune tâche'}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Grouped by dossier */}
            {filteredGroups.map(group => {
              const isExpanded = expandedDossiers[group.dossier.id];
              const dossier = group.dossier;

              return (
                <div key={dossier.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {/* Dossier header */}
                  <div
                    onClick={() => toggleDossier(dossier.id)}
                    className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-lg">📁</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900">{dossier.name}</span>
                      <span className="ml-2 text-sm text-gray-500">({group.tasks.length})</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openNewTaskModal(dossier.id, dossier.name)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ajouter une tâche"
                      >
                        <Icon name="plus" className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => moveDossierToBottom(dossier.id)}
                        className="p-2 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Reporter (en bas de la liste)"
                      >
                        <Icon name="arrowDown" className="w-4 h-4 text-orange-500" />
                      </button>
                      {dossier.phone && (
                        <button
                          onClick={() => handleWhatsAppClick(dossier.phone)}
                          className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Ouvrir conversation WhatsApp"
                        >
                          <Icon name="message" className="w-4 h-4 text-emerald-600" />
                        </button>
                      )}
                      {dossier.geminiUrl && (
                        <a
                          href={dossier.geminiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Ouvrir Gemini"
                        >
                          <Icon name="bot" className="w-4 h-4 text-purple-600" />
                        </a>
                      )}
                    </div>

                    <Icon
                      name={isExpanded ? 'chevronUp' : 'chevronDown'}
                      className="w-5 h-5 text-gray-400"
                    />
                  </div>

                  {/* Tasks */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {group.tasks.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onToggle={toggleTask}
                          togglingTaskId={togglingTaskId}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Tasks without dossier */}
            {filteredOrphanTasks.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="p-3 bg-gray-50 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Sans dossier ({filteredOrphanTasks.length})</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {filteredOrphanTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={toggleTask}
                      togglingTaskId={togglingTaskId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {newTaskModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setNewTaskModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-lg text-gray-900">Nouvelle tâche</h3>
              <p className="text-sm text-gray-500 mt-1">📁 {newTaskModal.dossierName}</p>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="text"
                placeholder="Nom de la tâche..."
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loadingProjects && createTask()}
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Lier à un projet (optionnel)</label>
                {loadingProjects ? (
                  <div className="px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-400">
                    Chargement des projets...
                  </div>
                ) : newTaskModal.projects?.length > 0 ? (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  >
                    <option value="">Aucun projet</option>
                    {newTaskModal.projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.type ? `[${p.type}] ` : ''}{p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-400">
                    Aucun projet pour ce dossier
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setNewTaskModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={createTask}
                disabled={!newTaskName.trim() || creatingTask}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {creatingTask ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, togglingTaskId }) {
  const colors = TYPE_COLORS[task.project?.type] || { bg: 'bg-gray-50', badge: 'bg-gray-100 text-gray-600' };

  return (
    <div className={`px-4 py-3 flex items-start gap-3 hover:bg-gray-50 ${colors.bg}`}>
      <button
        onClick={() => onToggle(task, !task.completed)}
        disabled={togglingTaskId === task.id}
        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
          task.completed
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-gray-300 hover:border-emerald-500'
        } ${togglingTaskId === task.id ? 'opacity-50' : ''}`}
      >
        {task.completed && <Icon name="check" className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {task.name}
        </div>
        {task.project && (
          <div className="mt-1 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.badge}`}>
              {task.project.type}
            </span>
            <span className="text-xs text-gray-500">{task.project.name}</span>
          </div>
        )}
      </div>

      {task.date && (
        <span className="text-xs text-gray-400 flex-shrink-0">
          {new Date(task.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      )}

      <a
        href={task.url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
        title="Ouvrir dans Notion"
      >
        <Icon name="external" className="w-4 h-4 text-gray-400" />
      </a>
    </div>
  );
}

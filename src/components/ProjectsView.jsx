'use client';

import { useState, useMemo, useEffect } from 'react';

const TYPE_COLORS = {
  Lead: { bg: 'bg-purple-50', border: 'border-l-purple-500', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  Sinistre: { bg: 'bg-red-50', border: 'border-l-red-500', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  Gestion: { bg: 'bg-emerald-50', border: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' }
};

const PRIORITY_COLORS = {
  'Urg & Imp': 'text-red-600',
  'Urg & imp': 'text-red-600',
  'Important': 'text-orange-600',
  'Urgent': 'text-yellow-600',
  'Secondaire': 'text-gray-400',
  'En attente': 'text-blue-500',
  'À prioriser': 'text-gray-400'
};

function Icon({ name, className = 'w-4 h-4' }) {
  const icons = {
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    folder: <><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronUp: <path d="m18 15-6-6-6 6" />,
    refresh: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></>,
    project: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 7h10" /><path d="M7 12h10" /><path d="M7 17h10" /></>,
  };
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icons[name]}</svg>);
}

function getDateStatus(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = Math.floor((date - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'soon';
  return 'future';
}

export default function ProjectsView({ projectsData, projectsHasLoaded, onProjectsLoaded }) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilters, setTypeFilters] = useState({ Gestion: true, Lead: true, Sinistre: true });
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortBy, setSortBy] = useState('lastEdited'); // 'lastEdited', 'lastTaskAdded', 'lastTaskCompleted', 'nextDue', 'priority', 'name'
  const [expandedProjects, setExpandedProjects] = useState({});
  const [togglingTaskId, setTogglingTaskId] = useState(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState({});

  // New task creation state
  const [newTaskModal, setNewTaskModal] = useState(null); // { projectId, projectName }
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('À prioriser');
  const [creatingTask, setCreatingTask] = useState(false);

  const projects = projectsData?.projects || [];
  const stats = projectsData?.stats || {};

  // Load only on first access (manual refresh after)
  useEffect(() => {
    if (!projectsHasLoaded && !loading && projects.length === 0) {
      loadProjects();
    }
  }, []); // Empty deps = only on mount

  // Expand all projects when data changes
  useEffect(() => {
    if (projects.length > 0) {
      const expanded = {};
      projects.forEach(p => { expanded[p.id] = true; });
      setExpandedProjects(expanded);
    }
  }, [projectsData]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const url = showCompleted ? '/api/notion/projects?completed=true' : '/api/notion/projects';
      const res = await fetch(url);
      const data = await res.json();
      onProjectsLoaded(data);
    } catch (err) {
      console.error('Erreur chargement projets:', err);
    }
    setLoading(false);
  };

  const toggleTypeFilter = (type) => {
    setTypeFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const toggleShowCompletedTasks = (projectId) => {
    setShowCompletedTasks(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const toggleTask = async (task, completed) => {
    if (togglingTaskId) return;
    setTogglingTaskId(task.id);

    // Optimistic update
    const updateTaskInProject = (p) => ({
      ...p,
      openTasks: completed
        ? p.openTasks.filter(t => t.id !== task.id)
        : [...p.openTasks, { ...task, completed: false }],
      completedTasks: completed
        ? [{ ...task, completed: true }, ...p.completedTasks].slice(0, 3)
        : p.completedTasks.filter(t => t.id !== task.id),
      openTasksCount: completed ? p.openTasksCount - 1 : p.openTasksCount + 1
    });

    const updatedData = {
      ...projectsData,
      projects: projectsData.projects.map(p => p.id === task.projectId || p.openTasks?.some(t => t.id === task.id) || p.completedTasks?.some(t => t.id === task.id)
        ? updateTaskInProject(p)
        : p
      )
    };
    onProjectsLoaded(updatedData);

    try {
      await fetch('/api/notion/update-task-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, completed })
      });
    } catch (err) {
      console.error('Erreur toggle task:', err);
      loadProjects(); // Reload on error
    }

    setTogglingTaskId(null);
  };

  const createTask = async () => {
    if (!newTaskName.trim() || !newTaskModal) return;
    setCreatingTask(true);

    try {
      const res = await fetch('/api/notion/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTaskName.trim(),
          projectId: newTaskModal.projectId,
          priority: newTaskPriority
        })
      });

      if (res.ok) {
        setNewTaskModal(null);
        setNewTaskName('');
        setNewTaskPriority('À prioriser');
        loadProjects(); // Refresh data
      }
    } catch (err) {
      console.error('Erreur création tâche:', err);
    }

    setCreatingTask(false);
  };

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    const filtered = projects.filter(p => {
      // Type filter
      if (!typeFilters[p.type]) return false;
      // Search filter
      if (search) {
        const s = search.toLowerCase();
        if (!p.name.toLowerCase().includes(s) && !p.dossier?.name?.toLowerCase().includes(s)) return false;
      }
      return true;
    });

    // Sort projects
    const priorityOrder = { 'Urg & Imp': 0, 'Urg & imp': 0, 'Important': 1, 'Urgent': 2, 'À prioriser': 3, 'Secondaire': 4, 'En attente': 5 };

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'lastEdited':
          return (b.lastEditedTs || 0) - (a.lastEditedTs || 0);
        case 'lastTaskAdded':
          return (b.lastTaskAddedTs || 0) - (a.lastTaskAddedTs || 0);
        case 'lastTaskCompleted':
          return (b.lastTaskCompletedTs || 0) - (a.lastTaskCompletedTs || 0);
        case 'nextDue':
          // Projects with due dates first, then by date
          if (a.nextTaskDueTs && !b.nextTaskDueTs) return -1;
          if (!a.nextTaskDueTs && b.nextTaskDueTs) return 1;
          if (!a.nextTaskDueTs && !b.nextTaskDueTs) return 0;
          return a.nextTaskDueTs - b.nextTaskDueTs;
        case 'priority':
          return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
        case 'name':
          return a.name.localeCompare(b.name, 'fr');
        case 'taskCount':
          return b.openTasksCount - a.openTasksCount;
        default:
          return 0;
      }
    });
  }, [projects, typeFilters, search, sortBy]);

  // Group by priority for display
  const groupedByPriority = useMemo(() => {
    const groups = {
      urgent: filteredProjects.filter(p => p.priority?.includes('Urg') || p.priority === 'Important'),
      normal: filteredProjects.filter(p => !p.priority?.includes('Urg') && p.priority !== 'Important' && p.priority !== 'En attente'),
      waiting: filteredProjects.filter(p => p.priority === 'En attente')
    };
    return groups;
  }, [filteredProjects]);

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Icon name="project" className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Projets</h1>
              <p className="text-xs text-gray-500">
                {stats.total || 0} projets · {stats.totalOpenTasks || 0} tâches ouvertes
              </p>
            </div>
          </div>
          <button
            onClick={() => loadProjects()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors disabled:opacity-50"
          >
            <Icon name="refresh" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Type toggles */}
          <div className="flex items-center gap-2">
            {['Gestion', 'Lead', 'Sinistre'].map(type => {
              const colors = TYPE_COLORS[type];
              const count = projectsData?.byType?.[type]?.length || 0;
              return (
                <button
                  key={type}
                  onClick={() => toggleTypeFilter(type)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                    typeFilters[type]
                      ? `${colors.bg} ${colors.badge} border-current`
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${typeFilters[type] ? colors.dot : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium">{type}</span>
                  <span className="text-xs opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs">
            <div className="relative">
              <Icon name="search" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="lastEdited">⏱️ Dernière modif</option>
            <option value="lastTaskAdded">➕ Dernière tâche ajoutée</option>
            <option value="lastTaskCompleted">✅ Dernière tâche terminée</option>
            <option value="nextDue">📅 Prochaine échéance</option>
            <option value="priority">🔴 Priorité</option>
            <option value="taskCount">📋 Nb de tâches</option>
            <option value="name">🔤 Nom A-Z</option>
          </select>

          {/* Show completed toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={e => setShowCompleted(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            Projets terminés
            <span className="text-xs text-gray-400">(actualiser pour appliquer)</span>
          </label>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && !projects.length ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Icon name="project" className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Aucun projet trouvé</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProjects.map(project => {
              const colors = TYPE_COLORS[project.type] || TYPE_COLORS.Lead;
              const isExpanded = expandedProjects[project.id];
              const showingCompleted = showCompletedTasks[project.id];

              return (
                <div key={project.id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden border-l-4 ${colors.border}`}>
                  {/* Project Header */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleProject(project.id)}
                  >
                    <Icon name={isExpanded ? 'chevronDown' : 'chevronUp'} className="w-4 h-4 text-gray-400 rotate-180" style={{ transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)' }} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{project.type}</span>
                        {project.niveau && <span className="text-xs text-gray-400">{project.niveau}</span>}
                      </div>
                      {project.dossier && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Icon name="folder" className="w-3 h-3" />
                          {project.dossier.name}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {project.priority && (
                        <span className={`text-xs font-medium ${PRIORITY_COLORS[project.priority] || 'text-gray-400'}`}>
                          {project.priority}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="font-medium text-gray-900">{project.openTasksCount}</span> tâches
                      </div>
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Ouvrir dans Notion"
                      >
                        <Icon name="external" className="w-4 h-4 text-gray-400" />
                      </a>
                    </div>
                  </div>

                  {/* Tasks */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      {/* Open Tasks */}
                      {project.openTasks.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                          {project.openTasks.map(task => {
                            const dateStatus = getDateStatus(task.date);
                            return (
                              <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white transition-colors">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  disabled={togglingTaskId === task.id}
                                  onChange={() => toggleTask(task, true)}
                                  className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                                />
                                <span className="text-sm">
                                  {task.priority?.includes('Urg') ? '🔴' : task.priority === 'Important' ? '🟠' : task.priority === 'Urgent' ? '🟡' : ''}
                                </span>
                                <a href={task.url} target="_blank" rel="noopener" className="flex-1 text-sm text-gray-700 hover:text-gray-900 truncate">
                                  {task.name}
                                </a>
                                {task.date && (
                                  <span className={`text-xs ${
                                    dateStatus === 'overdue' ? 'text-red-600 font-medium' :
                                    dateStatus === 'today' ? 'text-orange-600 font-medium' :
                                    'text-gray-400'
                                  }`}>
                                    {new Date(task.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-400 italic">
                          Aucune tâche ouverte
                        </div>
                      )}

                      {/* Completed Tasks Toggle */}
                      {project.completedTasks.length > 0 && (
                        <div className="border-t border-gray-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleShowCompletedTasks(project.id); }}
                            className="w-full px-4 py-2 text-left text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            {showingCompleted ? '▼' : '▶'} Dernières tâches terminées ({project.completedTasksCount})
                          </button>
                          {showingCompleted && (
                            <div className="divide-y divide-gray-100 bg-gray-50">
                              {project.completedTasks.map(task => (
                                <div key={task.id} className="flex items-center gap-3 px-4 py-2 opacity-60">
                                  <input
                                    type="checkbox"
                                    checked={true}
                                    disabled={togglingTaskId === task.id}
                                    onChange={() => toggleTask(task, false)}
                                    className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                                  />
                                  <a href={task.url} target="_blank" rel="noopener" className="flex-1 text-sm text-gray-500 line-through truncate">
                                    {task.name}
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Add Task Button */}
                      <div className="border-t border-gray-100 px-4 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setNewTaskModal({ projectId: project.id, projectName: project.name }); }}
                          className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium"
                        >
                          <Icon name="plus" className="w-3.5 h-3.5" />
                          Ajouter une tâche
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {newTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setNewTaskModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Nouvelle tâche</h3>
            <p className="text-sm text-gray-500 mb-4">Projet : {newTaskModal.projectName}</p>

            <input
              type="text"
              placeholder="Nom de la tâche..."
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createTask()}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
              autoFocus
            />

            <select
              value={newTaskPriority}
              onChange={e => setNewTaskPriority(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm mb-4"
            >
              <option value="Urg & Imp">🔴 Urg & Imp</option>
              <option value="Important">🟠 Important</option>
              <option value="Urgent">🟡 Urgent</option>
              <option value="Secondaire">⚪ Secondaire</option>
              <option value="En attente">🔵 En attente</option>
              <option value="À prioriser">⬜ À prioriser</option>
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => setNewTaskModal(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={createTask}
                disabled={!newTaskName.trim() || creatingTask}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
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

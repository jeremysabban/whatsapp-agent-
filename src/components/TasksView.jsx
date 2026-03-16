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
    user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  };
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icons[name]}</svg>);
}

export default function TasksView({ onOpenConversation, onOpenProject, tasksData, tasksLastUpdate, tasksHasLoaded, onTasksLoaded }) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all'); // 'all', 'none', 'Jeremy', 'Perrine'
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortBy, setSortBy] = useState('creation_desc');
  const [expandedDossiers, setExpandedDossiers] = useState({});
  const [togglingTaskId, setTogglingTaskId] = useState(null);
  const [newTaskModal, setNewTaskModal] = useState(null); // { dossierId, dossierName, projects: [] }
  const [newTaskName, setNewTaskName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState(''); // 'Jeremy', 'Perrine', or ''
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTaskType, setSelectedTaskType] = useState(''); // 'Appel', 'Email', 'Autre'
  const [creatingTask, setCreatingTask] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Task completion modal state
  const [completionModal, setCompletionModal] = useState(null); // { task, step: 'choice' | 'followup' }
  const [followUpTasks, setFollowUpTasks] = useState(['']); // Array of task names
  const [followUpAssignee, setFollowUpAssignee] = useState(''); // Assignee for follow-up tasks
  const [followUpDate, setFollowUpDate] = useState(''); // Date for follow-up tasks
  const [followUpTaskType, setFollowUpTaskType] = useState(''); // Task type for follow-up tasks
  const [creatingFollowUp, setCreatingFollowUp] = useState(false);

  // Edit task modal state
  const [editTaskModal, setEditTaskModal] = useState(null); // task object
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTaskType, setEditTaskType] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Derive data from props
  const tasks = tasksData?.tasks || [];
  const groupedByDossier = tasksData?.groupedByDossier || [];
  const tasksWithoutDossier = tasksData?.tasksWithoutDossier || [];

  // Always load fresh non-completed tasks on mount
  useEffect(() => {
    loadTasks(false); // Always load non-completed tasks
  }, []);

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

    // If completing a task, show the completion modal instead of directly completing
    if (completed && !task.completed) {
      setCompletionModal({ task, step: 'choice' });
      return;
    }

    // If uncompleting, proceed directly
    await executeToggle(task, completed);
  };

  // Actually execute the toggle (called from modal or directly when uncompleting)
  const executeToggle = async (task, completed) => {
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

  // Handle "Fin d'action" - just complete the task
  const handleFinishAction = async () => {
    if (!completionModal) return;
    await executeToggle(completionModal.task, true);
    setCompletionModal(null);
  };

  // Handle "Tâche(s) suivante(s)" - show follow-up form
  const handleShowFollowUp = () => {
    setFollowUpTasks(['']);
    setFollowUpAssignee('');
    setFollowUpDate('');
    setFollowUpTaskType('');
    setCompletionModal(prev => ({ ...prev, step: 'followup' }));
  };

  // Add another follow-up task input
  const addFollowUpTask = () => {
    setFollowUpTasks(prev => [...prev, '']);
  };

  // Remove a follow-up task input
  const removeFollowUpTask = (index) => {
    setFollowUpTasks(prev => prev.filter((_, i) => i !== index));
  };

  // Update a follow-up task name
  const updateFollowUpTask = (index, value) => {
    setFollowUpTasks(prev => prev.map((t, i) => i === index ? value : t));
  };

  // Create follow-up tasks and complete the original
  const handleCreateFollowUp = async () => {
    if (!completionModal) return;
    const task = completionModal.task;
    const validTasks = followUpTasks.filter(t => t.trim());

    if (validTasks.length === 0) {
      // No follow-up tasks, just complete
      await handleFinishAction();
      return;
    }

    setCreatingFollowUp(true);

    try {
      // Create all follow-up tasks
      for (const taskName of validTasks) {
        await fetch('/api/notion/create-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: taskName.trim(),
            dossierId: task.dossierId || null,
            projectId: task.project?.id || null,
            assignee: followUpAssignee || null,
            date: followUpDate || null,
            taskType: followUpTaskType || null
          })
        });
      }

      // Complete the original task
      await executeToggle(task, true);

      // Refresh tasks to show the new ones
      await loadTasks(showCompleted);

      setCompletionModal(null);
      setFollowUpTasks(['']);
      setFollowUpAssignee('');
      setFollowUpDate('');
      setFollowUpTaskType('');
    } catch (err) {
      console.error('Erreur création tâches suivantes:', err);
    }

    setCreatingFollowUp(false);
  };

  const handleWhatsAppClick = (phone) => {
    if (phone && onOpenConversation) {
      const cleanPhone = phone.replace(/\D/g, '');
      onOpenConversation(cleanPhone);
    }
  };

  // Open edit task modal
  const openEditModal = (task) => {
    setEditTaskModal(task);
    setEditName(task.name || '');
    setEditDate(task.date ? task.date.split('T')[0] : '');
    setEditTaskType(task.taskType || '');
    setEditPriority(task.priority || '');
  };

  // Save task edits
  const saveTaskEdit = async () => {
    if (!editTaskModal) return;
    setSavingEdit(true);

    try {
      const updates = {};
      if (editName !== editTaskModal.name) updates.name = editName;
      if (editDate !== (editTaskModal.date?.split('T')[0] || '')) updates.date = editDate || null;
      if (editTaskType !== (editTaskModal.taskType || '')) updates.taskType = editTaskType || null;
      if (editPriority !== (editTaskModal.priority || '')) updates.priority = editPriority || null;

      if (Object.keys(updates).length > 0) {
        const res = await fetch('/api/notion/update-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: editTaskModal.id,
            updates,
            dossierId: editTaskModal.dossierId,
            taskName: editTaskModal.name
          })
        });

        if (res.ok) {
          // Refresh tasks to get updated data
          await loadTasks(showCompleted);
        }
      }

      setEditTaskModal(null);
    } catch (err) {
      console.error('Erreur modification tâche:', err);
    }

    setSavingEdit(false);
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
    setSelectedAssignee('');
    setSelectedDate('');
    setSelectedTaskType('');
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
          projectId: selectedProjectId || null,
          assignee: selectedAssignee || null,
          date: selectedDate || null,
          taskType: selectedTaskType || null
        })
      });

      if (res.ok) {
        // Refresh tasks
        await loadTasks();
        setNewTaskModal(null);
        setNewTaskName('');
        setSelectedProjectId('');
        setSelectedAssignee('');
        setSelectedDate('');
        setSelectedTaskType('');
      }
    } catch (err) {
      console.error('Erreur création tâche:', err);
    }

    setCreatingTask(false);
  };

  // Filter and sort all tasks (flat list)
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.name?.toLowerCase().includes(searchLower) ||
        t.project?.name?.toLowerCase().includes(searchLower) ||
        t.dossier?.name?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by assignee
    if (filterAssignee === 'none') {
      filtered = filtered.filter(t => !t.assignee);
    } else if (filterAssignee !== 'all') {
      filtered = filtered.filter(t => t.assignee === filterAssignee);
    }

    // Filter by urgent (priority contains "Urg" or "Imp")
    if (filterUrgent) {
      filtered = filtered.filter(t =>
        t.priority?.includes('Urg') || t.priority?.includes('Imp')
      );
    }

    return filtered;
  }, [tasks, search, filterAssignee, filterUrgent]);

  // Sorting function
  const sortTasks = (tasks) => {
    return [...tasks].sort((a, b) => {
      switch (sortBy) {
        case 'creation_desc': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'creation_asc': return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'date_asc': {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(a.date) - new Date(b.date);
        }
        case 'date_desc': {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(b.date) - new Date(a.date);
        }
        case 'name_asc': return (a.name || '').localeCompare(b.name || '');
        case 'name_desc': return (b.name || '').localeCompare(a.name || '');
        default: return 0;
      }
    });
  };

  // Apply sorting to filtered tasks
  const sortedTasks = sortTasks(filteredTasks);

  const totalFiltered = filteredTasks.length;

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
              onClick={() => loadTasks(showCompleted)}
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

        {/* Filters + Sort */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2 flex-wrap">
            {/* All tasks */}
            <button
              onClick={() => setFilterAssignee('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterAssignee === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Toutes
            </button>
            {/* Assignee filters */}
            <button
              onClick={() => setFilterAssignee(filterAssignee === 'none' ? 'all' : 'none')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filterAssignee === 'none'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon name="user" className="w-3.5 h-3.5 opacity-50" />
              Sans resp.
            </button>
            <button
              onClick={() => setFilterAssignee(filterAssignee === 'Jeremy' ? 'all' : 'Jeremy')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterAssignee === 'Jeremy'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              👤 Jeremy
            </button>
            <button
              onClick={() => setFilterAssignee(filterAssignee === 'Perrine' ? 'all' : 'Perrine')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterAssignee === 'Perrine'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              👤 Perrine
            </button>
            <div className="w-px bg-gray-200 mx-1"></div>
            <button
              onClick={() => setFilterUrgent(!filterUrgent)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterUrgent
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🔥 Urgentes
            </button>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-gray-100"
          >
            <option value="creation_desc">📅 Plus récent</option>
            <option value="creation_asc">📅 Plus ancien</option>
            <option value="date_asc">⏰ Échéance proche</option>
            <option value="date_desc">⏰ Échéance loin</option>
            <option value="name_asc">🔤 Nom A-Z</option>
            <option value="name_desc">🔤 Nom Z-A</option>
          </select>
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
            {search || filterAssignee !== 'all' || filterUrgent ? 'Aucune tâche trouvée' : 'Aucune tâche'}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {sortedTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  togglingTaskId={togglingTaskId}
                  onEdit={openEditModal}
                />
              ))}
            </div>
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
                <label className="block text-xs text-gray-500 mb-1">Date d'échéance</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type de tâche</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTaskType('')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTaskType === '' ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-150'
                    }`}
                  >
                    Aucun
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTaskType('Appel')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTaskType === 'Appel' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    📞 Appel
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTaskType('Email')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTaskType === 'Email' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    📧 Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTaskType('Autre')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTaskType === 'Autre' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    ✅ Autre
                  </button>
                </div>
              </div>
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
              <div>
                <label className="block text-xs text-gray-500 mb-1">Responsable</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAssignee('')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedAssignee === '' ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-150'
                    }`}
                  >
                    Aucun
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAssignee('Jeremy')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedAssignee === 'Jeremy' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    👤 Jeremy
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAssignee('Perrine')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedAssignee === 'Perrine' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    👤 Perrine
                  </button>
                </div>
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

      {/* Task Completion Modal */}
      {completionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCompletionModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            {completionModal.step === 'choice' ? (
              <>
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> Tâche terminée !
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{completionModal.task.name}</p>
                </div>
                <div className="p-4 space-y-3">
                  <button
                    onClick={handleFinishAction}
                    className="w-full px-4 py-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏁</span>
                      <div>
                        <div className="font-semibold text-emerald-800">Fin d'action</div>
                        <div className="text-sm text-emerald-600">Terminer sans suite</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={handleShowFollowUp}
                    className="w-full px-4 py-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">➕</span>
                      <div>
                        <div className="font-semibold text-blue-800">Tâche(s) suivante(s)</div>
                        <div className="text-sm text-blue-600">Créer des tâches de suivi</div>
                      </div>
                    </div>
                  </button>
                </div>
                <div className="p-4 border-t border-gray-100">
                  <button
                    onClick={() => setCompletionModal(null)}
                    className="w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-bold text-lg text-gray-900">Tâches suivantes</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {completionModal.task.dossier?.name && (
                      <span className="inline-flex items-center gap-1">
                        📁 {completionModal.task.dossier.name}
                      </span>
                    )}
                    {completionModal.task.project?.name && (
                      <span className="inline-flex items-center gap-1 ml-2">
                        📋 {completionModal.task.project.name}
                      </span>
                    )}
                    {!completionModal.task.dossier?.name && !completionModal.task.project?.name && (
                      <span className="text-gray-400">Sans dossier ni projet</span>
                    )}
                  </p>
                </div>
                <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                  {followUpTasks.map((taskName, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={`Tâche ${index + 1}...`}
                        value={taskName}
                        onChange={(e) => updateFollowUpTask(index, e.target.value)}
                        autoFocus={index === followUpTasks.length - 1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && taskName.trim()) {
                            addFollowUpTask();
                          }
                        }}
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      {followUpTasks.length > 1 && (
                        <button
                          onClick={() => removeFollowUpTask(index)}
                          className="px-3 py-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addFollowUpTask}
                    className="w-full px-4 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors"
                  >
                    + Ajouter une tâche
                  </button>
                  <div className="pt-2">
                    <label className="block text-xs text-gray-500 mb-1">Responsable</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFollowUpAssignee('')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          followUpAssignee === '' ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-150'
                        }`}
                      >
                        Aucun
                      </button>
                      <button
                        type="button"
                        onClick={() => setFollowUpAssignee('Jeremy')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          followUpAssignee === 'Jeremy' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                        }`}
                      >
                        👤 Jeremy
                      </button>
                      <button
                        type="button"
                        onClick={() => setFollowUpAssignee('Perrine')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          followUpAssignee === 'Perrine' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                        }`}
                      >
                        👤 Perrine
                      </button>
                    </div>
                  </div>
                  <div className="pt-2">
                    <label className="block text-xs text-gray-500 mb-1">Date d'échéance</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div className="pt-2">
                    <label className="block text-xs text-gray-500 mb-1">Type de tâche</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFollowUpTaskType('')}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                          followUpTaskType === '' ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-150'
                        }`}
                      >
                        Aucun
                      </button>
                      <button
                        type="button"
                        onClick={() => setFollowUpTaskType('Appel')}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                          followUpTaskType === 'Appel' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                        }`}
                      >
                        📞 Appel
                      </button>
                      <button
                        type="button"
                        onClick={() => setFollowUpTaskType('Email')}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                          followUpTaskType === 'Email' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                        }`}
                      >
                        📧 Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setFollowUpTaskType('Autre')}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                          followUpTaskType === 'Autre' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                        }`}
                      >
                        ✅ Autre
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-gray-100 flex justify-between gap-2">
                  <button
                    onClick={() => setCompletionModal(prev => ({ ...prev, step: 'choice' }))}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    ← Retour
                  </button>
                  <button
                    onClick={handleCreateFollowUp}
                    disabled={creatingFollowUp}
                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {creatingFollowUp ? 'Création...' : `Créer ${followUpTasks.filter(t => t.trim()).length || ''} et terminer`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editTaskModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditTaskModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-lg text-gray-900">Modifier la tâche</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nom de la tâche</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date d'échéance</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type de tâche</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditTaskType('')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      editTaskType === '' ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-150'
                    }`}
                  >
                    Aucun
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTaskType('Appel')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      editTaskType === 'Appel' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    📞 Appel
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTaskType('Email')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      editTaskType === 'Email' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    📧 Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTaskType('Autre')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      editTaskType === 'Autre' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    ✅ Autre
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priorité</label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setEditPriority('Urgent & Important')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      editPriority === 'Urgent & Important' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    🔴 Urgent & Important
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPriority('Non Urgent & Important')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      editPriority === 'Non Urgent & Important' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    🟠 Non Urgent & Important
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPriority('Urgent & Non Important')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      editPriority === 'Urgent & Non Important' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    🟡 Urgent & Non Important
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPriority('À prioriser')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      editPriority === 'À prioriser' ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                    }`}
                  >
                    ⚪ À prioriser
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setEditTaskModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={saveTaskEdit}
                disabled={savingEdit || !editName.trim()}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, togglingTaskId, onEdit }) {
  const colors = TYPE_COLORS[task.project?.type] || { bg: 'bg-gray-50', badge: 'bg-gray-100 text-gray-600' };

  // Date formatting with overdue detection
  const getDateInfo = () => {
    if (!task.date || task.completed) return null;
    const date = new Date(task.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((taskDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), style: 'bg-red-100 text-red-700', overdue: true };
    if (diffDays === 0) return { text: "Aujourd'hui", style: 'bg-orange-100 text-orange-700', overdue: false };
    if (diffDays === 1) return { text: 'Demain', style: 'bg-yellow-100 text-yellow-700', overdue: false };
    return { text: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), style: 'bg-gray-100 text-gray-600', overdue: false };
  };

  const dateInfo = getDateInfo();

  // Assignee color
  const getAssigneeStyle = () => {
    if (task.assignee === 'Jeremy') return 'bg-blue-100 text-blue-700';
    if (task.assignee === 'Perrine') return 'bg-yellow-100 text-yellow-700';
    return 'bg-violet-100 text-violet-700';
  };

  // Task type badge
  const getTaskTypeInfo = () => {
    if (!task.taskType) return null;
    switch (task.taskType) {
      case 'Appel': return { emoji: '📞', style: 'bg-blue-100 text-blue-700' };
      case 'Email': return { emoji: '📧', style: 'bg-amber-100 text-amber-700' };
      case 'Autre': return { emoji: '✅', style: 'bg-gray-100 text-gray-600' };
      default: return null;
    }
  };
  const taskTypeInfo = getTaskTypeInfo();

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
        {task.note && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.note}</p>
        )}
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {/* Task Type badge (Appel/Email/Autre) */}
          {taskTypeInfo && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${taskTypeInfo.style}`}>
              {taskTypeInfo.emoji} {task.taskType}
            </span>
          )}
          {/* Project Type badge */}
          {task.project?.type && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.badge}`}>
              {task.project.type}
            </span>
          )}
          {/* Dossier */}
          {task.dossier?.name && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
              📁 {task.dossier.name}
            </span>
          )}
          {/* Project */}
          {task.project?.name && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenProject?.(task.project.id); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors cursor-pointer"
            >
              📋 {task.project.name}
            </button>
          )}
          {/* Assignee */}
          {task.assignee && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getAssigneeStyle()}`}>
              <Icon name="user" className="w-3 h-3" />
              {task.assignee}
            </span>
          )}
          {/* Date */}
          {dateInfo && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${dateInfo.style}`}>
              📅 {dateInfo.text}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onEdit(task)}
        className="p-1 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
        title="Modifier"
      >
        <Icon name="edit" className="w-4 h-4 text-gray-400 hover:text-blue-500" />
      </button>
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

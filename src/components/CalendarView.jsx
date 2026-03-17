'use client';

import { useState, useEffect } from 'react';

function Icon({ name, className = 'w-4 h-4' }) {
  const icons = {
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    calendar: <><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>,
    refresh: <><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></>,
    user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  };
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icons[name]}</svg>);
}

// Task type styles
const TASK_TYPE_STYLES = {
  Appel: { emoji: '📞', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Email: { emoji: '📧', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  WhatsApp: { emoji: '💬', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Autre: { emoji: '✅', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' }
};

export default function CalendarView({ tasksData, onTasksLoaded, onOpenDossier, onOpenProject }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [calendarConfigured, setCalendarConfigured] = useState(true);
  const [calendarError, setCalendarError] = useState(null);
  const [togglingTaskId, setTogglingTaskId] = useState(null);

  // Assignee filter state
  const [assigneeFilter, setAssigneeFilter] = useState('all'); // 'all', 'jeremy', 'perrine', 'common'
  const [showCompleted, setShowCompleted] = useState(false); // Show completed tasks for the day

  // Edit task modal state
  const [editTaskModal, setEditTaskModal] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTaskType, setEditTaskType] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignee, setEditAssignee] = useState([]); // Array: [], ['Jeremy'], ['Perrine'], ['Jeremy', 'Perrine']
  const [savingEdit, setSavingEdit] = useState(false);

  // Task detail modal state (fiche tâche)
  const [detailTask, setDetailTask] = useState(null);
  const [detailAssigneeOpen, setDetailAssigneeOpen] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [detailNote, setDetailNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [taskJustCompleted, setTaskJustCompleted] = useState(null); // Task that was just completed
  const [isImproving, setIsImproving] = useState(false); // AI text improvement

  // Get current user from cookie
  useEffect(() => {
    const cookies = document.cookie.split(';');
    const userCookie = cookies.find(c => c.trim().startsWith('smartvalue_user='));
    if (userCookie) {
      setCurrentUser(decodeURIComponent(userCookie.split('=')[1]));
    }
  }, []);

  // Reset form when changing tasks
  useEffect(() => {
    setNewTaskName('');
    setNewTaskDate('');
    setNewTaskAssignee('');
    setShowAddTask(false);
    setDetailNote(detailTask?.note || '');
    setEditingNote(false);
  }, [detailTask?.id]);

  // Add a comment line with timestamp and user
  const addCommentLine = () => {
    const now = new Date();
    const timestamp = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) +
                      ' ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const prefix = `[${timestamp} - ${currentUser || 'Utilisateur'}] `;
    const newNote = detailNote ? detailNote + '\n' + prefix : prefix;
    setDetailNote(newNote);
    setEditingNote(true);
  };

  // AI Text Improvement function
  const improveText = async () => {
    if (!detailNote.trim() || isImproving) return;
    setIsImproving(true);
    try {
      const res = await fetch('/api/ai/improve-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: detailNote, context: 'note ou commentaire professionnel sur une tâche' })
      });
      const data = await res.json();
      if (data.improved) {
        setDetailNote(data.improved);
      }
    } catch (err) {
      console.error('Error improving text:', err);
    }
    setIsImproving(false);
  };

  // Load tasks (force refresh from Notion if forceRefresh=true)
  const loadTasks = async (forceRefresh = false) => {
    if (!forceRefresh && tasksData?.tasks?.length > 0) return;
    setLoadingTasks(true);
    try {
      const url = forceRefresh ? '/api/notion/tasks?refresh=true' : '/api/notion/tasks';
      const res = await fetch(url);
      const data = await res.json();
      onTasksLoaded(data);
    } catch (err) {
      console.error('Error loading tasks:', err);
    }
    setLoadingTasks(false);
  };

  // Load tasks on mount if not available
  useEffect(() => {
    loadTasks();
  }, []);

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Format date for API (YYYY-MM-DD)
  const formatDateForApi = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Navigate to previous day
  const prevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  // Navigate to next day
  const nextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  // Go to today
  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Load calendar events for selected date
  const loadEvents = async (forceRefreshTasks = false) => {
    setLoadingEvents(true);
    setCalendarError(null);

    if (forceRefreshTasks) {
      await loadTasks(true);
    }

    try {
      const res = await fetch(`/api/calendar/events?date=${formatDateForApi(selectedDate)}`);
      const data = await res.json();

      if (!data.configured) {
        setCalendarConfigured(false);
        setEvents([]);
      } else {
        setCalendarConfigured(true);
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error loading calendar events:', error);
      setCalendarError('Erreur lors du chargement des événements');
      setEvents([]);
    }

    setLoadingEvents(false);
  };

  // Load events when date changes
  useEffect(() => {
    loadEvents();
  }, [selectedDate]);

  // Filter helper for assignee
  const matchesAssigneeFilter = (task) => {
    if (assigneeFilter === 'all') return true;
    const assignee = task.assignee || '';
    const hasJeremy = assignee.includes('Jeremy');
    const hasPerrine = assignee.includes('Perrine');
    const isCommon = hasJeremy && hasPerrine;

    if (assigneeFilter === 'common') return isCommon;
    if (assigneeFilter === 'jeremy') return hasJeremy; // includes common tasks
    if (assigneeFilter === 'perrine') return hasPerrine; // includes common tasks
    return true;
  };

  // Filter tasks for selected date (open tasks)
  // Compare date strings directly to avoid timezone issues
  const selectedDateStr = formatDateForApi(selectedDate); // "YYYY-MM-DD"
  const tasksForDate = (tasksData?.tasks || []).filter(task => {
    if (!task.date || task.completed) return false;
    if (!matchesAssigneeFilter(task)) return false;
    const taskDateStr = task.date.split('T')[0]; // Extract "YYYY-MM-DD" from date string
    return taskDateStr === selectedDateStr;
  });

  // Filter completed tasks for selected date
  // Compare date strings directly to avoid timezone issues
  const completedTasksForDate = (tasksData?.tasks || []).filter(task => {
    if (!task.date || !task.completed) return false;
    if (!matchesAssigneeFilter(task)) return false;
    const taskDateStr = task.date.split('T')[0]; // Extract "YYYY-MM-DD"
    return taskDateStr === selectedDateStr;
  });

  // Toggle task completion
  const toggleTask = async (task, completed) => {
    if (togglingTaskId) return;
    setTogglingTaskId(task.id);

    const updateTask = (t) => t.id === task.id ? { ...t, completed } : t;
    const updatedData = {
      ...tasksData,
      tasks: tasksData.tasks.map(updateTask),
      groupedByDossier: tasksData.groupedByDossier?.map(g => ({
        ...g,
        tasks: g.tasks.map(updateTask)
      })) || [],
      tasksWithoutDossier: tasksData.tasksWithoutDossier?.map(updateTask) || []
    };
    onTasksLoaded(updatedData);

    try {
      await fetch('/api/notion/update-task-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, completed })
      });
    } catch (err) {
      console.error('Error toggling task:', err);
      const revertTask = (t) => t.id === task.id ? { ...t, completed: !completed } : t;
      const revertedData = {
        ...tasksData,
        tasks: tasksData.tasks.map(revertTask),
        groupedByDossier: tasksData.groupedByDossier?.map(g => ({
          ...g,
          tasks: g.tasks.map(revertTask)
        })) || [],
        tasksWithoutDossier: tasksData.tasksWithoutDossier?.map(revertTask) || []
      };
      onTasksLoaded(revertedData);
    }

    setTogglingTaskId(null);
  };

  // Open edit modal
  const openEditModal = (task) => {
    setEditTaskModal(task);
    setEditName(task.name || '');
    setEditDate(task.date ? task.date.split('T')[0] : '');
    setEditTaskType(task.taskType || '');
    setEditPriority(task.priority || '');
    // Parse assignee - can be 'Jeremy', 'Perrine', 'Jeremy, Perrine', or null
    const assigneeStr = task.assignee || '';
    if (assigneeStr.includes('Jeremy') && assigneeStr.includes('Perrine')) {
      setEditAssignee(['Jeremy', 'Perrine']);
    } else if (assigneeStr.includes('Jeremy')) {
      setEditAssignee(['Jeremy']);
    } else if (assigneeStr.includes('Perrine')) {
      setEditAssignee(['Perrine']);
    } else {
      setEditAssignee([]);
    }
  };

  // Toggle assignee in edit modal
  const toggleEditAssignee = (name) => {
    setEditAssignee(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
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

      // Handle assignee - convert array to string format
      const newAssignee = editAssignee.length === 0 ? null
        : editAssignee.length === 2 ? 'Jeremy, Perrine'
        : editAssignee[0];
      const currentAssignee = editTaskModal.assignee || null;
      if (newAssignee !== currentAssignee) updates.assignee = newAssignee;

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
          await loadTasks(true);
        }
      }

      setEditTaskModal(null);
    } catch (err) {
      console.error('Erreur modification tâche:', err);
    }

    setSavingEdit(false);
  };

  // Quick update assignee from detail modal (optimistic update)
  const updateDetailAssignee = async (newAssignee) => {
    if (!detailTask) return;

    // Store current task data
    const taskId = detailTask.id;
    const previousAssignee = detailTask.assignee;
    const updatedTask = { ...detailTask, assignee: newAssignee };

    // Optimistic update - show immediately
    setDetailTask(updatedTask);
    setDetailAssigneeOpen(false);
    setDetailSaving(true);

    try {
      const res = await fetch('/api/notion/update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          updates: { assignee: newAssignee },
          dossierId: detailTask.dossierId,
          taskName: detailTask.name
        })
      });
      if (res.ok) {
        // Refresh cache in background but keep modal with updated task
        loadTasks(true);
        // Keep the modal open with updated data
        setDetailTask(updatedTask);
      } else {
        // Revert on error
        setDetailTask({ ...detailTask, assignee: previousAssignee });
      }
    } catch (err) {
      console.error('Error updating assignee:', err);
      // Revert on error
      setDetailTask({ ...detailTask, assignee: previousAssignee });
    }
    setDetailSaving(false);
  };

  // Link project to task
  const linkProjectToTask = async (projectId) => {
    if (!detailTask) return;
    setDetailSaving(true);
    try {
      const res = await fetch('/api/notion/update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: detailTask.id,
          updates: { projectId },
          dossierId: detailTask.dossierId,
          taskName: detailTask.name
        })
      });
      if (res.ok) {
        await loadTasks(true);
        // Find and update the project info
        const project = (tasksData?.tasks || []).find(t => t.projectId === projectId)?.project;
        setDetailTask({ ...detailTask, projectId, project });
      }
    } catch (err) {
      console.error('Error linking project:', err);
    }
    setDetailSaving(false);
    setShowProjectSelector(false);
  };

  // Add task to project
  const addTaskToProject = async () => {
    if (!newTaskName.trim() || !newTaskDate || !newTaskAssignee) return;
    // If no project, still allow creating task for dossier
    const taskData = {
      name: newTaskName,
      dossierId: detailTask?.dossierId,
      date: newTaskDate,
      assignee: newTaskAssignee
    };
    if (detailTask?.projectId) {
      taskData.projectId = detailTask.projectId;
    }

    setDetailSaving(true);
    try {
      const res = await fetch('/api/notion/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        const result = await res.json();
        setNewTaskName('');
        setNewTaskDate('');
        setNewTaskAssignee('');
        setShowAddTask(false);
        // Refresh tasks and show the new task
        await loadTasks(true);
        // If we have a new task, show it
        if (result.task?.id) {
          // Find the new task in refreshed data (will be available after loadTasks)
          setTimeout(() => {
            const newTask = tasksData?.tasks?.find(t => t.id === result.task.id);
            if (newTask) {
              setDetailTask(newTask);
              setDetailNote(newTask.note || '');
              setEditingNote(false);
            }
          }, 500);
        }
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
    setDetailSaving(false);
  };

  // Save note/comment (optimistic update)
  const saveDetailNote = async () => {
    if (!detailTask) return;

    // Store current task data
    const taskId = detailTask.id;
    const previousNote = detailTask.note;
    const updatedTask = { ...detailTask, note: detailNote };

    // Optimistic update - show immediately
    setDetailTask(updatedTask);
    setEditingNote(false);
    setDetailSaving(true);

    try {
      const res = await fetch('/api/notion/update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          updates: { note: detailNote },
          dossierId: detailTask.dossierId,
          taskName: detailTask.name
        })
      });
      if (res.ok) {
        // Refresh cache in background but keep modal with updated task
        loadTasks(true);
        setDetailTask(updatedTask);
      } else {
        // Revert on error
        setDetailTask({ ...detailTask, note: previousNote });
        setDetailNote(previousNote || '');
      }
    } catch (err) {
      console.error('Error saving note:', err);
      // Revert on error
      setDetailTask({ ...detailTask, note: previousNote });
      setDetailNote(previousNote || '');
    }
    setDetailSaving(false);
  };

  // Complete task and show next task from project
  const completeTaskAndShowNext = async () => {
    if (!detailTask) return;

    const completedTask = { ...detailTask };
    const projectId = detailTask.projectId;

    // Mark as completed
    await toggleTask(detailTask, true);
    setTaskJustCompleted(completedTask);

    // Find next uncompleted task from same project
    if (projectId) {
      const nextTask = (tasksData?.tasks || []).find(t =>
        t.projectId === projectId &&
        t.id !== detailTask.id &&
        !t.completed
      );
      if (nextTask) {
        setDetailTask(nextTask);
        setDetailNote(nextTask.note || '');
        setEditingNote(false);
        return;
      }
    }

    // No next task - show add task form
    setShowAddTask(true);
  };

  // Format event time
  const formatEventTime = (event) => {
    if (event.allDay) return 'Journée';
    const start = new Date(event.start);
    const end = new Date(event.end);
    return `${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Task row component
  const TaskRow = ({ task, isOverdue = false }) => {
    const typeStyle = TASK_TYPE_STYLES[task.taskType] || null;
    const bgClass = isOverdue ? 'hover:bg-red-50/50' : 'hover:bg-gray-50';
    const textClass = isOverdue ? 'text-red-800' : (task.completed ? 'text-gray-400 line-through' : 'text-gray-900');

    return (
      <div className={`px-4 py-3 ${bgClass} flex items-start gap-3`}>
        <button
          onClick={() => toggleTask(task, !task.completed)}
          disabled={togglingTaskId === task.id}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
            task.completed
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : isOverdue ? 'border-red-300 hover:border-emerald-500' : 'border-gray-300 hover:border-emerald-500'
          } ${togglingTaskId === task.id ? 'opacity-50' : ''}`}
        >
          {task.completed && <Icon name="check" className="w-3 h-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDetailTask(task)}
              className={`text-sm ${textClass} text-left hover:underline`}
            >
              {task.name}
            </button>
            {/* Yellow dot for comments - hover to show */}
            {task.note && (
              <div className="relative group">
                <span className="w-3 h-3 bg-amber-400 rounded-full inline-block cursor-help flex-shrink-0" title="Commentaires"></span>
                <div className="absolute left-0 top-5 z-50 hidden group-hover:block w-64 p-2 bg-white border border-amber-200 rounded-lg shadow-lg text-xs text-gray-700 whitespace-pre-wrap">
                  <p className="font-semibold text-amber-700 mb-1">📝 Commentaires</p>
                  {task.note}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Assignee - first position for visibility */}
            {task.assignee && (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                task.assignee.includes('Jeremy') && task.assignee.includes('Perrine')
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : task.assignee.includes('Jeremy')
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
              }`}>
                {task.assignee.includes('Jeremy') && task.assignee.includes('Perrine') ? '👥' : '👤'}
                {task.assignee.includes('Jeremy') && task.assignee.includes('Perrine') ? 'Commun' : task.assignee}
              </span>
            )}
            {/* Date for overdue */}
            {isOverdue && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                📅 {new Date(task.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {/* Task type badge */}
            {typeStyle && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeStyle.bg} ${typeStyle.text} border ${typeStyle.border}`}>
                {typeStyle.emoji} {task.taskType}
              </span>
            )}
            {/* Dossier - clickable */}
            {task.dossier?.name && (
              <button
                onClick={() => onOpenDossier && onOpenDossier(task.dossier.id)}
                className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                📁 {task.dossier.name}
              </button>
            )}
            {/* Project - clickable */}
            {task.project?.name && (
              <button
                onClick={() => onOpenProject && onOpenProject(task.projectId)}
                className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors cursor-pointer"
              >
                📋 {task.project.name}
              </button>
            )}
          </div>
        </div>

        {/* Edit button */}
        <button
          onClick={() => openEditModal(task)}
          className="p-1 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
          title="Modifier"
        >
          <Icon name="edit" className="w-4 h-4 text-gray-400 hover:text-blue-500" />
        </button>
      </div>
    );
  };

  // Get overdue tasks (also filtered by assignee)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasks = (tasksData?.tasks || []).filter(task => {
    if (!task.date || task.completed) return false;
    if (!matchesAssigneeFilter(task)) return false;
    const taskDate = new Date(task.date);
    taskDate.setHours(0, 0, 0, 0);
    return taskDate < today;
  });

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with date navigation */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Icon name="calendar" className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Calendrier</h1>
              <p className="text-xs text-gray-500">
                {tasksForDate.length} tâche{tasksForDate.length !== 1 ? 's' : ''} · {events.length} événement{events.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => loadEvents(true)}
            disabled={loadingEvents || loadingTasks}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors disabled:opacity-50"
          >
            <Icon name="refresh" className={`w-4 h-4 ${loadingEvents || loadingTasks ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <button onClick={prevDay} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Icon name="chevronLeft" className="w-5 h-5 text-gray-600" />
          </button>

          <button
            onClick={goToToday}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isToday(selectedDate)
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isToday(selectedDate) ? "Aujourd'hui" : formatDate(selectedDate)}
          </button>

          <button onClick={nextDay} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Icon name="chevronRight" className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {!isToday(selectedDate) && (
          <div className="text-center mt-2">
            <button onClick={goToToday} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              Revenir à aujourd'hui
            </button>
          </div>
        )}

        {/* Assignee filter */}
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <span className="text-xs text-gray-500">Filtrer:</span>
          {[
            { id: 'all', label: 'Tous' },
            { id: 'jeremy', label: '👤 Jeremy' },
            { id: 'perrine', label: '👤 Perrine' },
            { id: 'common', label: '👥 Commun' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setAssigneeFilter(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                assigneeFilter === f.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              showCompleted
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ✓ Terminées ({completedTasksForDate.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Calendar Events Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
            <h2 className="font-semibold text-indigo-800 flex items-center gap-2">
              <Icon name="calendar" className="w-4 h-4" />
              Événements Google Calendar
            </h2>
          </div>

          {!calendarConfigured ? (
            <div className="p-6 text-center">
              <Icon name="alert" className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">Google Calendar non configuré</p>
              <p className="text-xs text-gray-400">
                Visitez <code className="bg-gray-100 px-1 rounded">/api/auth/gmail/callback</code> pour autoriser l'accès
              </p>
            </div>
          ) : loadingEvents ? (
            <div className="p-6 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            </div>
          ) : calendarError ? (
            <div className="p-6 text-center text-red-500">
              <Icon name="alert" className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">{calendarError}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <p className="text-sm">Aucun événement ce jour</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {events.map(event => (
                <div key={event.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-16 text-xs text-gray-500">
                      {formatEventTime(event)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{event.title}</p>
                      {event.location && <p className="text-xs text-gray-500 truncate mt-0.5">📍 {event.location}</p>}
                      {event.attendees?.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">👥 {event.attendees.length} participant{event.attendees.length > 1 ? 's' : ''}</p>
                      )}
                    </div>
                    {event.htmlLink && (
                      <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-200 rounded transition-colors" title="Ouvrir dans Google Calendar">
                        <Icon name="external" className="w-4 h-4 text-gray-400" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
            <h2 className="font-semibold text-emerald-800 flex items-center gap-2">
              <Icon name="check" className="w-4 h-4" />
              Tâches du jour ({tasksForDate.length})
            </h2>
          </div>

          {tasksForDate.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <p className="text-sm">Aucune tâche prévue ce jour</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {tasksForDate.map(task => <TaskRow key={task.id} task={task} />)}
            </div>
          )}
        </div>

        {/* Completed tasks for the day */}
        {showCompleted && completedTasksForDate.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-75">
            <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
              <h2 className="font-semibold text-gray-600 flex items-center gap-2">
                <Icon name="check" className="w-4 h-4" />
                Tâches terminées du jour ({completedTasksForDate.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {completedTasksForDate.map(task => (
                <div key={task.id} className="px-4 py-3 flex items-start gap-3 bg-gray-50">
                  <button
                    onClick={() => toggleTask(task, false)}
                    disabled={togglingTaskId === task.id}
                    className="mt-0.5 w-5 h-5 rounded border-2 bg-emerald-500 border-emerald-500 text-white flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <Icon name="check" className="w-3 h-3" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-400 line-through">{task.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {task.assignee && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-500">
                          {task.assignee}
                        </span>
                      )}
                      {task.project?.name && (
                        <button
                          onClick={() => onOpenProject && onOpenProject(task.projectId)}
                          className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-600 hover:bg-purple-200"
                        >
                          📋 {task.project.name}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overdue tasks warning */}
        {overdueTasks.length > 0 && isToday(selectedDate) && (
          <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
            <div className="px-4 py-3 bg-red-100 border-b border-red-200">
              <h2 className="font-semibold text-red-800 flex items-center gap-2">
                <Icon name="alert" className="w-4 h-4" />
                Tâches en retard ({overdueTasks.length})
              </h2>
            </div>
            <div className="divide-y divide-red-100">
              {overdueTasks.map(task => <TaskRow key={task.id} task={task} isOverdue />)}
            </div>
          </div>
        )}
      </div>

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
                <div className="flex gap-2 flex-wrap">
                  {['', 'Appel', 'Email', 'WhatsApp', 'Autre'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditTaskType(type)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        editTaskType === type
                          ? type === 'Appel' ? 'bg-blue-500 text-white'
                            : type === 'Email' ? 'bg-amber-500 text-white'
                            : type === 'WhatsApp' ? 'bg-emerald-500 text-white'
                            : type === 'Autre' ? 'bg-gray-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                      }`}
                    >
                      {type === '' ? 'Aucun' : type === 'Appel' ? '📞' : type === 'Email' ? '📧' : type === 'WhatsApp' ? '💬' : '✅'} {type || 'Aucun'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priorité</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'Urgent & Important', label: '🔴 Urgent & Important', color: 'bg-red-500' },
                    { value: 'Non Urgent & Important', label: '🟠 Non Urgent & Important', color: 'bg-orange-500' },
                    { value: 'Urgent & Non Important', label: '🟡 Urgent & Non Important', color: 'bg-yellow-500' },
                    { value: 'À prioriser', label: '⚪ À prioriser', color: 'bg-gray-500' }
                  ].map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setEditPriority(p.value)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        editPriority === p.value ? `${p.color} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Responsable (multi-sélection)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleEditAssignee('Jeremy')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      editAssignee.includes('Jeremy')
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    👤 Jeremy
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleEditAssignee('Perrine')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      editAssignee.includes('Perrine')
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    👤 Perrine
                  </button>
                </div>
                {editAssignee.length === 2 && (
                  <p className="text-xs text-purple-600 mt-1">👥 Tâche commune</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setEditTaskModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
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

      {/* Task Detail Modal (Fiche Tâche) */}
      {detailTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setDetailTask(null); setDetailAssigneeOpen(false); setShowProjectSelector(false); setShowAddTask(false); setEditingNote(false); setTaskJustCompleted(null); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Success banner when task was just completed */}
            {taskJustCompleted && (
              <div className="bg-emerald-100 border-b border-emerald-200 px-4 py-2 flex items-center gap-2">
                <span className="text-emerald-600">✓</span>
                <span className="text-sm text-emerald-700">
                  Tâche "<span className="font-medium">{taskJustCompleted.name}</span>" terminée !
                </span>
                <button
                  onClick={() => setTaskJustCompleted(null)}
                  className="ml-auto text-emerald-500 hover:text-emerald-700"
                >
                  ×
                </button>
              </div>
            )}
            {/* Header - Light blue banner */}
            <div className="p-4 border-b border-sky-200 bg-gradient-to-r from-sky-100 to-sky-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sky-600">✓</span>
                    <h3 className="font-bold text-lg text-gray-900">{detailTask.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>Créée le {new Date(detailTask.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <button onClick={() => setDetailTask(null)} className="p-1 hover:bg-sky-200 rounded">
                  <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {detailTask.priority && (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    detailTask.priority === 'Urgent & Important' ? 'bg-red-100 text-red-700' :
                    detailTask.priority === 'Non Urgent & Important' ? 'bg-orange-100 text-orange-700' :
                    detailTask.priority === 'Urgent & Non Important' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {detailTask.priority}
                  </span>
                )}
                {detailTask.taskType && TASK_TYPE_STYLES[detailTask.taskType] && (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${TASK_TYPE_STYLES[detailTask.taskType].bg} ${TASK_TYPE_STYLES[detailTask.taskType].text}`}>
                    {TASK_TYPE_STYLES[detailTask.taskType].emoji} {detailTask.taskType}
                  </span>
                )}
                {detailTask.date && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    📅 {new Date(detailTask.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${detailTask.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {detailTask.completed ? '✓ Terminée' : '○ En cours'}
                </span>
              </div>

              {/* Owner/Assignee - Clickable */}
              <div className="bg-sky-50 rounded-lg p-3 border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-sky-700 uppercase">👤 Responsable</h4>
                  <button
                    onClick={() => setDetailAssigneeOpen(!detailAssigneeOpen)}
                    className="text-xs text-sky-600 hover:text-sky-800"
                  >
                    {detailAssigneeOpen ? 'Fermer' : 'Modifier'}
                  </button>
                </div>
                {detailAssigneeOpen ? (
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: null, label: 'Non assigné', icon: '○', bg: 'bg-gray-100 text-gray-600' },
                      { value: 'Jeremy', label: 'Jeremy', icon: '👤', bg: 'bg-blue-100 text-blue-700' },
                      { value: 'Perrine', label: 'Perrine', icon: '👤', bg: 'bg-yellow-100 text-yellow-700' },
                      { value: 'Jeremy, Perrine', label: 'Commun', icon: '👥', bg: 'bg-purple-100 text-purple-700' }
                    ].map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => updateDetailAssignee(opt.value)}
                        disabled={detailSaving}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          detailTask.assignee === opt.value ? opt.bg + ' ring-2 ring-offset-1 ring-sky-400' : 'bg-white border border-gray-200 hover:bg-gray-50'
                        } ${detailSaving ? 'opacity-50' : ''}`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => setDetailAssigneeOpen(true)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer hover:opacity-80 ${
                      detailTask.assignee?.includes('Jeremy') && detailTask.assignee?.includes('Perrine')
                        ? 'bg-purple-100 text-purple-700'
                        : detailTask.assignee?.includes('Jeremy')
                          ? 'bg-blue-100 text-blue-700'
                          : detailTask.assignee?.includes('Perrine')
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {detailTask.assignee ? (
                      <>{detailTask.assignee.includes('Jeremy') && detailTask.assignee.includes('Perrine') ? '👥' : '👤'} {detailTask.assignee}</>
                    ) : (
                      <>○ Non assigné - cliquez pour assigner</>
                    )}
                  </button>
                )}
              </div>

              {/* Note/Comments - Editable */}
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-amber-700 uppercase">📝 Notes / Commentaires</h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={addCommentLine}
                      className="w-6 h-6 flex items-center justify-center bg-amber-200 hover:bg-amber-300 text-amber-700 rounded-full text-sm font-bold"
                      title="Ajouter une ligne de commentaire"
                    >
                      +
                    </button>
                    <button
                      onClick={() => { setEditingNote(!editingNote); setDetailNote(detailTask.note || ''); }}
                      className="text-xs text-amber-600 hover:text-amber-800"
                    >
                      {editingNote ? 'Annuler' : (detailTask.note ? 'Modifier' : 'Ajouter')}
                    </button>
                  </div>
                </div>
                {editingNote ? (
                  <div className="space-y-2">
                    <textarea
                      value={detailNote}
                      onChange={(e) => setDetailNote(e.target.value)}
                      placeholder="Ajouter un commentaire..."
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={improveText}
                        disabled={isImproving || !detailNote.trim()}
                        className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${isImproving ? 'bg-amber-200 text-amber-600' : detailNote.trim() ? 'bg-amber-100 hover:bg-amber-200 text-amber-700' : 'bg-gray-100 text-gray-400'}`}
                        title="Améliorer avec l'IA"
                      >
                        {isImproving ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        ) : (
                          <span>✨</span>
                        )}
                        Améliorer
                      </button>
                      <button
                        onClick={saveDetailNote}
                        disabled={detailSaving}
                        className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50"
                      >
                        {detailSaving ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                ) : detailTask.note ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailTask.note}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Aucun commentaire</p>
                )}
              </div>

              {/* Dossier - Light blue */}
              {detailTask.dossier && (
                <div className="bg-sky-50 rounded-lg p-3 border border-sky-100">
                  <h4 className="text-xs font-semibold text-sky-700 uppercase mb-2">📁 Dossier rattaché</h4>
                  <button
                    onClick={() => { setDetailTask(null); onOpenDossier && onOpenDossier(detailTask.dossier.id); }}
                    className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-sky-200 hover:bg-sky-100 transition-colors text-sm"
                  >
                    <span className="font-medium text-gray-900">{detailTask.dossier.name}</span>
                    {detailTask.dossier.phone && <span className="text-gray-500">• {detailTask.dossier.phone}</span>}
                  </button>
                </div>
              )}

              {/* Project - Light blue with selector */}
              <div className="bg-sky-50 rounded-lg p-3 border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-sky-700 uppercase">📋 Projet rattaché</h4>
                  {!detailTask.project && (
                    <button
                      onClick={() => setShowProjectSelector(!showProjectSelector)}
                      className="text-xs text-sky-600 hover:text-sky-800"
                    >
                      {showProjectSelector ? 'Annuler' : 'Lier un projet'}
                    </button>
                  )}
                </div>
                {showProjectSelector ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {/* Get unique projects from dossier */}
                    {[...new Map((tasksData?.tasks || [])
                      .filter(t => t.dossierId === detailTask.dossierId && t.project)
                      .map(t => [t.projectId, t.project])
                    ).entries()].map(([projId, proj]) => (
                      <button
                        key={projId}
                        onClick={() => linkProjectToTask(projId)}
                        disabled={detailSaving}
                        className="w-full text-left px-3 py-2 bg-white rounded-lg border border-sky-200 hover:bg-sky-100 transition-colors text-sm disabled:opacity-50"
                      >
                        <span className="font-medium">{proj.name}</span>
                        {proj.type && <span className="ml-2 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-600">{proj.type}</span>}
                      </button>
                    ))}
                    {[...new Map((tasksData?.tasks || [])
                      .filter(t => t.dossierId === detailTask.dossierId && t.project)
                      .map(t => [t.projectId, t.project])
                    ).entries()].length === 0 && (
                      <p className="text-xs text-gray-400 italic">Aucun projet disponible dans ce dossier</p>
                    )}
                  </div>
                ) : detailTask.project ? (
                  <button
                    onClick={() => { setDetailTask(null); onOpenProject && onOpenProject(detailTask.projectId); }}
                    className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-sky-200 hover:bg-sky-100 transition-colors text-sm"
                  >
                    <span className="font-medium text-gray-900">{detailTask.project.name}</span>
                    {detailTask.project.type && <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-600">{detailTask.project.type}</span>}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowProjectSelector(true)}
                    className="text-sm text-sky-600 hover:text-sky-800 italic"
                  >
                    + Lier à un projet
                  </button>
                )}
              </div>

              {/* Related tasks from same project - with add button */}
              {detailTask.projectId && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Autres tâches du projet</h4>
                    <button
                      onClick={() => setShowAddTask(!showAddTask)}
                      className="w-6 h-6 flex items-center justify-center bg-sky-100 hover:bg-sky-200 text-sky-600 rounded-full text-sm font-bold"
                      title="Ajouter une tâche"
                    >
                      +
                    </button>
                  </div>
                  {showAddTask && (
                    <div className="space-y-2 mb-3 p-3 bg-sky-50 rounded-lg border border-sky-200">
                      <input
                        type="text"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        placeholder="Nom de la nouvelle tâche..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Échéance <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            value={newTaskDate}
                            onChange={(e) => setNewTaskDate(e.target.value)}
                            className={`w-full px-2 py-1.5 border rounded text-xs ${!newTaskDate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Responsable <span className="text-red-500">*</span></label>
                        <div className="flex gap-1">
                          {['Jeremy', 'Perrine', 'Jeremy, Perrine'].map(a => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => setNewTaskAssignee(a)}
                              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                                newTaskAssignee === a
                                  ? a === 'Jeremy' ? 'bg-blue-500 text-white'
                                    : a === 'Perrine' ? 'bg-yellow-500 text-white'
                                    : 'bg-purple-500 text-white'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {a === 'Jeremy, Perrine' ? '👥' : '👤'} {a === 'Jeremy, Perrine' ? 'Commun' : a}
                            </button>
                          ))}
                        </div>
                        {!newTaskAssignee && <p className="text-xs text-red-500 mt-1">Obligatoire</p>}
                      </div>
                      <button
                        onClick={addTaskToProject}
                        disabled={detailSaving || !newTaskName.trim() || !newTaskDate || !newTaskAssignee}
                        className="w-full px-3 py-2 bg-sky-500 text-white rounded-lg text-sm hover:bg-sky-600 disabled:opacity-50"
                      >
                        {detailSaving ? 'Création...' : 'Créer la tâche'}
                      </button>
                    </div>
                  )}
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(tasksData?.tasks || [])
                      .filter(t => t.projectId === detailTask.projectId && t.id !== detailTask.id)
                      .slice(0, 5)
                      .map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setDetailTask(t); setDetailNote(t.note || ''); setEditingNote(false); setShowAddTask(false); }}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-gray-100 flex items-center gap-2 ${t.completed ? 'text-gray-400' : 'text-gray-700'}`}
                        >
                          <span className={`w-3 h-3 rounded border ${t.completed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}></span>
                          <span className={t.completed ? 'line-through' : ''}>{t.name}</span>
                          {t.date && <span className="text-gray-400 ml-auto">{new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
                        </button>
                      ))}
                    {(tasksData?.tasks || []).filter(t => t.projectId === detailTask.projectId && t.id !== detailTask.id).length === 0 && (
                      <p className="text-xs text-gray-400 italic">Aucune autre tâche sur ce projet</p>
                    )}
                  </div>
                </div>
              )}

              {/* Related tasks from same dossier */}
              {detailTask.dossierId && (
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Autres tâches du dossier</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(tasksData?.tasks || [])
                      .filter(t => t.dossierId === detailTask.dossierId && t.id !== detailTask.id && t.projectId !== detailTask.projectId)
                      .slice(0, 5)
                      .map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setDetailTask(t); setDetailNote(t.note || ''); setEditingNote(false); }}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-gray-100 flex items-center gap-2 ${t.completed ? 'text-gray-400' : 'text-gray-700'}`}
                        >
                          <span className={`w-3 h-3 rounded border ${t.completed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}></span>
                          <span className={t.completed ? 'line-through' : ''}>{t.name}</span>
                          {t.project?.name && <span className="text-purple-500 text-xs ml-1">({t.project.name})</span>}
                        </button>
                      ))}
                    {(tasksData?.tasks || []).filter(t => t.dossierId === detailTask.dossierId && t.id !== detailTask.id && t.projectId !== detailTask.projectId).length === 0 && (
                      <p className="text-xs text-gray-400 italic">Aucune autre tâche sur ce dossier</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-gray-100 flex justify-between">
              <button
                onClick={() => { setDetailTask(null); openEditModal(detailTask); }}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <Icon name="edit" className="w-4 h-4" />
                Modifier
              </button>
              <button
                onClick={() => {
                  if (detailTask.completed) {
                    // Reopen task
                    toggleTask(detailTask, false);
                    setDetailTask({ ...detailTask, completed: false });
                  } else {
                    // Complete and show next task
                    completeTaskAndShowNext();
                  }
                }}
                className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 ${
                  detailTask.completed
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}
              >
                <Icon name="check" className="w-4 h-4" />
                {detailTask.completed ? 'Réouvrir' : 'Terminer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

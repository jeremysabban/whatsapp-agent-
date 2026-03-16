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
  };
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icons[name]}</svg>);
}

// Task type styles
const TASK_TYPE_STYLES = {
  Appel: { emoji: '📞', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Email: { emoji: '📧', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Autre: { emoji: '✅', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' }
};

export default function CalendarView({ tasksData, onTasksLoaded }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [calendarConfigured, setCalendarConfigured] = useState(true);
  const [calendarError, setCalendarError] = useState(null);
  const [togglingTaskId, setTogglingTaskId] = useState(null);

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
  const loadEvents = async () => {
    setLoadingEvents(true);
    setCalendarError(null);

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

  // Filter tasks for selected date
  const tasksForDate = (tasksData?.tasks || []).filter(task => {
    if (!task.date || task.completed) return false;
    const taskDate = new Date(task.date);
    return taskDate.toDateString() === selectedDate.toDateString();
  });

  // Toggle task completion
  const toggleTask = async (task, completed) => {
    if (togglingTaskId) return;
    setTogglingTaskId(task.id);

    // Optimistic update
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
      // Revert on error
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

  // Format event time
  const formatEventTime = (event) => {
    if (event.allDay) return 'Journée';
    const start = new Date(event.start);
    const end = new Date(event.end);
    return `${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  };

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
            onClick={loadEvents}
            disabled={loadingEvents}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors disabled:opacity-50"
          >
            <Icon name="refresh" className={`w-4 h-4 ${loadingEvents ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={prevDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
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

          <button
            onClick={nextDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Icon name="chevronRight" className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {!isToday(selectedDate) && (
          <div className="text-center mt-2">
            <button
              onClick={goToToday}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Revenir à aujourd'hui
            </button>
          </div>
        )}
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
                Visitez <code className="bg-gray-100 px-1 rounded">/api/auth/gmail/callback</code> pour autoriser l'accès au calendrier
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
                      {event.location && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">📍 {event.location}</p>
                      )}
                      {event.attendees?.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          👥 {event.attendees.length} participant{event.attendees.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Ouvrir dans Google Calendar"
                      >
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
              Tâches du jour
            </h2>
          </div>

          {tasksForDate.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <p className="text-sm">Aucune tâche prévue ce jour</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {tasksForDate.map(task => {
                const typeStyle = TASK_TYPE_STYLES[task.taskType] || null;
                return (
                  <div key={task.id} className="px-4 py-3 hover:bg-gray-50 flex items-start gap-3">
                    <button
                      onClick={() => toggleTask(task, !task.completed)}
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
                      <p className={`text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {task.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {/* Task type badge */}
                        {typeStyle && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeStyle.bg} ${typeStyle.text} border ${typeStyle.border}`}>
                            {typeStyle.emoji} {task.taskType}
                          </span>
                        )}
                        {/* Assignee */}
                        {task.assignee && (
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            task.assignee === 'Jeremy' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            <Icon name="user" className="w-3 h-3" />
                            {task.assignee}
                          </span>
                        )}
                        {/* Dossier */}
                        {task.dossier?.name && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            📁 {task.dossier.name}
                          </span>
                        )}
                        {/* Project */}
                        {task.project?.name && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            📋 {task.project.name}
                          </span>
                        )}
                      </div>
                    </div>

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
              })}
            </div>
          )}
        </div>

        {/* Overdue tasks warning */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const overdueTasks = (tasksData?.tasks || []).filter(task => {
            if (!task.date || task.completed) return false;
            const taskDate = new Date(task.date);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate < today;
          });

          if (overdueTasks.length === 0 || !isToday(selectedDate)) return null;

          return (
            <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-100 border-b border-red-200">
                <h2 className="font-semibold text-red-800 flex items-center gap-2">
                  <Icon name="alert" className="w-4 h-4" />
                  Tâches en retard ({overdueTasks.length})
                </h2>
              </div>
              <div className="divide-y divide-red-100">
                {overdueTasks.slice(0, 5).map(task => {
                  const typeStyle = TASK_TYPE_STYLES[task.taskType] || null;
                  return (
                    <div key={task.id} className="px-4 py-3 hover:bg-red-50/50 flex items-start gap-3">
                      <button
                        onClick={() => toggleTask(task, true)}
                        disabled={togglingTaskId === task.id}
                        className="mt-0.5 w-5 h-5 rounded border-2 border-red-300 hover:border-emerald-500 flex items-center justify-center transition-colors flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-red-800">{task.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                            📅 {new Date(task.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                          {typeStyle && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                              {typeStyle.emoji} {task.taskType}
                            </span>
                          )}
                        </div>
                      </div>
                      <a
                        href={task.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-red-200 rounded transition-colors flex-shrink-0"
                      >
                        <Icon name="external" className="w-4 h-4 text-red-400" />
                      </a>
                    </div>
                  );
                })}
                {overdueTasks.length > 5 && (
                  <div className="px-4 py-2 text-xs text-red-600 text-center">
                    +{overdueTasks.length - 5} autres tâches en retard
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

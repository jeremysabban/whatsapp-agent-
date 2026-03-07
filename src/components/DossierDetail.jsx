'use client';

import { useState, useEffect } from 'react';

const TYPE_COLORS = {
  Lead: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  Sinistre: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  Gestion: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' }
};

const TYPE_ICONS = {
  Lead: '💰',
  Sinistre: '🚨',
  Gestion: '📋'
};

function Icon({ name, className = 'w-4 h-4' }) {
  const icons = {
    back: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
    message: <><path strokeLinecap="round" strokeLinejoin="round" d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></>,
    mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    plus: <><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></>,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronUp: <path d="m18 15-6-6-6 6" />,
  };
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icons[name]}</svg>);
}

export default function DossierDetail({ dossier, onBack, onOpenConversation }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [togglingTaskId, setTogglingTaskId] = useState(null);

  useEffect(() => {
    if (dossier?.id) {
      loadDetail(dossier.id);
    }
  }, [dossier?.id]);

  const loadDetail = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notion/dossiers/${id}`);
      const data = await res.json();
      setDetail(data);
      // Expand all projects by default
      const expanded = {};
      data.projects?.forEach(p => { expanded[p.id] = true; });
      setExpandedProjects(expanded);
    } catch (err) {
      console.error('Erreur chargement dossier:', err);
    }
    setLoading(false);
  };

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const toggleTask = async (task, completed) => {
    if (togglingTaskId) return;
    setTogglingTaskId(task.id);

    // Optimistic update
    setDetail(prev => {
      if (!prev) return prev;
      const updateTasks = (tasks) =>
        tasks.map(t => t.id === task.id ? { ...t, completed } : t);

      return {
        ...prev,
        projects: prev.projects.map(p => ({
          ...p,
          tasks: updateTasks(p.tasks)
        })),
        orphanTasks: updateTasks(prev.orphanTasks)
      };
    });

    try {
      const res = await fetch('/api/notion/update-task-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, completed })
      });

      if (!res.ok) {
        // Revert on error
        setDetail(prev => {
          if (!prev) return prev;
          const revertTasks = (tasks) =>
            tasks.map(t => t.id === task.id ? { ...t, completed: !completed } : t);

          return {
            ...prev,
            projects: prev.projects.map(p => ({
              ...p,
              tasks: revertTasks(p.tasks)
            })),
            orphanTasks: revertTasks(prev.orphanTasks)
          };
        });
      }
    } catch (err) {
      console.error('Erreur toggle task:', err);
    }

    setTogglingTaskId(null);
  };

  const handleOpenConversation = () => {
    const phone = detail?.dossier?.phone || dossier?.phone;
    if (phone && onOpenConversation) {
      // Clean phone number
      const cleanPhone = phone.replace(/\D/g, '');
      onOpenConversation(cleanPhone);
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
    return phone;
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const d = detail?.dossier || dossier;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Icon name="back" className="w-5 h-5 text-gray-600" />
          </button>

          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
            {getInitials(d?.name)}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{d?.name}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              {d?.phone && (
                <span className="flex items-center gap-1">
                  <Icon name="phone" className="w-3 h-3" />
                  {formatPhone(d.phone)}
                </span>
              )}
              {d?.email && (
                <span className="flex items-center gap-1">
                  <Icon name="mail" className="w-3 h-3" />
                  {d.email}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {d?.phone && (
              <button
                onClick={handleOpenConversation}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
              >
                <Icon name="message" className="w-4 h-4" />
                Conversation
              </button>
            )}
            {d?.url && (
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Ouvrir dans Notion"
              >
                <Icon name="external" className="w-5 h-5 text-gray-500" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Projects */}
            {detail?.projects?.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Projets ({detail.projects.length})
                </h2>
                {detail.projects.map(project => {
                  const colors = TYPE_COLORS[project.type] || TYPE_COLORS.Gestion;
                  const icon = TYPE_ICONS[project.type] || '📁';
                  const isExpanded = expandedProjects[project.id];
                  const pendingTasks = project.tasks?.filter(t => !t.completed) || [];
                  const completedTasks = project.tasks?.filter(t => t.completed) || [];

                  return (
                    <div
                      key={project.id}
                      className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}
                    >
                      {/* Project header */}
                      <div
                        onClick={() => toggleProject(project.id)}
                        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/50 transition-colors"
                      >
                        <span className="text-lg">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${colors.text}`}>{project.name}</span>
                            {project.completed && (
                              <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">Terminé</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {pendingTasks.length} tâche{pendingTasks.length > 1 ? 's' : ''} en cours
                            {completedTasks.length > 0 && ` • ${completedTasks.length} terminée${completedTasks.length > 1 ? 's' : ''}`}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                          {project.type}
                        </span>
                        <Icon
                          name={isExpanded ? 'chevronUp' : 'chevronDown'}
                          className="w-5 h-5 text-gray-400"
                        />
                      </div>

                      {/* Tasks */}
                      {isExpanded && project.tasks?.length > 0 && (
                        <div className="border-t border-gray-200 bg-white divide-y divide-gray-100">
                          {project.tasks.map(task => (
                            <div
                              key={task.id}
                              className="px-4 py-2 flex items-center gap-3 hover:bg-gray-50"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTask(task, !task.completed);
                                }}
                                disabled={togglingTaskId === task.id}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                  task.completed
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-gray-300 hover:border-emerald-500'
                                } ${togglingTaskId === task.id ? 'opacity-50' : ''}`}
                              >
                                {task.completed && <Icon name="check" className="w-3 h-3" />}
                              </button>
                              <span className={`flex-1 text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                {task.name}
                              </span>
                              {task.date && (
                                <span className="text-xs text-gray-400">
                                  {new Date(task.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {isExpanded && (!project.tasks || project.tasks.length === 0) && (
                        <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 italic">
                          Aucune tâche
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Orphan tasks */}
            {detail?.orphanTasks?.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Tâches sans projet ({detail.orphanTasks.length})
                </h2>
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {detail.orphanTasks.map(task => (
                    <div
                      key={task.id}
                      className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
                    >
                      <button
                        onClick={() => toggleTask(task, !task.completed)}
                        disabled={togglingTaskId === task.id}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                          task.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-gray-300 hover:border-emerald-500'
                        } ${togglingTaskId === task.id ? 'opacity-50' : ''}`}
                      >
                        {task.completed && <Icon name="check" className="w-3 h-3" />}
                      </button>
                      <span className={`flex-1 text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {task.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!detail?.projects?.length && !detail?.orphanTasks?.length && (
              <div className="text-center text-gray-500 py-8">
                <p>Aucun projet ou tâche pour ce dossier</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

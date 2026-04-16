'use client';

import { useState, useEffect, useCallback } from 'react';
import EntitySlideOver from './EntitySlideOver';
import DriveExplorer from './DriveExplorer';
import ClaudeButton from './ClaudeButton';
import AiNotesPanel from './AiNotesPanel';

export default function DossierDetailPanel({ dossierId, onClose, onOpenProject, onOpenTask, onOpenConversation, onOpenEntity, onCreateContract, conversations }) {
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dossierEmails, setDossierEmails] = useState([]);

  const fetchDossier = useCallback(async () => {
    if (!dossierId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notion/dossier-details?dossierId=${encodeURIComponent(dossierId)}`);
      if (!res.ok) throw new Error('Erreur chargement dossier');
      const data = await res.json();
      setDossier(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  useEffect(() => {
    fetchDossier();
  }, [fetchDossier]);

  useEffect(() => {
    if (!dossierId) return;
    fetch(`/api/emails/list?dossierId=${encodeURIComponent(dossierId)}`)
      .then(r => r.json())
      .then(data => setDossierEmails(data.emails || []))
      .catch(() => setDossierEmails([]));
  }, [dossierId]);

  const findConversationJid = () => {
    if (!dossierId || !conversations) return null;
    const conv = conversations.find(c => c.notion_dossier_id === dossierId);
    return conv?.jid || null;
  };

  const primaryContact = dossier?.contacts?.[0];

  return (
    <EntitySlideOver
      isOpen={!!dossierId}
      onClose={onClose}
      title={dossier?.dossier?.name || 'Chargement...'}
      subtitle={dossier?.dossier?.identifiant}
      headerRight={dossierId && <ClaudeButton dossierId={dossierId} dossierName={dossier?.dossier?.name} />}
    >
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
          {error}
        </div>
      )}

      {dossier && !loading && (
        <div className="space-y-5">
          {/* Contact info */}
          {primaryContact && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-gray-700">Contact</h3>
              <p className="text-sm text-gray-800">{primaryContact.name}</p>
              {primaryContact.phone && (
                <p className="text-sm text-gray-600">{primaryContact.phone}</p>
              )}
              {primaryContact.email && (
                <p className="text-sm text-gray-600">{primaryContact.email}</p>
              )}
            </div>
          )}

          {/* Links */}
          <div className="flex items-center gap-3 flex-wrap">
            {dossier.dossier?.url && (
              <a
                href={dossier.dossier.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-700"
                title="Ouvrir dans Notion"
              >
                Notion &#x27F6;
              </a>
            )}
            {dossier.dossier?.driveUrl && (
              <a
                href={dossier.dossier.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-700"
                title="Google Drive"
              >
                Drive &#x27F6;
              </a>
            )}
            {findConversationJid() && (
              <button
                onClick={() => onOpenConversation?.(findConversationJid())}
                className="text-sm text-green-600 hover:text-green-800"
                title="Ouvrir la conversation WhatsApp"
              >
                💬 WhatsApp
              </button>
            )}
            {dossier.dossier?.geminiUrl && (
              <a
                href={dossier.dossier.geminiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-500 hover:text-purple-700"
                title="Gemini"
              >
                Gemini &#x27F6;
              </a>
            )}
          </div>

          {/* Projects */}
          {dossier.projectsWithTasks?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Projets</h3>
              <div className="space-y-2">
                {dossier.projectsWithTasks.map(project => (
                  <button
                    key={project.id}
                    onClick={() => onOpenProject?.(project.id)}
                    className="w-full text-left p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800 truncate">{project.name}</span>
                      <span className="text-xs text-gray-400 ml-2 shrink-0">
                        {project.type || 'Projet'}
                      </span>
                    </div>
                    {project.niveau && (
                      <span className="text-xs text-gray-500">{project.niveau}</span>
                    )}
                    {project.tasks?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        {project.tasks.length} tâche{project.tasks.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Open tasks */}
          {dossier.orphanTasks?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Tâches ouvertes</h3>
              <div className="space-y-1.5">
                {dossier.orphanTasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => onOpenTask?.(task.id)}
                    className="w-full flex items-center gap-2 text-sm text-gray-700 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="flex-1 truncate">{task.name}</span>
                    {task.date && (
                      <span className="text-xs text-gray-400 shrink-0">{task.date}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contracts */}
          {(dossier.contracts?.length > 0 || onCreateContract) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Contrats</h3>
                {onCreateContract && (
                  <button
                    onClick={() => onCreateContract({ dossierId, dossierName: dossier?.dossier?.name })}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Contrat
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {dossier.contracts.map(contract => (
                  <button
                    key={contract.id}
                    onClick={() => onOpenEntity?.('contract', contract.id)}
                    className="w-full text-left p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800 truncate">{contract.name}</span>
                      <span className={`text-xs ml-2 shrink-0 px-1.5 py-0.5 rounded-full ${contract.desactive ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {contract.desactive ? 'Resilie' : 'Actif'}
                      </span>
                    </div>
                    {(contract.productType || contract.type_assurance) && (
                      <span className="text-xs text-gray-500">{contract.productType || contract.type_assurance}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes IA */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">📝 Notes IA</h3>
            <AiNotesPanel dossierId={dossierId} />
          </div>

          {/* Drive Explorer */}
          {dossier.dossier?.driveUrl && (
            <DriveExplorer
              driveUrl={dossier.dossier.driveUrl}
              folderName={dossier.dossier.name}
              compact={true}
              maxHeight="350px"
            />
          )}

          {/* Emails */}
          {dossierEmails.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📧 Emails</h3>
              <div className="space-y-1.5">
                {dossierEmails.map(email => {
                  const catColors = {
                    urgent: 'bg-red-100 text-red-700',
                    important: 'bg-orange-100 text-orange-700',
                    action: 'bg-yellow-100 text-yellow-700',
                    info: 'bg-blue-100 text-blue-700',
                    pub: 'bg-gray-100 text-gray-600',
                    social: 'bg-gray-100 text-gray-600',
                    spam: 'bg-red-50 text-red-600',
                  };
                  return (
                    <a
                      key={email.message_id}
                      href={`https://mail.google.com/mail/u/0/#all/${email.message_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${catColors[email.category] || 'bg-gray-100 text-gray-600'}`}>
                          {email.category}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {email.date ? new Date(email.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 truncate mt-1">{email.subject}</p>
                      <p className="text-xs text-gray-500 truncate">{email.from_name || email.from_email}</p>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contacts */}
          {dossier.contacts?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Contacts</h3>
              <div className="space-y-1.5">
                {dossier.contacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => onOpenEntity?.('contact', contact.id)}
                    className="w-full text-left p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800 truncate">{contact.name}</span>
                    </div>
                    {contact.phone && (
                      <span className="text-xs text-gray-500">{contact.phone}</span>
                    )}
                    {contact.email && (
                      <span className="text-xs text-gray-400 ml-2">{contact.email}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {dossier.stats && (
            <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              {dossier.stats.activeProjects} projet{dossier.stats.activeProjects !== 1 ? 's' : ''} actif{dossier.stats.activeProjects !== 1 ? 's' : ''}
              {' · '}
              {dossier.stats.totalTasks || 0} tâche{(dossier.stats.totalTasks || 0) !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </EntitySlideOver>
  );
}

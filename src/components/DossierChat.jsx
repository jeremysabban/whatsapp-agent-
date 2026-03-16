'use client';

import { useState, useEffect, useRef } from 'react';

function Icon({ name, className = 'w-4 h-4' }) {
  const icons = {
    send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
    paperclip: <><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></>,
    user: <><path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
    folder: <><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></>,
    file: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    message: <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></>,
    loader: <><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></>,
    bot: <><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2M20 14h2M15 13v2M9 13v2" /></>,
    x: <><path d="M18 6L6 18M6 6l12 12" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
}

export default function DossierChat({ dossierId, dossierNom, onClose }) {
  const [messages, setMessages] = useState([]);
  const [context360, setContext360] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [uploadedFile, setUploadedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load history on mount
  useEffect(() => {
    if (!dossierId) return;
    loadHistory();
  }, [dossierId]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/dossier-chat?dossierId=${encodeURIComponent(dossierId)}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.history || []);
        setContext360(data.context360 || null);
      }
    } catch (err) {
      console.error('Erreur chargement historique:', err);
    }
    setIsLoadingHistory(false);
  };

  const handleSend = async () => {
    if (!inputValue.trim() && !uploadedFile) return;
    if (isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Add user message to UI immediately
    const tempUserMsg = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const body = {
        dossierId,
        message: uploadedFile
          ? `Analyse ce document : ${uploadedFile.name}\n\n${userMessage || 'Résume ce document et identifie les points clés.'}`
          : userMessage
      };

      // If file uploaded, include it as base64 for Claude document API
      if (uploadedFile) {
        body.document = {
          type: 'base64',
          mediaType: uploadedFile.mediaType || 'application/pdf',
          data: uploadedFile.content
        };
        setUploadedFile(null);
      }

      const res = await fetch('/api/dossier-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (data.success) {
        // Add assistant response
        const assistantMsg = {
          role: 'assistant',
          content: data.response,
          actions: data.actions,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Update context360 if provided
        if (data.context360) {
          setContext360(data.context360);
        }
      } else {
        // Error response
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Erreur: ${data.error}`,
          timestamp: Date.now()
        }]);
      }

    } catch (err) {
      console.error('Erreur envoi message:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Erreur de connexion: ${err.message}`,
        timestamp: Date.now()
      }]);
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];

      // Determine media type
      let mediaType = 'application/pdf';
      if (file.type) {
        mediaType = file.type;
      } else if (file.name.endsWith('.pdf')) {
        mediaType = 'application/pdf';
      } else if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
        mediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (file.name.endsWith('.txt')) {
        mediaType = 'text/plain';
      }

      setUploadedFile({
        name: file.name,
        content: base64,
        mediaType: mediaType,
        size: file.size
      });
    };
    reader.readAsDataURL(file);
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Column - Chat (70%) */}
      <div className="flex-1 flex flex-col min-w-0" style={{ flex: '0 0 70%' }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Icon name="bot" className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Chat Dossier</h2>
              <p className="text-xs text-gray-500">{dossierNom || dossierId}</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <Icon name="x" className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <Icon name="loader" className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Icon name="message" className="w-12 h-12 mb-3" />
              <p>Commencez la conversation...</p>
              <p className="text-sm mt-1">Posez une question ou uploadez un document</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  {msg.actions && msg.actions.length > 0 && !msg.actions[0].error && (
                    <div className={`mt-2 pt-2 border-t ${msg.role === 'user' ? 'border-blue-500' : 'border-gray-100'}`}>
                      <p className={`text-xs font-medium mb-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                        Actions:
                      </p>
                      {msg.actions.map((action, i) => (
                        <div key={i} className={`text-xs ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-600'}`}>
                          • {action.intention}: {action.content || action.project_name || ''}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Icon name="loader" className="w-4 h-4 text-gray-400 animate-spin" />
                  <span className="text-sm text-gray-500">Claude réfléchit...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Uploaded file preview */}
        {uploadedFile && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <Icon name="file" className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800 flex-1 truncate">{uploadedFile.name}</span>
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                {(uploadedFile.size / 1024).toFixed(0)} Ko
              </span>
              <button onClick={removeUploadedFile} className="p-1 hover:bg-blue-100 rounded">
                <Icon name="x" className="w-4 h-4 text-blue-600" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-lg flex-shrink-0"
              title="Joindre un document"
            >
              <Icon name="paperclip" className="w-5 h-5" />
            </button>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Écrivez votre message..."
              rows={1}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || (!inputValue.trim() && !uploadedFile)}
              className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Icon name="send" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Column - Context 360 (30%) */}
      <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Vue 360°</h3>
          <p className="text-xs text-gray-500">Contexte client</p>
        </div>

        {/* Dossier Info */}
        {context360?.dossier && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="folder" className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">Dossier</span>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-sm font-medium text-purple-900">{context360.dossier.name}</p>
              {context360.dossier.url && (
                <a
                  href={context360.dossier.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-600 hover:underline"
                >
                  Ouvrir dans Notion →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Contacts */}
        {context360?.contacts?.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="user" className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Contacts ({context360.contacts.length})</span>
            </div>
            <div className="space-y-2">
              {context360.contacts.map((contact, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-2">
                  <p className="text-sm font-medium text-gray-900">{contact.name || 'Sans nom'}</p>
                  {contact.phone && <p className="text-xs text-gray-500">{contact.phone}</p>}
                  {contact.email && <p className="text-xs text-gray-500">{contact.email}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projets */}
        {context360?.projets?.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="folder" className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-gray-700">Projets ({context360.projets.length})</span>
            </div>
            <div className="space-y-2">
              {context360.projets.map((projet, idx) => (
                <div key={idx} className={`rounded-lg p-2 ${projet.completed ? 'bg-gray-50' : 'bg-emerald-50'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${projet.completed ? 'text-gray-500 line-through' : 'text-emerald-900'}`}>
                      {projet.name}
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      projet.type === 'Lead' ? 'bg-purple-100 text-purple-700' :
                      projet.type === 'Sinistre' ? 'bg-red-100 text-red-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {projet.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contrats */}
        {context360?.contrats?.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="file" className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-gray-700">Contrats ({context360.contrats.length})</span>
            </div>
            <div className="space-y-2">
              {context360.contrats.map((contrat, idx) => (
                <div key={idx} className="bg-amber-50 rounded-lg p-2">
                  <p className="text-sm font-medium text-amber-900">{contrat.name}</p>
                  <p className="text-xs text-amber-700">{contrat.assureur} • {contrat.type}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents récents */}
        {context360?.recentDocs?.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="paperclip" className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Documents récents ({context360.recentDocs.length})</span>
            </div>
            <div className="space-y-2">
              {context360.recentDocs.map((doc, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-2 flex items-center gap-2">
                  <Icon name="file" className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500">{doc.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!context360 && !isLoadingHistory && (
          <div className="p-8 text-center text-gray-400">
            <Icon name="folder" className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">Aucune donnée disponible</p>
          </div>
        )}

        {isLoadingHistory && (
          <div className="p-8 flex items-center justify-center">
            <Icon name="loader" className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

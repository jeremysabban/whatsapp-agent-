'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'il y a quelques secondes';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
}

export default function AiNotesPanel({ dossierId }) {
  const [notes, setNotes] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [appendText, setAppendText] = useState('');
  const [showAppend, setShowAppend] = useState(false);
  const debounceRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!dossierId) return;
    fetch(`/api/dossiers/${encodeURIComponent(dossierId)}/ai-notes`)
      .then(r => r.json())
      .then(d => { setNotes(d.notes || ''); setUpdatedAt(d.updated_at || null); })
      .catch(() => {});
  }, [dossierId]);

  const save = useCallback(async (text) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/dossiers/${encodeURIComponent(dossierId)}/ai-notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: text }),
      });
      const d = await r.json();
      if (d.updated_at) setUpdatedAt(d.updated_at);
    } catch {}
    setSaving(false);
  }, [dossierId]);

  const handleChange = (text) => {
    setNotes(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(text), 2000);
  };

  const handleAppend = () => {
    if (!appendText.trim()) return;
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const block = `\n\n---\n\n**${date}** · Conversation Claude\n\n${appendText.trim()}\n`;
    const updated = block + (notes || '');
    setNotes(updated);
    save(updated);
    setAppendText('');
    setShowAppend(false);
  };

  if (!dossierId) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-[10px] text-gray-400">{saving ? 'Sauvegarde...' : timeAgo(updatedAt)}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAppend(!showAppend)}
            className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-600 bg-white hover:bg-slate-50"
          >
            📥 Import Claude
          </button>
          <button
            onClick={() => { setEditing(!editing); if (editing && textareaRef.current) save(notes); }}
            className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-600 bg-white hover:bg-slate-50"
          >
            {editing ? '✓ Terminer' : '✏️ Editer'}
          </button>
        </div>
      </div>

      {showAppend && (
        <div className="space-y-1.5 p-2 bg-orange-50 rounded-lg border border-orange-200">
          <textarea
            value={appendText}
            onChange={e => setAppendText(e.target.value)}
            placeholder="Coller le résumé Claude ici..."
            className="w-full text-xs border border-orange-300 rounded px-2 py-1.5 min-h-[80px] resize-y"
            rows={4}
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setShowAppend(false)} className="text-[11px] px-2 py-1 text-slate-500">Annuler</button>
            <button
              onClick={handleAppend}
              disabled={!appendText.trim()}
              className="text-[11px] px-3 py-1 rounded bg-orange-600 text-white font-medium hover:bg-orange-700 disabled:opacity-40"
            >
              Ajouter aux notes
            </button>
          </div>
        </div>
      )}

      {editing ? (
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={e => handleChange(e.target.value)}
          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 min-h-[200px] resize-y font-mono leading-relaxed"
          placeholder="Notes IA sur ce dossier..."
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="text-xs text-gray-700 whitespace-pre-wrap cursor-text min-h-[60px] px-1 py-1 rounded hover:bg-gray-50 leading-relaxed"
        >
          {notes || <span className="text-gray-400 italic">Aucune note IA. Cliquer pour ajouter.</span>}
        </div>
      )}
    </div>
  );
}

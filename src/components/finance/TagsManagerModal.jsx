'use client';
import { useState } from 'react';
import { TAG_COLOR_OPTIONS, tagClasses } from '@/lib/finance/tag-colors';

export default function TagsManagerModal({ tags, onClose, onChanged }) {
  const [rows, setRows] = useState(() => tags.map(t => ({ ...t })));
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const updateRow = (id, patch) => setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch, _dirty: true } : r));

  const saveRow = async (row, { retag = false } = {}) => {
    setSaving(true);
    await fetch('/api/finance/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, label: row.label, color: row.color, pattern: row.pattern, retag }),
    });
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, _dirty: false } : r));
    setSaving(false);
    onChanged?.();
  };

  const addTag = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    await fetch('/api/finance/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.trim(), color: 'slate', pattern: null }),
    });
    setNewLabel('');
    setSaving(false);
    onChanged?.();
  };

  const removeTag = async (id) => {
    if (id === 'autre') return;
    if (!confirm(`Supprimer le tag "${id}" ? Les transactions taguées passeront en "Autre".`)) return;
    setSaving(true);
    await fetch(`/api/finance/tags?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setRows(rs => rs.filter(r => r.id !== id));
    setSaving(false);
    onChanged?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-[10px] shadow-lg w-[760px] max-w-[95vw] max-h-[85vh] overflow-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Gérer les tags</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="text-slate-500 text-[11px] uppercase">
              <th className="text-left py-2 pr-2">Label</th>
              <th className="text-left py-2 pr-2">Couleur</th>
              <th className="text-left py-2 pr-2">Pattern (regex, optionnel)</th>
              <th className="text-left py-2 pr-2">Aperçu</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const cls = tagClasses(r.color).badge;
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2 pr-2">
                    <input
                      value={r.label}
                      onChange={e => updateRow(r.id, { label: e.target.value })}
                      className="border border-slate-300 rounded px-2 py-1 text-xs w-full"
                    />
                    <div className="text-[10px] text-slate-400 mt-0.5">{r.id}</div>
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={r.color}
                      onChange={e => updateRow(r.id, { color: e.target.value })}
                      className="border border-slate-300 rounded px-2 py-1 text-xs"
                    >
                      {TAG_COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={r.pattern || ''}
                      onChange={e => updateRow(r.id, { pattern: e.target.value })}
                      placeholder="ex: AMAZON|AMZN"
                      className="border border-slate-300 rounded px-2 py-1 text-xs w-full font-mono"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${cls}`}>{r.label}</span>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => saveRow(r, { retag: false })}
                      disabled={!r._dirty || saving}
                      className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40"
                    >
                      Enregistrer
                    </button>
                    <button
                      onClick={() => saveRow(r, { retag: true })}
                      disabled={saving}
                      title="Enregistrer + re-tagger toutes les transactions selon les patterns actuels"
                      className="text-[11px] px-2 py-1 ml-1 rounded border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40"
                    >
                      + Re-tagger
                    </button>
                    {r.id !== 'autre' && (
                      <button
                        onClick={() => removeTag(r.id)}
                        disabled={saving}
                        className="text-[11px] px-2 py-1 ml-1 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-40"
                      >
                        Suppr
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-5 pt-4 border-t border-slate-200 flex gap-2 items-center">
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Nom du nouveau tag"
            className="border border-slate-300 rounded px-2 py-1 text-xs flex-1"
          />
          <button
            onClick={addTag}
            disabled={saving || !newLabel.trim()}
            className="text-xs px-3 py-1 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40"
          >
            + Créer un tag
          </button>
        </div>

        <div className="mt-4 text-[11px] text-slate-500">
          💡 Le pattern est une regex. Exemples : <code className="bg-slate-100 px-1 rounded">AMAZON|AMZN</code>, <code className="bg-slate-100 px-1 rounded">SABBAN</code>, <code className="bg-slate-100 px-1 rounded">CLAUDE\.AI|ANTHROPIC</code>.
          Clique <strong>+ Re-tagger</strong> sur une ligne pour ré-appliquer tous les patterns sur toutes les transactions.
        </div>
      </div>
    </div>
  );
}

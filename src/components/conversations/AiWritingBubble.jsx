'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function AiWritingBubble({ isOpen, onClose, onSend }) {
  const [draft, setDraft] = useState('');
  const [improving, setImproving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setDraft('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleImprove = async () => {
    if (!draft.trim() || improving) return;
    setImproving(true);
    try {
      const res = await fetch('/api/ai/improve-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft, context: 'message WhatsApp professionnel mais cordial' })
      });
      const data = await res.json();
      if (data.improved) setDraft(data.improved);
    } catch {}
    setImproving(false);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center pb-20" onClick={onClose}>
      <div
        className="w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl border border-amber-200 animate-in slide-in-from-bottom-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100 rounded-t-xl">
          <span className="text-sm font-medium text-amber-800">✨ Aide à l'écriture IA</span>
          <button onClick={onClose} className="text-amber-400 hover:text-amber-600 text-xl leading-none px-1">×</button>
        </div>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tapez votre message ici, puis améliorez-le avec l'IA..."
          className="w-full px-4 py-3 text-sm text-[#3b4a54] placeholder-gray-400 resize-none focus:outline-none"
          style={{ height: '120px', overflow: 'auto' }}
        />
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-100 rounded-b-xl">
          <span className="text-[11px] text-gray-400">Enter = envoyer · Esc = fermer</span>
          <div className="flex items-center gap-2">
            <button onClick={handleImprove} disabled={improving || !draft.trim()}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${improving ? 'bg-amber-200 text-amber-700' : 'bg-amber-100 hover:bg-amber-200 text-amber-700'} disabled:opacity-40`}>
              {improving ? '⏳ ...' : '✨ Améliorer'}
            </button>
            <button onClick={handleSend} disabled={!draft.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[#25d366] text-white hover:bg-[#1fb855] disabled:opacity-40 transition-colors">
              Envoyer dans WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

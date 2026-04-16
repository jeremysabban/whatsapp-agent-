'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

let globalSendFn = null;

export function setGlobalSendFn(fn) {
  globalSendFn = fn;
}

export default function AiWritingBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [improving, setImproving] = useState(false);
  const inputRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleOpen = () => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); };
    const handleClose = () => { setIsOpen(false); setDraft(''); };
    const handleToggle = () => { setIsOpen(prev => { if (!prev) setTimeout(() => inputRef.current?.focus(), 50); return !prev; }); };
    window.addEventListener('ai-bubble-open', handleOpen);
    window.addEventListener('ai-bubble-close', handleClose);
    window.addEventListener('ai-bubble-toggle', handleToggle);
    return () => {
      window.removeEventListener('ai-bubble-open', handleOpen);
      window.removeEventListener('ai-bubble-close', handleClose);
      window.removeEventListener('ai-bubble-toggle', handleToggle);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') { setIsOpen(false); setDraft(''); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

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

  const handleSend = useCallback(() => {
    if (!draft.trim()) return;
    if (globalSendFn) globalSendFn(draft.trim());
    setDraft('');
    setIsOpen(false);
  }, [draft]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center pb-20" onClick={() => { setIsOpen(false); setDraft(''); }}>
      <div className="w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl border border-amber-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100 rounded-t-xl">
          <span className="text-sm font-medium text-amber-800">✨ Aide à l'écriture IA</span>
          <button onClick={() => { setIsOpen(false); setDraft(''); }} className="text-amber-400 hover:text-amber-600 text-xl leading-none px-1">×</button>
        </div>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tapez votre message, améliorez-le avec l'IA, puis envoyez dans WhatsApp..."
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

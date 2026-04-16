'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import EmojiPicker from 'emoji-picker-react';

function EmojiButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="p-2 text-[#54656f] hover:text-[#3b4a54] transition-colors rounded-full hover:bg-gray-100" title="Emoji">
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm3.5-9c.828 0 1.5-.671 1.5-1.5S16.328 8 15.5 8 14 8.671 14 9.5s.672 1.5 1.5 1.5zm-7 0c.828 0 1.5-.671 1.5-1.5S9.328 8 8.5 8 7 8.671 7 9.5 7.672 11 8.5 11zm3.5 6.5c2.033 0 3.882-1.06 4.908-2.786.127-.214.014-.521-.227-.593-.241-.072-.502.041-.632.253-.851 1.418-2.357 2.292-3.949 2.292s-3.098-.874-3.949-2.292c-.13-.212-.391-.325-.632-.253-.241.072-.354.379-.227.593C8.318 16.44 10.167 17.5 12.1 17.5z"/>
      </svg>
    </button>
  );
}

function AttachmentButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="p-2 text-[#54656f] hover:text-[#3b4a54] transition-colors rounded-full hover:bg-gray-100" title="Joindre un fichier">
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 003.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.501.501 1.134.761 1.765.761.634 0 1.268-.264 1.775-.772l7.916-7.916c.195-.195.195-.512 0-.707a.5.5 0 00-.707 0l-7.916 7.916c-.621.62-1.62.62-2.241 0-.621-.621-.621-1.62 0-2.241l7.916-7.916c1.061-1.061 2.94-.955 4.102.208.562.563.921 1.297.987 2.014.058.636-.178 1.248-.749 1.819l-9.548 9.548a4.082 4.082 0 01-2.899 1.2 4.08 4.08 0 01-2.897-1.199 4.08 4.08 0 01-1.2-2.899c0-1.095.427-2.124 1.201-2.897l8.483-8.483a.5.5 0 00-.707-.707l-8.483 8.483a5.579 5.579 0 00-1.646 3.971z"/>
      </svg>
    </button>
  );
}

function MicrophoneButton({ onClick, isRecording = false, disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`p-2 transition-colors rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : disabled ? 'text-gray-300 cursor-not-allowed' : 'text-[#54656f] hover:text-[#3b4a54] hover:bg-gray-100'}`}
      title={isRecording ? 'Arrêter' : 'Message vocal'}>
      {isRecording ? (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
      ) : (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
      )}
    </button>
  );
}

function SendButton({ onClick, disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`p-2 transition-colors rounded-full ${disabled ? 'text-gray-300 cursor-not-allowed' : 'text-[#54656f] hover:text-[#3b4a54] hover:bg-gray-100'}`}
      title="Envoyer">
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
    </button>
  );
}

export default function MessageInput({
  onSend,
  onSendFile,
  onRecordStart,
  onRecordStop,
  isRecording = false,
  isSending = false,
  disabled = false,
  placeholder = 'Tapez un message'
}) {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [fileAccept, setFileAccept] = useState('');

  const onEmojiClick = (emojiData) => {
    setText(prev => prev + emojiData.emoji);
    textareaRef.current?.focus();
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) onSendFile?.(file);
    e.target.value = '';
    setShowAttachMenu(false);
  };

  const openFilePicker = (accept) => {
    setFileAccept(accept);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.overflow = 'hidden';
    textarea.style.height = '0';
    const scrollH = textarea.scrollHeight;
    const maxH = 120;
    const newHeight = Math.min(scrollH, maxH);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflow = scrollH > maxH ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    requestAnimationFrame(adjustHeight);
  }, [text, adjustHeight]);

  const handleChange = (e) => setText(e.target.value);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSend = () => {
    if (!text.trim() || isSending || disabled) return;
    onSend?.(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      textareaRef.current.style.overflow = 'hidden';
    }
  };

  const handleRecordClick = () => {
    if (isRecording) onRecordStop?.();
    else onRecordStart?.();
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="relative bg-[#f0f2f5] px-4 py-2 border-t border-gray-200">
      <input ref={fileInputRef} type="file" accept={fileAccept} onChange={handleFileSelect} className="hidden" />

      {showEmojiPicker && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowEmojiPicker(false)} />
          <div className="absolute bottom-full mb-2 left-4 z-20">
            <EmojiPicker onEmojiClick={onEmojiClick} width={350} height={400} />
          </div>
        </>
      )}

      {showAttachMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowAttachMenu(false)} />
          <div className="absolute bottom-full mb-2 left-16 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[180px]">
            <button type="button" onClick={() => openFilePicker('image/*,video/*')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Photo/Video</button>
            <button type="button" onClick={() => openFilePicker('.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Document</button>
          </div>
        </>
      )}

      <div className="flex items-end gap-2">
        <div className="flex items-center">
          <EmojiButton onClick={() => setShowEmojiPicker(prev => !prev)} />
          <AttachmentButton onClick={() => setShowAttachMenu(prev => !prev)} />
        </div>

        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            rows={1}
            className="w-full px-3 py-2.5 text-[15px] text-[#3b4a54] placeholder-[#667781] resize-none focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
            style={{ minHeight: '40px', maxHeight: '120px', lineHeight: '20px', overflow: 'hidden' }}
          />
        </div>

        <div className="flex items-center gap-1">
          <button type="button"
            onClick={() => window.dispatchEvent(new Event('ai-bubble-toggle'))}
            className="p-2 rounded-full transition-colors bg-amber-50 hover:bg-amber-100 text-amber-600"
            title="Aide à l'écriture IA">
            <span className="text-base">✨</span>
          </button>
          {hasText ? (
            <SendButton onClick={handleSend} disabled={isSending || disabled} />
          ) : (
            <MicrophoneButton onClick={handleRecordClick} isRecording={isRecording} disabled={disabled} />
          )}
        </div>
      </div>

      {isRecording && (
        <div className="flex items-center justify-center gap-2 mt-2 text-red-500 text-sm">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Enregistrement en cours...
        </div>
      )}
      {isSending && (
        <div className="flex items-center justify-center gap-2 mt-2 text-gray-500 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Envoi en cours...
        </div>
      )}
    </div>
  );
}

export { EmojiButton, AttachmentButton, MicrophoneButton, SendButton };

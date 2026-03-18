'use client';

import { useState } from 'react';

// Image component with lightbox
function ImageMedia({ url, alt = '' }) {
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      <div
        className="relative cursor-pointer rounded-lg overflow-hidden max-w-[300px]"
        onClick={() => setShowLightbox(true)}
      >
        <img
          src={url}
          alt={alt}
          className="w-full h-auto max-h-[300px] object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
      </div>

      {/* Lightbox */}
      {showLightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={url}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={url}
            download
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-4 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Télécharger
          </a>
        </div>
      )}
    </>
  );
}

// Video component
function VideoMedia({ url }) {
  return (
    <div className="relative rounded-lg overflow-hidden max-w-[300px]">
      <video
        src={url}
        controls
        preload="metadata"
        className="w-full h-auto max-h-[300px]"
      />
    </div>
  );
}

// Audio/Voice note component - WhatsApp style
function AudioMedia({ url, isVoiceNote = false }) {
  return (
    <div className={`flex items-center gap-3 ${isVoiceNote ? 'min-w-[200px]' : 'min-w-[250px]'}`}>
      {isVoiceNote && (
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          </svg>
        </div>
      )}
      <audio
        src={url}
        controls
        preload="metadata"
        className="flex-1 h-10"
        style={{ minWidth: isVoiceNote ? '150px' : '200px' }}
      />
    </div>
  );
}

// Document component
function DocumentMedia({ url, filename, mimetype, onPreview }) {
  const isPdf = mimetype?.includes('pdf');
  const isWord = mimetype?.includes('word') || filename?.endsWith('.doc') || filename?.endsWith('.docx');
  const isExcel = mimetype?.includes('excel') || mimetype?.includes('spreadsheet') || filename?.endsWith('.xls') || filename?.endsWith('.xlsx');

  const getTypeInfo = () => {
    if (isPdf) return { label: 'PDF', bg: 'bg-red-100', color: 'text-red-600' };
    if (isWord) return { label: 'DOC', bg: 'bg-blue-100', color: 'text-blue-600' };
    if (isExcel) return { label: 'XLS', bg: 'bg-green-100', color: 'text-green-600' };
    return { label: 'DOC', bg: 'bg-gray-100', color: 'text-gray-600' };
  };

  const { label, bg, color } = getTypeInfo();

  return (
    <div
      onClick={() => onPreview?.({ url, filename, mimetype })}
      className="flex items-center gap-3 p-2.5 rounded-lg bg-white/50 hover:bg-white/80 border border-gray-200/50 cursor-pointer transition-colors min-w-[200px] max-w-[280px]"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
        <span className={`text-xs font-bold ${color}`}>{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {filename || 'Document'}
        </p>
        <p className="text-xs text-gray-500">
          Cliquer pour voir
        </p>
      </div>
      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

// Main export
export default function MessageMedia({ message, onPreviewDoc }) {
  const { media_url, media_mimetype, text, message_type } = message;

  if (!media_url) return null;

  const isImage = media_mimetype?.startsWith('image/');
  const isVideo = media_mimetype?.startsWith('video/');
  const isAudio = media_mimetype?.startsWith('audio/');
  const isVoiceNote = message_type === 'ptt' || (isAudio && media_mimetype?.includes('ogg'));

  if (isImage) {
    return <ImageMedia url={media_url} alt={text || ''} />;
  }

  if (isVideo) {
    return <VideoMedia url={media_url} />;
  }

  if (isAudio) {
    return <AudioMedia url={media_url} isVoiceNote={isVoiceNote} />;
  }

  // Document
  const filename = text?.replace('📎 ', '') || 'Document';
  return (
    <DocumentMedia
      url={media_url}
      filename={filename}
      mimetype={media_mimetype}
      onPreview={onPreviewDoc}
    />
  );
}

// Export sub-components for direct use
export { ImageMedia, VideoMedia, AudioMedia, DocumentMedia };

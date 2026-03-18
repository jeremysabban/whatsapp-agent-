'use client';

import MessageMedia from './MessageMedia';

// Format time for message
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Check icons component
function MessageStatus({ fromMe, isRead = true }) {
  if (!fromMe) return null;

  return (
    <svg
      className={`w-4 h-4 ml-1 flex-shrink-0 ${isRead ? 'text-[#53bdeb]' : 'text-gray-400'}`}
      viewBox="0 0 16 15"
      fill="currentColor"
    >
      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
    </svg>
  );
}

// Detect and render links in text
function renderTextWithLinks(text) {
  if (!text) return null;

  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);

  return parts.map((part, index) => {
    if (urlPattern.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#027eb5] hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function MessageBubble({
  message,
  showSenderName = false,
  senderName = '',
  isFirstInGroup = true,
  isLastInGroup = true,
  contactName = 'Contact',
  onPreviewDoc
}) {
  const { from_me, text, timestamp, media_url, is_document, message_type } = message;
  const hasMedia = !!media_url;
  const hasText = !!text && !is_document;

  // Determine bubble style based on position in group
  const getBubbleRadius = () => {
    if (from_me) {
      // Outgoing message - tail on top-right
      if (isFirstInGroup && isLastInGroup) return 'rounded-lg rounded-tr-sm';
      if (isFirstInGroup) return 'rounded-lg rounded-tr-sm rounded-br-md';
      if (isLastInGroup) return 'rounded-lg rounded-tr-md';
      return 'rounded-lg rounded-tr-md rounded-br-md';
    } else {
      // Incoming message - tail on top-left
      if (isFirstInGroup && isLastInGroup) return 'rounded-lg rounded-tl-sm';
      if (isFirstInGroup) return 'rounded-lg rounded-tl-sm rounded-bl-md';
      if (isLastInGroup) return 'rounded-lg rounded-tl-md';
      return 'rounded-lg rounded-tl-md rounded-bl-md';
    }
  };

  // Spacing based on group position
  const getMarginClass = () => {
    if (isLastInGroup) return 'mb-2';
    return 'mb-0.5';
  };

  return (
    <div className={`flex ${from_me ? 'justify-end' : 'justify-start'} ${getMarginClass()}`}>
      <div
        className={`
          relative max-w-[65%] min-w-[80px]
          ${from_me
            ? 'bg-[#d9fdd3]'
            : 'bg-white'
          }
          ${getBubbleRadius()}
          shadow-sm
          ${hasMedia ? 'p-1' : 'px-2.5 py-1.5'}
        `}
        style={{
          boxShadow: '0 1px 0.5px rgba(11, 20, 26, 0.13)'
        }}
      >
        {/* Bubble tail/arrow for first message in group */}
        {isFirstInGroup && (
          <div
            className={`absolute top-0 w-3 h-3 ${from_me ? '-right-1.5' : '-left-1.5'}`}
            style={{
              background: from_me ? '#d9fdd3' : 'white',
              clipPath: from_me
                ? 'polygon(0 0, 100% 0, 0 100%)'
                : 'polygon(100% 0, 0 0, 100% 100%)'
            }}
          />
        )}

        {/* Sender name for incoming messages */}
        {!from_me && showSenderName && isFirstInGroup && (
          <p className="text-[13px] font-medium text-[#06cf9c] mb-0.5 px-1">
            {senderName || contactName}
          </p>
        )}

        {/* Media content */}
        {hasMedia && (
          <div className={hasText ? 'mb-1' : ''}>
            <MessageMedia message={message} onPreviewDoc={onPreviewDoc} />
          </div>
        )}

        {/* Document placeholder (no media_url yet) */}
        {!media_url && is_document && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/50 border border-gray-200/50">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-100">
              <span className="text-xs font-bold text-red-500">PDF</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gray-900">
                {text?.replace('📎 ', '') || 'Document'}
              </p>
              <p className="text-xs text-gray-400">En attente...</p>
            </div>
          </div>
        )}

        {/* Text content */}
        {hasText && !is_document && (
          <p className={`text-[14.2px] text-[#111b21] whitespace-pre-wrap break-words leading-[19px] ${hasMedia ? 'px-1.5 pt-1' : ''}`}>
            {renderTextWithLinks(text)}
          </p>
        )}

        {/* Timestamp and status */}
        <div className={`flex items-center justify-end gap-0.5 ${hasMedia && !hasText ? 'absolute bottom-1 right-2 bg-black/30 px-1.5 py-0.5 rounded' : 'mt-0.5'}`}>
          <span className={`text-[11px] ${hasMedia && !hasText ? 'text-white' : 'text-[#667781]'}`}>
            {formatTime(timestamp)}
          </span>
          {from_me && (
            <MessageStatus fromMe={from_me} isRead={true} />
          )}
        </div>
      </div>
    </div>
  );
}

// Export helper
export { formatTime, MessageStatus, renderTextWithLinks };

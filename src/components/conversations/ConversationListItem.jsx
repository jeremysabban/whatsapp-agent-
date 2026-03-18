'use client';

// Status colors for CRM indicator
const STATUS_COLORS = {
  client: 'bg-emerald-500',
  assurance: 'bg-blue-500',
  prospect: 'bg-purple-500',
  apporteur: 'bg-amber-500',
  hsva: 'bg-gray-400',
  inbox: 'bg-slate-400',
};

// Media type labels
const MEDIA_LABELS = {
  image: '📷 Photo',
  video: '🎥 Vidéo',
  document: '📎 Document',
  audio: '🎵 Audio',
  ptt: '🎤 Vocal',
  sticker: '🏷️ Sticker'
};

// Format time ago
function timeAgo(timestamp) {
  if (!timestamp) return '';

  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins} min`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(diff / 86400000);
  if (days < 7) {
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return dayNames[new Date(timestamp).getDay()];
  }

  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit'
  });
}

// Format last message preview
function formatLastMessage(conv) {
  const type = conv.last_message_type || 'text';
  let text = conv.last_message;

  if (!text && type !== 'text') {
    text = MEDIA_LABELS[type] || '📎 Pièce jointe';
  }

  if (!text) return 'Aucun message';

  const prefix = conv.last_message_from_me ? 'Vous : ' : '';
  const full = prefix + text;

  return full.length > 50 ? full.slice(0, 50) + '...' : full;
}

// Get initials from name
function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

export default function ConversationListItem({
  conversation,
  isSelected = false,
  onClick
}) {
  const {
    display_name,
    name,
    whatsapp_name,
    phone,
    avatar_initials,
    avatar_color = 'bg-gray-500',
    status,
    unread_count = 0,
    last_message_time,
    last_message_from_me,
    labels = []
  } = conversation;

  const displayName = display_name || name || whatsapp_name || phone || 'Contact';
  const initials = avatar_initials || getInitials(displayName);
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.inbox;
  const hasUnread = unread_count > 0;

  return (
    <div
      onClick={() => onClick?.(conversation)}
      className={`
        flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
        ${isSelected
          ? 'bg-[#f0f2f5]'
          : 'hover:bg-[#f5f6f6]'
        }
      `}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium ${avatar_color}`}>
          {initials}
        </div>
        {/* Status indicator */}
        <div
          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${statusColor}`}
          title={status}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 border-b border-gray-100 pb-2.5">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          {/* Name */}
          <h3 className={`text-base truncate ${hasUnread ? 'font-semibold text-[#111b21]' : 'text-[#111b21]'}`}>
            {displayName}
          </h3>

          {/* Time */}
          <span className={`text-xs flex-shrink-0 ${hasUnread ? 'text-[#25d366] font-medium' : 'text-[#667781]'}`}>
            {timeAgo(last_message_time)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Last message */}
          <p className={`text-sm truncate ${hasUnread ? 'text-[#3b4a54] font-medium' : 'text-[#667781]'}`}>
            {/* Check marks for sent messages */}
            {last_message_from_me && (
              <svg className="w-4 h-4 inline-block mr-0.5 text-[#53bdeb]" viewBox="0 0 16 15" fill="currentColor">
                <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
              </svg>
            )}
            {formatLastMessage(conversation)}
          </p>

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Labels */}
            {labels.slice(0, 1).map((label, idx) => (
              <span
                key={idx}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
              >
                {label}
              </span>
            ))}

            {/* Unread badge */}
            {hasUnread && (
              <span className="min-w-[20px] h-5 px-1.5 bg-[#25d366] text-white text-xs font-medium rounded-full flex items-center justify-center">
                {unread_count > 99 ? '99+' : unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { STATUS_COLORS, MEDIA_LABELS, timeAgo, formatLastMessage, getInitials };

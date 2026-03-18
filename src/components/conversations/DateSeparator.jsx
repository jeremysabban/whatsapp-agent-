'use client';

export default function DateSeparator({ date }) {
  return (
    <div className="flex items-center justify-center my-3">
      <span className="bg-[#e2d6c8] text-[#54656f] text-[12.5px] px-3 py-1.5 rounded-lg shadow-sm font-medium">
        {date}
      </span>
    </div>
  );
}

// Helper function to get date separator text
export function getDateSeparatorText(timestamp) {
  const d = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today - msgDay) / 86400000);

  if (diff === 0) return "AUJOURD'HUI";
  if (diff === 1) return 'HIER';
  if (diff < 7) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long' }).toUpperCase();
  }
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  }).toUpperCase();
}

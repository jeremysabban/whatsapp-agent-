export const TAG_COLORS = {
  emerald: { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', ring: 'ring-emerald-500' },
  blue:    { badge: 'bg-blue-100 text-blue-700',       bar: 'bg-blue-500',    ring: 'ring-blue-500' },
  indigo:  { badge: 'bg-indigo-100 text-indigo-700',   bar: 'bg-indigo-500',  ring: 'ring-indigo-500' },
  violet:  { badge: 'bg-violet-100 text-violet-700',   bar: 'bg-violet-500',  ring: 'ring-violet-500' },
  cyan:    { badge: 'bg-cyan-100 text-cyan-700',       bar: 'bg-cyan-500',    ring: 'ring-cyan-500' },
  amber:   { badge: 'bg-amber-100 text-amber-800',     bar: 'bg-amber-500',   ring: 'ring-amber-500' },
  orange:  { badge: 'bg-orange-100 text-orange-700',   bar: 'bg-orange-500',  ring: 'ring-orange-500' },
  rose:    { badge: 'bg-rose-100 text-rose-700',       bar: 'bg-rose-500',    ring: 'ring-rose-500' },
  yellow:  { badge: 'bg-yellow-100 text-yellow-800',   bar: 'bg-yellow-500',  ring: 'ring-yellow-500' },
  slate:   { badge: 'bg-slate-100 text-slate-700',     bar: 'bg-slate-500',   ring: 'ring-slate-500' },
  zinc:    { badge: 'bg-zinc-100 text-zinc-700',       bar: 'bg-zinc-500',    ring: 'ring-zinc-500' },
  stone:   { badge: 'bg-stone-100 text-stone-700',     bar: 'bg-stone-500',   ring: 'ring-stone-500' },
  red:     { badge: 'bg-red-100 text-red-700',         bar: 'bg-red-500',     ring: 'ring-red-500' },
  pink:    { badge: 'bg-pink-100 text-pink-700',       bar: 'bg-pink-500',    ring: 'ring-pink-500' },
  teal:    { badge: 'bg-teal-100 text-teal-700',       bar: 'bg-teal-500',    ring: 'ring-teal-500' },
};

export const TAG_COLOR_OPTIONS = Object.keys(TAG_COLORS);

export function tagClasses(color) {
  return TAG_COLORS[color] || TAG_COLORS.slate;
}

const NATURE_BADGE_CLASS = {
  PRO: 'bg-blue-100 text-blue-700',
  PERSO: 'bg-orange-200 text-orange-800',
  HORS_EXPL: 'bg-slate-200 text-slate-600',
};
const NATURE_BADGE_LABEL = { PRO: 'Pro', PERSO: 'Perso', HORS_EXPL: 'Hors expl.' };

export default function NatureBadge({ nature }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${NATURE_BADGE_CLASS[nature] || ''}`}>
      {NATURE_BADGE_LABEL[nature] || nature}
    </span>
  );
}

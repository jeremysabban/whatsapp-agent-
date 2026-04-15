const TAG_CLASS = { CHARGE: 'bg-violet-100 text-violet-700', PERSO: 'bg-amber-100 text-amber-800' };
const TAG_LABEL = { CHARGE: 'Charge', PERSO: 'Perso' };

export default function TagBadge({ tag }) {
  const t = tag || 'CHARGE';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${TAG_CLASS[t] || TAG_CLASS.CHARGE}`}>
      {TAG_LABEL[t] || t}
    </span>
  );
}

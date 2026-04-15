import { tagClasses } from '@/lib/finance/tag-colors';

export default function TagBadge({ tag, tagsById }) {
  if (!tag) return null;
  const t = typeof tag === 'string' ? (tagsById?.[tag] || { id: tag, label: tag, color: 'slate' }) : tag;
  const cls = tagClasses(t.color).badge;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${cls}`}>
      {t.label}
    </span>
  );
}

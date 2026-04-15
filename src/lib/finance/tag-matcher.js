export function matchTag(rawDetail, tags) {
  const d = (rawDetail || '').toUpperCase();
  const sorted = [...tags].filter(t => t.pattern).sort((a, b) => (a.position || 0) - (b.position || 0));
  for (const t of sorted) {
    try {
      if (new RegExp(t.pattern, 'i').test(d)) return t.id;
    } catch {
      if (d.includes(t.pattern.toUpperCase())) return t.id;
    }
  }
  return 'autre';
}

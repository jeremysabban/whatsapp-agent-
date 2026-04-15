const nf = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtEuro(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '\u2212' : '';
  return `${sign}${nf.format(Math.abs(n))} \u20ac`;
}

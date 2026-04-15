'use client';
import { useState, useEffect, useMemo, Fragment, useCallback } from 'react';
import { fmtEuro } from '@/lib/finance/format';
import { tagClasses } from '@/lib/finance/tag-colors';
import NatureBadge from '@/components/finance/shared/NatureBadge';
import TagBadge from '@/components/finance/shared/TagBadge';
import TagsManagerModal from '@/components/finance/TagsManagerModal';

const NATURE_COLORS = {
  PRO: { bar: '#2563eb', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  PERSO: { bar: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  HORS_EXPL: { bar: '#94a3b8', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};
const NATURE_LABEL = { PRO: 'Pro', PERSO: 'Perso', HORS_EXPL: 'Hors expl.' };
const NATURE_ICON = { PRO: '🔵', PERSO: '🟠', HORS_EXPL: '⚪' };
const NATURE_GROUP_LABEL = { PRO: 'PRO', PERSO: 'PERSO', HORS_EXPL: 'HORS EXPLOITATION' };

const CATEGORIES_BY_NATURE = {
  PRO: ['Salaires','Loyer pro','Honoraires','Coaching','Mutuelle','Logiciels','Assurance Pro','Rbt exceptionnel client','Telecom','IT / Hébergement','Domiciliation','Formation','Réglementation','Frais bancaires','Autre Pro'],
  PERSO: ['Salaires','Alimentation & vie courante','Dons','Amazon','Shopping','Auto / Déplacements','Divers perso'],
  HORS_EXPL: ['Remboursement dette AL Holding','Apport associé','Autre hors expl.'],
};

function matchesSearch(txn, term) {
  if (!term) return true;
  const hay = [
    txn.short_label,
    txn.raw_detail,
    txn.category,
    String(Math.abs(txn.amount).toFixed(2)).replace('.', ','),
  ].join(' ').toLowerCase();
  return hay.includes(term);
}

const KPI_BAR_COLORS = {
  total: 'bg-slate-900',
  PRO: 'bg-blue-600',
  PERSO: 'bg-orange-500',
  HORS_EXPL: 'bg-slate-400',
  average: 'bg-emerald-500',
  CHARGE_TAG: 'bg-violet-600',
  PERSO_TAG: 'bg-amber-500',
};

export default function OverviewSubtab() {
  const [allTxns, setAllTxns] = useState([]);
  const [totalInflows, setTotalInflows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [natureFilter, setNatureFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [tags, setTags] = useState([]);
  const [tagsManagerOpen, setTagsManagerOpen] = useState(false);

  const tagsById = useMemo(() => Object.fromEntries(tags.map(t => [t.id, t])), [tags]);

  const fetchTags = useCallback(async () => {
    const r = await fetch('/api/finance/tags');
    const d = await r.json();
    setTags(d.tags || []);
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 150);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Fetch ALL transactions once (no search param)
  useEffect(() => {
    const params = new URLSearchParams({ from: '2026-01-01', to: '2026-12-31' });
    fetch(`/api/finance/outflows?${params}`)
      .then(r => r.json())
      .then(d => {
        setAllTxns(d.transactions || []);
        setTotalInflows(d.totalInflows || 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshData = useCallback(async () => {
    const params = new URLSearchParams({ from: '2026-01-01', to: '2026-12-31' });
    const r = await fetch(`/api/finance/outflows?${params}`);
    const d = await r.json();
    setAllTxns(d.transactions || []);
    setTotalInflows(d.totalInflows || 0);
  }, []);

  // Client-side filtering
  const filteredTxns = useMemo(() => {
    let list = allTxns;
    if (searchTerm) list = list.filter(t => matchesSearch(t, searchTerm));
    if (natureFilter) list = list.filter(t => t.nature === natureFilter);
    if (tagFilter) list = list.filter(t => (t.tag || 'autre') === tagFilter);
    return list;
  }, [allTxns, searchTerm, natureFilter, tagFilter]);

  // KPIs computed from filteredTxns
  const total = useMemo(() => filteredTxns.reduce((s, t) => s + t.amount, 0), [filteredTxns]);

  // Grand total (un-filtered) — for Taux de charges KPI only
  const grandTotal = useMemo(() => allTxns.reduce((s, t) => s + t.amount, 0), [allTxns]);

  const byNature = useMemo(() => {
    const map = {};
    for (const t of filteredTxns) {
      if (!map[t.nature]) map[t.nature] = { count: 0, total: 0 };
      map[t.nature].count++;
      map[t.nature].total += t.amount;
    }
    return map;
  }, [filteredTxns]);

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const t of filteredTxns) {
      const key = `${t.nature}|${t.category}`;
      const row = map.get(key) || { nature: t.nature, category: t.category, count: 0, total: 0, txns: [] };
      row.count++;
      row.total += t.amount;
      row.txns.push(t);
      map.set(key, row);
    }
    return [...map.values()];
  }, [filteredTxns]);

  // Tag totals — aggregate by dynamic tag id
  const tagTotals = useMemo(() => {
    const m = new Map();
    for (const t of filteredTxns) {
      const id = t.tag || 'autre';
      const row = m.get(id) || { id, count: 0, total: 0 };
      row.count++;
      row.total += t.amount;
      m.set(id, row);
    }
    const total = filteredTxns.reduce((s, t) => s + t.amount, 0);
    return [...m.values()]
      .map(r => ({ ...r, tag: tagsById[r.id] || { id: r.id, label: r.id, color: 'slate' }, pct: total !== 0 ? (r.total / total) * 100 : 0 }))
      .sort((a, b) => a.total - b.total);
  }, [filteredTxns, tagsById]);

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>;
  if (!allTxns.length) return <p className="text-gray-400">Aucune donnée</p>;

  const nbMonths = new Date().getMonth() + 1;

  const toggleCategory = (nature, category) => {
    const key = `${nature}|${category}`;
    const next = new Set(expandedCats);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedCats(next);
  };

  const handleUpdateTransaction = async (id, body) => {
    // Optimistic update — UI bouge instantanément
    setAllTxns(prev => prev.map(t => t.id === id ? { ...t, ...body, user_overridden: 1 } : t));
    await fetch(`/api/finance/outflows?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  };

  const kpiCardClass = (isActive) =>
    `relative overflow-hidden rounded-[10px] border border-slate-200 bg-white p-[14px_16px] cursor-pointer transition hover:-translate-y-px hover:shadow-md ${isActive ? 'ring-2 ring-slate-900' : ''}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Compte BNP · Année 2026 · {filteredTxns.length} opérations</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total */}
        <div className={kpiCardClass(natureFilter === '')} onClick={() => setNatureFilter('')}>
          <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${KPI_BAR_COLORS.total}`} />
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total dépensé</div>
          <div className="text-[22px] font-bold mt-1 tabular-nums">{fmtEuro(total)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{filteredTxns.length} ops</div>
        </div>
        {/* Nature cards */}
        {['PRO', 'PERSO', 'HORS_EXPL'].map(n => {
          const nd = byNature[n] || { count: 0, total: 0 };
          const pct = total !== 0 ? Math.round(Math.abs(nd.total / total) * 100) : 0;
          const isActive = natureFilter === n;
          return (
            <div key={n} className={kpiCardClass(isActive)} onClick={() => setNatureFilter(natureFilter === n ? '' : n)}>
              <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${KPI_BAR_COLORS[n]}`} />
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{NATURE_LABEL[n]}</div>
              <div className="text-[22px] font-bold mt-1 tabular-nums" style={{ color: NATURE_COLORS[n].bar }}>{fmtEuro(nd.total)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{nd.count} ops · {pct}%</div>
            </div>
          );
        })}
        {/* Average */}
        <div className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-white p-[14px_16px]">
          <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${KPI_BAR_COLORS.average}`} />
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Moyenne / mois</div>
          <div className="text-[22px] font-bold mt-1 tabular-nums text-emerald-600">{fmtEuro(total / nbMonths)}</div>
        </div>
      </div>

      {/* Dépenses par tag — tableau dynamique */}
      <div className="bg-white rounded-[10px] border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Dépenses par tag</div>
          <button
            onClick={() => setTagsManagerOpen(true)}
            className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-600 bg-white hover:bg-slate-50"
          >
            ⚙️ Gérer les tags
          </button>
        </div>
        {tagTotals.length === 0 ? (
          <div className="text-xs text-slate-400 py-2">Aucune transaction</div>
        ) : (
          <table className="w-full text-[12px] tabular-nums">
            <tbody>
              {tagTotals.map(row => {
                const cls = tagClasses(row.tag.color);
                const isActive = tagFilter === row.id;
                const barWidth = Math.min(Math.abs(row.pct), 100);
                return (
                  <tr
                    key={row.id}
                    onClick={() => setTagFilter(isActive ? '' : row.id)}
                    className={`cursor-pointer hover:bg-slate-50 ${isActive ? 'bg-slate-50 ring-1 ring-inset ' + cls.ring : ''}`}
                  >
                    <td className="py-1.5 pl-1 pr-2 w-[180px]">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${cls.badge}`}>{row.tag.label}</span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${cls.bar}`} style={{ width: `${barWidth}%` }} />
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 text-right text-slate-500 w-[70px]">{row.count} ops</td>
                    <td className="py-1.5 pr-3 text-right font-semibold w-[110px]">{fmtEuro(row.total)}</td>
                    <td className="py-1.5 pr-1 text-right text-slate-500 w-[60px]">{Math.abs(row.pct).toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Taux de charges — basé sur grandTotal (non filtré) */}
      {totalInflows > 0 && allTxns.length > 0 && (() => {
        const ratio = (Math.abs(grandTotal) / totalInflows) * 100;
        const barColor = ratio < 50 ? 'bg-emerald-500' : ratio < 75 ? 'bg-orange-500' : 'bg-red-500';
        const textColor = ratio < 50 ? 'text-emerald-600' : ratio < 75 ? 'text-orange-600' : 'text-red-600';
        return (
          <div className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-white p-[14px_16px]">
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">💰 Taux de charges · Dépenses / encaissements</div>
              <div className={`text-[18px] font-bold tabular-nums ${textColor}`}>{ratio.toFixed(1)} %</div>
            </div>
            <div className="mt-2 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(ratio, 100)}%` }} />
            </div>
            <div className="text-[11px] text-slate-400 mt-1 tabular-nums">{fmtEuro(grandTotal)} / {fmtEuro(totalInflows)}</div>
          </div>
        );
      })()}

      {/* Toolbar */}
      <div className="flex gap-3 items-center mb-4 px-3.5 py-3 bg-slate-100 rounded-lg text-xs">
        <input
          type="text"
          placeholder="Rechercher libellé, détail, montant..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md text-xs min-w-[200px]"
        />
        {natureFilter && <span className="text-slate-500">Nature: {NATURE_LABEL[natureFilter]}</span>}
        {tagFilter && <span className="text-slate-500">Tag: {tagsById[tagFilter]?.label || tagFilter}</span>}
        {(natureFilter || tagFilter || searchInput) && (
          <button onClick={() => { setSearchInput(''); setNatureFilter(''); setTagFilter(''); }} className="ml-auto text-blue-600 cursor-pointer font-medium">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Category table */}
      <div className="bg-white rounded-[10px] border border-slate-200 p-[18px] mb-5 overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">Catégorie</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">Nature</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">Tag</th>
              <th className="text-right px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">Ops</th>
              <th className="text-right px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">Montant</th>
              <th className="text-right px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">%</th>
              <th className="text-right px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">% CA</th>
            </tr>
          </thead>
          <tbody>
            {['PRO', 'PERSO', 'HORS_EXPL'].map(nature => {
              const rows = byCategory.filter(c => c.nature === nature);
              if (!rows.length) return null;
              const subtotal = rows.reduce((s, c) => s + c.total, 0);
              const opsCount = rows.reduce((s, c) => s + c.count, 0);
              const pct = total !== 0 ? Math.round(Math.abs(subtotal / total) * 100) : 0;
              const subPctCA = totalInflows > 0 ? (Math.abs(subtotal) / totalInflows) * 100 : null;
              return (
                <Fragment key={nature}>
                  {/* Group header */}
                  <tr className="bg-slate-50 font-bold cursor-default select-none">
                    <td colSpan={4} className="px-3 py-2.5 text-xs">
                      {NATURE_ICON[nature]} {NATURE_GROUP_LABEL[nature]}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right tabular-nums">{fmtEuro(subtotal)}</td>
                    <td className="px-3 py-2.5 text-xs text-right">{pct} %</td>
                    <td className="px-3 py-2.5 text-xs text-right tabular-nums font-semibold">{subPctCA == null ? '—' : `${subPctCA.toFixed(1)} %`}</td>
                  </tr>
                  {/* Category rows sorted by total ascending (most negative first) */}
                  {rows.sort((a, b) => a.total - b.total).map(cat => {
                    const catKey = `${cat.nature}|${cat.category}`;
                    const isExpanded = expandedCats.has(catKey);
                    const catPct = total !== 0 ? Math.round(Math.abs(cat.total / total) * 100) : 0;
                    const catPctCA = totalInflows > 0 ? (Math.abs(cat.total) / totalInflows) * 100 : null;
                    // Dominant tag for category
                    const tagCounts = {};
                    cat.txns.forEach(t => { const tg = t.tag || 'autre'; tagCounts[tg] = (tagCounts[tg] || 0) + 1; });
                    const dominantTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'autre';
                    return (
                      <Fragment key={catKey}>
                        <tr className="border-b border-slate-100 cursor-pointer hover:bg-slate-50/50"
                          onClick={() => toggleCategory(cat.nature, cat.category)}>
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-slate-400 mr-1.5">{isExpanded ? '▼' : '▶'}</span>
                            <span className="font-medium text-slate-800">{cat.category}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <NatureBadge nature={cat.nature} />
                          </td>
                          <td className="px-3 py-2.5">
                            <TagBadge tag={dominantTag} tagsById={tagsById} />
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500">{cat.count}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmtEuro(cat.total)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-400">{catPct}%</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs text-slate-600">{catPctCA == null ? '—' : `${catPctCA.toFixed(1)} %`}</td>
                        </tr>
                        {/* Transaction drilldown */}
                        {isExpanded && cat.txns.length > 0 && cat.txns.map(txn => (
                          <tr key={txn.id} className="bg-[#fafbfc] text-xs">
                            <td className="pl-9 py-2">
                              <span className="text-slate-500 whitespace-nowrap">{txn.date}</span>
                              {' · '}
                              <span className="font-semibold">{txn.short_label}</span>
                              {txn.user_overridden ? (
                                <span className="ml-1.5 inline-block px-1.5 py-px rounded text-[10px] bg-amber-100 text-amber-900">modifié</span>
                              ) : null}
                              <div className="text-[11px] text-slate-400 mt-0.5">{txn.raw_detail}</div>
                            </td>
                            <td className="py-2">
                              <select
                                className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white"
                                value={txn.nature}
                                onChange={e => handleUpdateTransaction(txn.id, { nature: e.target.value, category: CATEGORIES_BY_NATURE[e.target.value]?.[0] || '' })}
                              >
                                {['PRO', 'PERSO', 'HORS_EXPL'].map(n => <option key={n} value={n}>{NATURE_LABEL[n]}</option>)}
                              </select>
                            </td>
                            <td className="py-2">
                              <select
                                className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white"
                                value={txn.tag || 'autre'}
                                onChange={e => handleUpdateTransaction(txn.id, { tag: e.target.value })}
                              >
                                {tags.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                              </select>
                            </td>
                            <td className="py-2" colSpan={2}>
                              <select
                                className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white"
                                value={txn.category}
                                onChange={e => handleUpdateTransaction(txn.id, { category: e.target.value })}
                              >
                                {(CATEGORIES_BY_NATURE[txn.nature] || []).map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="py-2 text-right tabular-nums font-semibold">{fmtEuro(txn.amount)}</td>
                            <td className="py-2" />
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {tagsManagerOpen && (
        <TagsManagerModal
          tags={tags}
          onClose={() => setTagsManagerOpen(false)}
          onChanged={async () => { await fetchTags(); await refreshData(); }}
        />
      )}
    </div>
  );
}

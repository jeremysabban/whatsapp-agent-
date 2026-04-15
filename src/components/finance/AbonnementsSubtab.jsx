'use client';
import { useState, useEffect } from 'react';
import { fmtEuro } from '@/lib/finance/format';
import NatureBadge from '@/components/finance/shared/NatureBadge';

const KPI_BAR_COLORS = {
  total: 'bg-slate-900',
  PRO: 'bg-blue-600',
  PERSO: 'bg-orange-500',
  annualise: 'bg-emerald-500',
  inactifs: 'bg-slate-400',
  ytd: 'bg-blue-600',
};

export default function AbonnementsSubtab() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hideInactive, setHideInactive] = useState(false);
  const [natureFilter, setNatureFilter] = useState('');

  const fetchSubs = () => {
    setLoading(true);
    fetch('/api/finance/subscriptions').then(r => r.json()).then(d => setSubs(d.subscriptions || [])).finally(() => setLoading(false));
  };
  useEffect(() => { fetchSubs(); }, []);

  const handleToggleStatus = async (sub) => {
    const newStatus = sub.status === 'ACTIF' ? 'RESILIE' : 'ACTIF';
    await fetch('/api/finance/subscriptions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sub.id, status: newStatus }) });
    fetchSubs();
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>;

  const actifs = subs.filter(s => s.status === 'ACTIF');
  const filtered = subs.filter(s => {
    if (hideInactive && s.status !== 'ACTIF') return false;
    if (natureFilter && s.nature !== natureFilter) return false;
    if (search && !s.merchant.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalMonthly = actifs.reduce((s, sub) => s + sub.monthly_estimate, 0);
  const proMonthly = actifs.filter(s => s.nature === 'PRO').reduce((s, sub) => s + sub.monthly_estimate, 0);
  const persoMonthly = actifs.filter(s => s.nature === 'PERSO').reduce((s, sub) => s + sub.monthly_estimate, 0);
  const totalYearly = totalMonthly * 12;
  const inactiveCount = subs.filter(s => s.count_2026 === 0 && s.count_total > 0).length;
  const ytdTotal = actifs.reduce((s, sub) => s + sub.ytd_2026, 0);

  const kpiCardClickable = (isActive) =>
    `relative overflow-hidden rounded-[10px] border border-slate-200 bg-white p-[14px_16px] cursor-pointer transition hover:-translate-y-px hover:shadow-md ${isActive ? 'ring-2 ring-slate-900' : ''}`;

  const kpiCardStatic = 'relative overflow-hidden rounded-[10px] border border-slate-200 bg-white p-[14px_16px]';

  return (
    <div className="space-y-4">
      {/* KPI Row 1 - clickable */}
      <div className="grid grid-cols-3 gap-3">
        <div className={kpiCardClickable(natureFilter === '')} onClick={() => setNatureFilter('')}>
          <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${KPI_BAR_COLORS.total}`} />
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Coût mensuel actifs</div>
          <div className="text-[22px] font-bold mt-1 tabular-nums">{fmtEuro(totalMonthly)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{actifs.length} abonnements actifs</div>
        </div>
        <div className={kpiCardClickable(natureFilter === 'PRO')} onClick={() => setNatureFilter(natureFilter === 'PRO' ? '' : 'PRO')}>
          <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${KPI_BAR_COLORS.PRO}`} />
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Pro / mois</div>
          <div className="text-[22px] font-bold mt-1 tabular-nums text-blue-600">{fmtEuro(proMonthly)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{actifs.filter(s => s.nature === 'PRO').length} abos pro</div>
        </div>
        <div className={kpiCardClickable(natureFilter === 'PERSO')} onClick={() => setNatureFilter(natureFilter === 'PERSO' ? '' : 'PERSO')}>
          <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${KPI_BAR_COLORS.PERSO}`} />
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Perso / mois</div>
          <div className="text-[22px] font-bold mt-1 tabular-nums text-orange-600">{fmtEuro(persoMonthly)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{actifs.filter(s => s.nature === 'PERSO').length} abos perso</div>
        </div>
      </div>

      {/* KPI Row 2 - non-clickable */}
      <div className="grid grid-cols-3 gap-3">
        <div className={kpiCardStatic}>
          <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${KPI_BAR_COLORS.annualise}`} />
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Coût annualisé</div>
          <div className="text-[22px] font-bold mt-1 tabular-nums text-emerald-600">{fmtEuro(totalYearly)}</div>
        </div>
        <div className={kpiCardStatic}>
          <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${KPI_BAR_COLORS.inactifs}`} />
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Inactifs détectés</div>
          <div className="text-[22px] font-bold mt-1 tabular-nums text-slate-400">{inactiveCount}</div>
        </div>
        <div className={kpiCardStatic}>
          <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${KPI_BAR_COLORS.ytd}`} />
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Dépensé YTD 2026</div>
          <div className="text-[22px] font-bold mt-1 tabular-nums text-blue-600">{fmtEuro(ytdTotal)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 items-center mb-4 px-3.5 py-3 bg-slate-100 rounded-lg text-xs">
        <input type="text" placeholder="Rechercher un marchand..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-md text-xs min-w-[200px]" />
        <label className="flex items-center gap-1.5 text-slate-500 cursor-pointer">
          <input type="checkbox" checked={hideInactive} onChange={e => setHideInactive(e.target.checked)} className="rounded" />
          Masquer inactifs
        </label>
        {(search || natureFilter || hideInactive) && <button onClick={() => { setSearch(''); setNatureFilter(''); setHideInactive(false); }} className="ml-auto text-blue-600 cursor-pointer font-medium">Réinitialiser</button>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[10px] border border-slate-200 p-[18px] mb-5 overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">Abonnement</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">Catégorie</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">Cadence</th>
              <th className="text-right px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">€/mois</th>
              <th className="text-right px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">€/an</th>
              <th className="text-right px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">YTD 2026</th>
              <th className="text-center px-3 py-2 text-slate-500 font-semibold uppercase text-[11px] border-b border-slate-200">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.sort((a, b) => (a.status === 'ACTIF' ? 0 : 1) - (b.status === 'ACTIF' ? 0 : 1) || b.monthly_estimate - a.monthly_estimate).map(sub => {
              const isActive = sub.status === 'ACTIF';
              return (
                <tr key={sub.id} className={`border-b border-slate-100 ${!isActive ? 'opacity-[0.55]' : ''}`}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{sub.merchant}</p>
                    <p className="text-[11px] text-slate-400">{sub.count_total} transactions · depuis {sub.first_date || '—'}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <NatureBadge nature={sub.nature} />
                    <span className="ml-1.5 text-slate-600">{sub.category}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-600">{sub.cadence}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmtEuro(sub.monthly_estimate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fmtEuro(sub.yearly_estimate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fmtEuro(sub.ytd_2026)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {isActive ? '✅ Actif' : 'Résilié'}
                      </span>
                      <button
                        onClick={() => handleToggleStatus(sub)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border ${
                          isActive
                            ? 'border-red-300 text-red-700 bg-red-50 hover:border-red-400'
                            : 'border-slate-300 text-slate-600 bg-white hover:border-slate-400'
                        }`}
                      >
                        {isActive ? 'Marquer résilié' : 'Réactiver'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

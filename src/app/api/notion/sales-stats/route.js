import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// 48h in-memory cache
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours

// Fetch page title for a relation (Dossier or Assureur)
async function fetchPageName(id) {
  if (!id) return '';
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    const titleProp = Object.values(page.properties).find(p => p.id === 'title');
    return titleProp?.title?.[0]?.plain_text || 'Inconnu';
  } catch (e) { return '-'; }
}

export async function GET(request) {
  try {
    // Check for force refresh
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Return cache if valid
    if (!forceRefresh && cache.data && (Date.now() - cache.timestamp) < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // 1. Paginate all signed contracts (not deactivated, with signature date)
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const query = {
        database_id: process.env.NOTION_CONTRACTS_DB_ID,
        filter: {
          and: [
            { property: 'Desactivé', checkbox: { equals: false } },
            { property: '# Date de signature', date: { is_not_empty: true } },
          ],
        },
        sorts: [{ property: '# Date de signature', direction: 'descending' }],
        page_size: 100,
      };
      if (startCursor) query.start_cursor = startCursor;

      const response = await notion.databases.query(query);
      allResults.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    // 2. Strict commission logic (year-based priority)
    const contracts = allResults.map(p => {
      const dateStart = p.properties['# Date de signature']?.date?.start;
      const date = new Date(dateStart);
      const year = date.getFullYear();

      const com25 = p.properties['2025 Commission 1er année estimée (1)']?.number || 0;
      const com26 = p.properties['2026 Commission 1er année estimée']?.number || 0;

      // Strict: use the commission column matching the signature year
      let displayAmount = 0;
      if (year === 2025) displayAmount = com25;
      else if (year === 2026) displayAmount = com26;
      else displayAmount = Math.max(com25, com26); // Fallback

      // Try multiple ways to get contract number
      const titleProp = Object.values(p.properties).find(prop => prop.type === 'title');
      let contractNum = titleProp?.title?.[0]?.plain_text || '';
      if (!contractNum) {
        // Try N° Contrat or similar
        contractNum = p.properties['N° Contrat']?.rich_text?.[0]?.plain_text ||
                      p.properties['Numéro']?.rich_text?.[0]?.plain_text ||
                      p.properties['# Contrat']?.rich_text?.[0]?.plain_text || '';
      }
      if (!contractNum) {
        // Extract from URL as fallback (e.g., HST1372005401)
        const urlMatch = p.url?.match(/\/([A-Z]{2,4}\d+)-/);
        contractNum = urlMatch ? urlMatch[1] : 'N/A';
      }

      return {
        id: p.id,
        date: dateStart,
        year,
        month: date.getMonth(),
        contract_num: contractNum || 'N/A',
        dossier_id: p.properties['Dossiers']?.relation?.[0]?.id,
        assureur_id: p.properties["🍯 Code assurances"]?.relation?.[0]?.id || null,
        type: p.properties['Type Assurance']?.select?.name || 'Autre',
        amount: displayAmount,
        com25,
        com26,
        url: p.url,
      };
    });

    // 3. KPIs & Chart (Sept 2025 → today)
    const startStats = new Date('2025-09-01');
    const recentContracts = contracts.filter(c => c.date && new Date(c.date) >= startStats);

    const total25 = recentContracts.reduce((sum, c) => sum + c.com25, 0);
    const total26 = recentContracts.reduce((sum, c) => sum + c.com26, 0);

    // Group by month for chart
    const monthlyStats = {};
    recentContracts.forEach(c => {
      const d = new Date(c.date);
      const label = d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      if (!monthlyStats[label]) monthlyStats[label] = { amount: 0, count: 0, sort: d.getTime() };
      monthlyStats[label].amount += c.amount;
      monthlyStats[label].count += 1;
    });

    const chartData = Object.entries(monthlyStats)
      .map(([label, val]) => ({ label, amount: val.amount, count: val.count, sort: val.sort }))
      .sort((a, b) => a.sort - b.sort);

    // 4. Build 3 table lists
    const top2026List = contracts.filter(c => c.year === 2026).sort((a, b) => b.amount - a.amount).slice(0, 5);
    const topAllTimeList = [...contracts].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const now = new Date();
    const currentMonthList = contracts
      .filter(c => c.month === now.getMonth() && c.year === now.getFullYear())
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // 5. Enrich table entries with Dossier + Assureur names
    const enrichList = async (list) => {
      return Promise.all(list.map(async (item) => {
        const [dossier_name, assureur_name] = await Promise.all([
          fetchPageName(item.dossier_id),
          fetchPageName(item.assureur_id),
        ]);
        return { ...item, dossier_name, assureur_name };
      }));
    };

    const [top2026, topAllTime, currentMonth] = await Promise.all([
      enrichList(top2026List),
      enrichList(topAllTimeList),
      enrichList(currentMonthList),
    ]);

    // Enrich allContracts with dossier_name and assureur_name from 🍯 Code assurances relation
    const uniqueDossierIds = [...new Set(contracts.map(c => c.dossier_id).filter(Boolean))];
    const uniqueAssureurIds = [...new Set(contracts.map(c => c.assureur_id).filter(Boolean))];

    const [dossierNamesMap, assureurNamesMap] = await Promise.all([
      (async () => {
        const map = {};
        await Promise.all(uniqueDossierIds.map(async (id) => {
          map[id] = await fetchPageName(id);
        }));
        return map;
      })(),
      (async () => {
        const map = {};
        await Promise.all(uniqueAssureurIds.map(async (id) => {
          map[id] = await fetchPageName(id);
        }));
        return map;
      })()
    ]);

    const enrichedContracts = contracts.map(c => ({
      ...c,
      dossier_name: c.dossier_id ? (dossierNamesMap[c.dossier_id] || '') : '',
      assureur_name: c.assureur_id ? (assureurNamesMap[c.assureur_id] || '') : '',
    }));

    const result = {
      kpi: { total25: Math.round(total25), total26: Math.round(total26), volume: recentContracts.length },
      chart: chartData,
      tables: { top2026, topAllTime, currentMonth },
      allContracts: enrichedContracts,
    };

    // Store in cache
    cache = { data: result, timestamp: Date.now() };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sales stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

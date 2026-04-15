import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { CATEGORIES } from '@/lib/finance/categories';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || '2026-01-01';
    const to = searchParams.get('to') || '2026-12-31';
    const nature = searchParams.get('nature') || '';
    const search = searchParams.get('search') || '';

    const db = getDb();
    let q = 'SELECT * FROM bank_outflows WHERE date >= ? AND date <= ?';
    const params = [from, to];
    if (nature) { q += ' AND nature = ?'; params.push(nature); }
    if (search) { q += ' AND (short_label LIKE ? OR raw_detail LIKE ? OR CAST(amount AS TEXT) LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
    q += ' ORDER BY date DESC, amount ASC';
    const transactions = db.prepare(q).all(...params);

    const total = transactions.reduce((s, t) => s + t.amount, 0);
    const byNature = {};
    transactions.forEach(t => {
      if (!byNature[t.nature]) byNature[t.nature] = { count: 0, total: 0 };
      byNature[t.nature].count++;
      byNature[t.nature].total += t.amount;
    });
    const totalInflows = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS t
         FROM bank_commission_payments
         WHERE date BETWEEN ? AND ? AND amount > 0`
    ).get(from, to).t;

    const byCategory = [];
    const catMap = {};
    transactions.forEach(t => {
      const key = `${t.nature}|${t.category}`;
      if (!catMap[key]) catMap[key] = { nature: t.nature, category: t.category, count: 0, total: 0 };
      catMap[key].count++;
      catMap[key].total += t.amount;
    });
    Object.values(catMap).sort((a, b) => a.total - b.total).forEach(c => {
      const pctOfFiltered = total !== 0 ? Math.abs(c.total / total) * 100 : 0;
      const pctOfInflows = totalInflows > 0 ? (Math.abs(c.total) / totalInflows) * 100 : null;
      byCategory.push({ ...c, pctOfFiltered, pctOfInflows });
    });

    return NextResponse.json({ total, totalInflows, byNature, byCategory, transactions });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const { nature, category, tag } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const db = getDb();
    if (nature && category) {
      if (!CATEGORIES[nature]?.includes(category)) {
        return NextResponse.json({ error: `Category "${category}" not valid for nature "${nature}"` }, { status: 400 });
      }
      db.prepare('UPDATE bank_outflows SET nature = ?, category = ?, user_overridden = 1 WHERE id = ?').run(nature, category, id);
    } else if (nature) {
      db.prepare('UPDATE bank_outflows SET nature = ?, user_overridden = 1 WHERE id = ?').run(nature, id);
    } else if (category) {
      db.prepare('UPDATE bank_outflows SET category = ?, user_overridden = 1 WHERE id = ?').run(category, id);
    }
    if (tag) {
      db.prepare('UPDATE bank_outflows SET tag = ?, user_overridden = 1 WHERE id = ?').run(tag, id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

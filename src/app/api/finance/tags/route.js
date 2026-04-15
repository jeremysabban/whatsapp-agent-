import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { matchTag } from '@/lib/finance/tag-matcher';

export const dynamic = 'force-dynamic';

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tag';
}

export async function GET() {
  const db = getDb();
  const tags = db.prepare('SELECT id, label, color, pattern, position FROM finance_tags ORDER BY position ASC, label ASC').all();
  return NextResponse.json({ tags });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { label, color = 'slate', pattern = null } = body;
    if (!label || !label.trim()) return NextResponse.json({ error: 'label required' }, { status: 400 });
    const db = getDb();
    let id = slugify(label);
    const exists = db.prepare('SELECT id FROM finance_tags WHERE id = ?').get(id);
    if (exists) id = `${id}-${Date.now().toString(36).slice(-4)}`;
    const maxPos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM finance_tags').get().p;
    db.prepare('INSERT INTO finance_tags (id, label, color, pattern, position) VALUES (?, ?, ?, ?, ?)').run(id, label.trim(), color, pattern || null, maxPos);
    return NextResponse.json({ id, success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, label, color, pattern, position, retag } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const db = getDb();
    const sets = [];
    const vals = [];
    if (label !== undefined) { sets.push('label = ?'); vals.push(label); }
    if (color !== undefined) { sets.push('color = ?'); vals.push(color); }
    if (pattern !== undefined) { sets.push('pattern = ?'); vals.push(pattern || null); }
    if (position !== undefined) { sets.push('position = ?'); vals.push(position); }
    if (sets.length) {
      sets.push("updated_at = (strftime('%s','now')*1000)");
      vals.push(id);
      db.prepare(`UPDATE finance_tags SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }
    let retagged = 0;
    if (retag) {
      const tags = db.prepare('SELECT id, pattern, position FROM finance_tags ORDER BY position ASC').all();
      const rows = db.prepare('SELECT id, raw_detail FROM bank_outflows').all();
      const upd = db.prepare('UPDATE bank_outflows SET tag = ? WHERE id = ?');
      for (const r of rows) {
        const newTag = matchTag(r.raw_detail, tags);
        upd.run(newTag, r.id);
        retagged++;
      }
    }
    return NextResponse.json({ success: true, retagged });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (id === 'autre') return NextResponse.json({ error: 'tag "autre" non supprimable' }, { status: 400 });
    const db = getDb();
    db.prepare('UPDATE bank_outflows SET tag = ? WHERE tag = ?').run('autre', id);
    db.prepare('DELETE FROM finance_tags WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

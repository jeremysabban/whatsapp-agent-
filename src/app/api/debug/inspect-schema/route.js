import { NextResponse } from 'next/server';
import { NOTION_CONTRACTS_DB_ID, notionHeaders } from '@/lib/notion-config';

export async function GET() {
  try {
    // Fetch the database object to get property definitions
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONTRACTS_DB_ID}`, {
      headers: notionHeaders(),
    });
    if (!dbRes.ok) {
      const err = await dbRes.json();
      throw new Error(err.message || `Notion ${dbRes.status}`);
    }
    const db = await dbRes.json();

    // Extract property schema: name → type + config details
    const schema = {};
    for (const [name, prop] of Object.entries(db.properties)) {
      const entry = { type: prop.type };

      // Include select/multi_select options
      if (prop.type === 'select' && prop.select?.options) {
        entry.options = prop.select.options.map(o => o.name);
      }
      if (prop.type === 'multi_select' && prop.multi_select?.options) {
        entry.options = prop.multi_select.options.map(o => o.name);
      }
      // Include status groups
      if (prop.type === 'status' && prop.status) {
        entry.options = prop.status.options?.map(o => o.name);
        entry.groups = prop.status.groups?.map(g => ({ name: g.name, options: g.option_ids }));
      }
      // Include formula expression
      if (prop.type === 'formula') {
        entry.expression = prop.formula?.expression || null;
      }
      // Include number format
      if (prop.type === 'number') {
        entry.format = prop.number?.format || null;
      }
      // Include relation target
      if (prop.type === 'relation') {
        entry.database_id = prop.relation?.database_id || null;
      }
      // Include rollup config
      if (prop.type === 'rollup') {
        entry.rollup = {
          relation: prop.rollup?.relation_property_name,
          property: prop.rollup?.rollup_property_name,
          function: prop.rollup?.function,
        };
      }

      schema[name] = entry;
    }

    // Also fetch 1 sample row for runtime values
    const sampleRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONTRACTS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify({ page_size: 1 }),
    });
    let sample = null;
    if (sampleRes.ok) {
      const sampleData = await sampleRes.json();
      if (sampleData.results?.[0]) {
        const row = sampleData.results[0];
        sample = {};
        for (const [name, prop] of Object.entries(row.properties)) {
          sample[name] = { type: prop.type, value: summarizeValue(prop) };
        }
      }
    }

    return NextResponse.json({ schema, sample, dbId: NOTION_CONTRACTS_DB_ID });
  } catch (error) {
    console.error('Inspect schema error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function summarizeValue(prop) {
  switch (prop.type) {
    case 'title': return prop.title?.[0]?.plain_text || null;
    case 'rich_text': return prop.rich_text?.[0]?.plain_text || null;
    case 'number': return prop.number;
    case 'select': return prop.select?.name || null;
    case 'multi_select': return prop.multi_select?.map(s => s.name) || [];
    case 'status': return prop.status?.name || null;
    case 'date': return prop.date?.start || null;
    case 'checkbox': return prop.checkbox;
    case 'formula':
      if (prop.formula?.string) return prop.formula.string;
      if (prop.formula?.number !== undefined) return prop.formula.number;
      if (prop.formula?.boolean !== undefined) return prop.formula.boolean;
      if (prop.formula?.date) return prop.formula.date.start;
      return null;
    case 'relation': return prop.relation?.map(r => r.id) || [];
    case 'rollup':
      if (prop.rollup?.type === 'number') return prop.rollup.number;
      if (prop.rollup?.type === 'array') return `[${prop.rollup.array?.length || 0} items]`;
      return null;
    case 'url': return prop.url;
    case 'email': return prop.email;
    case 'phone_number': return prop.phone_number;
    case 'created_time': return prop.created_time;
    case 'last_edited_time': return prop.last_edited_time;
    default: return `<${prop.type}>`;
  }
}

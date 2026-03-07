import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(req) {
  try {
    const { page_id, gemini_url } = await req.json();

    // Met à jour la propriété 'Gemini GPT' ou 'Gemini CHAT' (adapte selon ta base)
    await notion.pages.update({
      page_id: page_id,
      properties: {
        'Gemini GPT': { url: gemini_url }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update Gemini Error:", error);
    return NextResponse.json({ error: 'Erreur Notion' }, { status: 500 });
  }
}

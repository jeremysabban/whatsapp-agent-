import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(req) {
  try {
    const { page_id } = await req.json();
    if (!page_id) return NextResponse.json({ error: 'No ID' }, { status: 400 });

    const page = await notion.pages.retrieve({ page_id });

    // Récupère "Google drive" et "Gemini GPT" (ou "Gemini CHAT")
    const driveProp = page.properties['Google drive']?.url;
    const geminiProp = page.properties['Gemini GPT']?.url || page.properties['Gemini CHAT']?.url;

    return NextResponse.json({
      drive_url: driveProp || null,
      gemini_url: geminiProp || null
    });
  } catch (error) {
    console.error("Notion Links Error:", error);
    return NextResponse.json({ error: 'Erreur Notion' }, { status: 500 });
  }
}

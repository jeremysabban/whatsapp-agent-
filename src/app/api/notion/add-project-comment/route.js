import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(request) {
  try {
    const { projectId, taskName, comment } = await request.json();

    if (!projectId || !comment) {
      return NextResponse.json({ error: 'projectId et comment requis' }, { status: 400 });
    }

    // Format timestamp
    const now = new Date();
    const timestamp = now.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build the comment text
    const commentText = taskName
      ? `[${timestamp}] ${taskName}: ${comment}`
      : `[${timestamp}] ${comment}`;

    // Append a paragraph block to the project page
    await notion.blocks.children.append({
      block_id: projectId,
      children: [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: { content: commentText },
                annotations: { color: 'default' }
              }
            ]
          }
        }
      ]
    });

    return NextResponse.json({ success: true, timestamp });

  } catch (error) {
    console.error('[ADD-PROJECT-COMMENT] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

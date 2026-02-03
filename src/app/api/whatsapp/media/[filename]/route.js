import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(request, { params }) {
  try {
    const { filename } = params;
    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });
    
    // Sanitize to prevent path traversal
    const safeName = path.basename(filename);
    
    // Look in both media/ and documents/ directories
    const mediaPath = path.join(process.cwd(), 'data', 'media', safeName);
    const docsPath = path.join(process.cwd(), 'data', 'documents', safeName);
    
    let filePath = null;
    if (fs.existsSync(mediaPath)) filePath = mediaPath;
    else if (fs.existsSync(docsPath)) filePath = docsPath;
    
    if (!filePath) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(safeName).toLowerCase();
    
    const mimeMap = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', 
      '.webp': 'image/webp', '.gif': 'image/gif',
      '.mp4': 'video/mp4', '.3gp': 'video/3gpp',
      '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    
    const contentType = mimeMap[ext] || 'application/octet-stream';
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

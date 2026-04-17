import { NextResponse } from 'next/server';
import {
  listATrier,
  moveFileToDriveFolder,
  renameFileOnDrive,
  deleteFileFromDrive
} from '@/lib/drive-collector';

export const dynamic = 'force-dynamic';

/**
 * GET /api/collector/trier
 *
 * Liste tous les fichiers dans le dossier A TRIER
 */
export async function GET() {
  try {
    const files = await listATrier();
    return NextResponse.json({ files, count: files.length });
  } catch (err) {
    console.error('[TRIER API] List error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/collector/trier
 * Body: { action: "classify" | "delete", fileId: "xxx", targetFolderId?: "xxx", newName?: "xxx" }
 *
 * Classer un fichier (déplacer vers le bon dossier client) ou le supprimer
 */
export async function POST(request) {
  try {
    const { action, fileId, targetFolderId, newName } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'fileId requis' }, { status: 400 });
    }

    if (action === 'classify') {
      if (!targetFolderId) {
        return NextResponse.json({ error: 'targetFolderId requis pour classer' }, { status: 400 });
      }

      // Rename if new name provided
      if (newName) {
        await renameFileOnDrive(fileId, newName);
      }

      // Move to target folder
      await moveFileToDriveFolder(fileId, targetFolderId);

      return NextResponse.json({
        success: true,
        action: 'classified',
        fileId,
        targetFolderId,
        newName: newName || null,
      });

    } else if (action === 'delete') {
      await deleteFileFromDrive(fileId);

      return NextResponse.json({
        success: true,
        action: 'deleted',
        fileId,
      });

    } else {
      return NextResponse.json({ error: 'action must be "classify" or "delete"' }, { status: 400 });
    }
  } catch (err) {
    console.error('[TRIER API] Action error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

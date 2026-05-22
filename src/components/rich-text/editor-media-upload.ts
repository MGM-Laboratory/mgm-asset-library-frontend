'use client';

import { apiFetch } from '@/lib/api/fetcher';

interface InitiateResponse {
  putUrl: string;
  key: string;
  viewUrl: string;
  expiresAt: string;
}

/**
 * Uploads a single editor-media asset (image, video, gif) and returns the
 * long-lived signed GET URL the TipTap node should reference. Used by
 * both the description editor (drag/drop/paste) and the comment composer.
 */
export async function uploadEditorMedia(
  file: File,
  accessToken: string | undefined,
): Promise<{ viewUrl: string; key: string }> {
  const initiate = await apiFetch<InitiateResponse>('/files/editor-media/initiate', {
    method: 'POST',
    body: { contentType: file.type || 'application/octet-stream', bytes: file.size },
    accessToken,
  });

  const put = await fetch(initiate.putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Editor media upload failed: ${put.status}`);
  }
  return { viewUrl: initiate.viewUrl, key: initiate.key };
}

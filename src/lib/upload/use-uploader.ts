'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthedFetch } from '@/lib/api/client';
import { logEvent } from '@/lib/logger.events';
import { logger } from '@/lib/logger';
import type {
  InitiateMultipartResponse,
  InitiateUploadResponse,
  MultipartPart,
  UploadTask,
  UploadTaskInput,
} from './types';

const SINGLE_SHOT_CAP = 100 * 1024 * 1024; // 100 MB
const PART_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PARALLEL_PARTS = 4;

interface AbortControllers {
  task: AbortController;
  xhr?: XMLHttpRequest;
}

export interface UseUploaderApi {
  tasks: UploadTask[];
  addFiles: (files: { file: File; relativePath: string }[]) => void;
  cancel: (taskId: string) => void;
  retry: (taskId: string) => void;
}

interface UseUploaderOpts {
  assetId: string;
  versionId: string;
  /** Called once a task transitions to `ready` (file row will be created server-side). */
  onReady?: (task: UploadTask) => void;
}

export function useUploader({ assetId, versionId, onReady }: UseUploaderOpts): UseUploaderApi {
  const fetcher = useAuthedFetch();
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const controllers = useRef<Map<string, AbortControllers>>(new Map());

  const updateTask = useCallback(
    (id: string, patch: Partial<UploadTask>) =>
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [],
  );

  const runTask = useCallback(
    async (task: UploadTask) => {
      const ctrl = new AbortController();
      controllers.current.set(task.id, { task: ctrl });
      logEvent('upload.start', {
        assetId: task.input.assetId,
        versionId: task.input.versionId,
        relativePath: task.input.relativePath,
        bytes: task.input.file.size,
      });
      try {
        updateTask(task.id, { status: 'uploading', bytesUploaded: 0, error: undefined });
        if (task.input.file.size <= SINGLE_SHOT_CAP) {
          await runSingleShot(task, ctrl, fetcher, updateTask);
        } else {
          await runMultipart(task, ctrl, fetcher, updateTask, controllers);
        }
        updateTask(task.id, {
          status: 'analyzing',
          bytesUploaded: task.input.file.size,
        });
        onReady?.(task);
      } catch (err) {
        if (ctrl.signal.aborted) {
          updateTask(task.id, { status: 'cancelled' });
          return;
        }
        logger.warn('upload.failed', {
          id: task.id,
          err: err instanceof Error ? err.message : String(err),
        });
        updateTask(task.id, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controllers.current.delete(task.id);
      }
    },
    [fetcher, updateTask, onReady],
  );

  const addFiles = useCallback(
    (files: { file: File; relativePath: string }[]) => {
      const newTasks: UploadTask[] = files.map((f) => ({
        id: cryptoRandomId(),
        input: { assetId, versionId, ...f },
        status: 'queued',
        bytesUploaded: 0,
        totalBytes: f.file.size,
      }));
      setTasks((prev) => [...prev, ...newTasks]);
      for (const task of newTasks) void runTask(task);
    },
    [assetId, versionId, runTask],
  );

  const cancel = useCallback(
    (taskId: string) => {
      const c = controllers.current.get(taskId);
      if (c) {
        c.task.abort();
        c.xhr?.abort();
      }
      updateTask(taskId, { status: 'cancelled' });
    },
    [updateTask],
  );

  const retry = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const reset: UploadTask = { ...task, status: 'queued', bytesUploaded: 0, error: undefined };
      updateTask(taskId, reset);
      void runTask(reset);
    },
    [tasks, updateTask, runTask],
  );

  useEffect(
    () => () => {
      for (const [, c] of controllers.current) {
        c.task.abort();
      }
      controllers.current.clear();
    },
    [],
  );

  return { tasks, addFiles, cancel, retry };
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

type Fetcher = ReturnType<typeof useAuthedFetch>;

async function runSingleShot(
  task: UploadTask,
  ctrl: AbortController,
  fetcher: Fetcher,
  updateTask: (id: string, patch: Partial<UploadTask>) => void,
) {
  const initiate = await fetcher<InitiateUploadResponse>('/files/uploads/initiate', {
    method: 'POST',
    body: {
      assetId: task.input.assetId,
      versionId: task.input.versionId,
      relativePath: task.input.relativePath,
      contentType: task.input.file.type || 'application/octet-stream',
      bytes: task.input.file.size,
    },
    signal: ctrl.signal,
  });

  updateTask(task.id, { fileId: initiate.fileId, uploadId: initiate.uploadId });
  await putWithProgress(task, initiate.putUrl, task.input.file, ctrl, updateTask);

  await fetcher('/files/uploads/complete', {
    method: 'POST',
    body: { uploadId: initiate.uploadId },
    signal: ctrl.signal,
  });
}

async function runMultipart(
  task: UploadTask,
  ctrl: AbortController,
  fetcher: Fetcher,
  updateTask: (id: string, patch: Partial<UploadTask>) => void,
  controllers: React.MutableRefObject<Map<string, AbortControllers>>,
) {
  const partCount = Math.max(1, Math.ceil(task.input.file.size / PART_SIZE));
  const initiate = await fetcher<InitiateMultipartResponse>('/files/uploads/multipart/initiate', {
    method: 'POST',
    body: {
      assetId: task.input.assetId,
      versionId: task.input.versionId,
      relativePath: task.input.relativePath,
      contentType: task.input.file.type || 'application/octet-stream',
      bytes: task.input.file.size,
      partCount,
    },
    signal: ctrl.signal,
  });
  updateTask(task.id, { fileId: initiate.fileId, uploadId: initiate.uploadId });

  const completed: MultipartPart[] = [];
  const bytesPerPart = new Map<number, number>();
  const updateProgress = () => {
    const sum = Array.from(bytesPerPart.values()).reduce((a, b) => a + b, 0);
    updateTask(task.id, { bytesUploaded: sum });
  };

  const partsToDo = initiate.partUrls.slice();
  async function worker() {
    while (partsToDo.length > 0) {
      if (ctrl.signal.aborted) return;
      const part = partsToDo.shift();
      if (!part) return;
      const start = (part.partNumber - 1) * PART_SIZE;
      const end = Math.min(task.input.file.size, start + PART_SIZE);
      const blob = task.input.file.slice(start, end);
      const etag = await putPart(part.url, blob, ctrl, (loaded) => {
        bytesPerPart.set(part.partNumber, loaded);
        updateProgress();
      });
      completed.push({ partNumber: part.partNumber, etag });
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_PARTS, partCount) }, worker));
  if (ctrl.signal.aborted) return;
  completed.sort((a, b) => a.partNumber - b.partNumber);

  await fetcher('/files/uploads/multipart/complete', {
    method: 'POST',
    body: { uploadId: initiate.uploadId, parts: completed },
    signal: ctrl.signal,
  });
  // Best-effort: keep the controllers map in sync so retry can re-use the row.
  controllers.current.set(task.id, { task: ctrl });
}

function putWithProgress(
  task: UploadTask,
  url: string,
  blob: Blob,
  ctrl: AbortController,
  updateTask: (id: string, patch: Partial<UploadTask>) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) updateTask(task.id, { bytesUploaded: e.loaded });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`PUT failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('PUT network error'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    ctrl.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.setRequestHeader(
      'Content-Type',
      task.input.file.type || 'application/octet-stream',
    );
    xhr.send(blob);
  });
}

function putPart(
  url: string,
  blob: Blob,
  ctrl: AbortController,
  onProgress: (bytes: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') ?? xhr.getResponseHeader('etag') ?? '';
        resolve(etag.replace(/"/g, ''));
      } else {
        reject(new Error(`PUT part failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('PUT part network error'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    ctrl.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

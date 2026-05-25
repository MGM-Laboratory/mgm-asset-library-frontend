'use client';

import { useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, FileBox, FolderUp, RefreshCcw, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { useWizard } from '../wizard-context';
import { useUploader } from '@/lib/upload/use-uploader';
import { formatBytes } from '@/lib/format';
import type { LocaleCode } from '@/lib/api/types';
import type { UploadStatus, UploadTask } from '@/lib/upload/types';
import { cn } from '@/lib/utils';

type DisplayRow =
  | {
      kind: 'task';
      id: string;
      relativePath: string;
      bytes: number;
      status: UploadStatus;
      progress: number;
      task: UploadTask;
      error?: string;
    }
  | {
      kind: 'saved';
      id: string;
      relativePath: string;
      bytes: number;
    };

export function StepFiles() {
  const wiz = useWizard();
  const t = useTranslations('publish.files');
  const locale = useLocale() as LocaleCode;
  const fileInput = useRef<HTMLInputElement | null>(null);
  const dirInput = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const uploader = useUploader({
    assetId: wiz.asset.id,
    versionId: wiz.latestVersion?.id ?? '',
    onReady: () => {
      void wiz.refresh();
    },
  });

  const addFiles = (files: File[], stripBase = false) => {
    const items = files.map((f) => {
      const raw = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const path = raw.replace(/\\/g, '/');
      const relativePath = stripBase ? path.split('/').slice(1).join('/') || path : path;
      return { file: f, relativePath };
    });
    uploader.addFiles(items);
  };

  const rows = useMemo<DisplayRow[]>(() => {
    const taskByFileId = new Map<string, UploadTask>();
    const taskRows: DisplayRow[] = [];
    for (const task of uploader.tasks) {
      if (task.fileId) taskByFileId.set(task.fileId, task);
      taskRows.push({
        kind: 'task',
        id: task.id,
        relativePath: task.input.relativePath,
        bytes: task.totalBytes,
        status: task.status,
        progress: task.totalBytes
          ? Math.min(100, Math.round((task.bytesUploaded / task.totalBytes) * 100))
          : 0,
        task,
        error: task.error ?? undefined,
      });
    }
    // Already-saved server files that aren't already represented by an
    // in-flight task. These are persisted across reloads so the user can see
    // exactly what's been uploaded so far.
    const saved: DisplayRow[] = (wiz.latestVersion?.files ?? [])
      .filter((f) => !taskByFileId.has(f.id))
      .map((f) => ({
        kind: 'saved' as const,
        id: f.id,
        relativePath: f.relativePath,
        bytes: Number(f.bytes ?? 0),
      }));
    return [...taskRows, ...saved];
  }, [uploader.tasks, wiz.latestVersion?.files]);

  if (!wiz.latestVersion) {
    return (
      <Alert variant="warning">
        Create a version first by filling out Basics — semver is required.
      </Alert>
    );
  }

  const totalBytes = rows.reduce((acc, r) => acc + r.bytes, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-h2 text-ink tracking-[-0.01em] mb-1">{t('title')}</h2>
        <p className="text-body-sm text-ink-3">{t('subtitle')}</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length) addFiles(files);
        }}
        className={cn(
          'rounded-[16px] border-2 border-dashed bg-surface-muted/40 p-8 text-center transition-colors duration-120',
          dragging ? 'border-ink bg-surface-muted/70' : 'border-line',
        )}
      >
        <Upload className="mx-auto h-7 w-7 text-ink-3" strokeWidth={2.25} />
        <p className="mt-3 text-body font-medium text-ink">{t('drop')}</p>
        <p className="text-caption text-ink-3">{t('or')}</p>
        <div className="mt-3 inline-flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => fileInput.current?.click()}
            leadingIcon={<Upload className="h-4 w-4" strokeWidth={2.25} />}
          >
            {t('browseFiles')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => dirInput.current?.click()}
            leadingIcon={<FolderUp className="h-4 w-4" strokeWidth={2.25} />}
          >
            {t('browseFolder')}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const fs = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = '';
            if (fs.length) addFiles(fs);
          }}
        />
        <input
          ref={dirInput}
          type="file"
          hidden
          multiple
          // @ts-expect-error directory picker isn't in the standard typings
          webkitdirectory=""
          directory=""
          onChange={(e) => {
            const fs = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = '';
            if (fs.length) addFiles(fs, true);
          }}
        />
      </div>

      {rows.length > 0 ? (
        <div className="rounded-[14px] border border-line bg-surface overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map((row) =>
              row.kind === 'task' ? (
                <TaskRow
                  key={row.id}
                  row={row}
                  locale={locale}
                  onCancel={() => uploader.cancel(row.task.id)}
                  onRetry={() => uploader.retry(row.task.id)}
                />
              ) : (
                <SavedRow key={row.id} row={row} locale={locale} />
              ),
            )}
          </ul>
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-caption text-ink-3 geist-tnum">
            <span>{rows.length} files</span>
            <span>{t('totalBytes', { size: formatBytes(totalBytes, locale) })}</span>
          </div>
        </div>
      ) : null}

      <label className="inline-flex items-start gap-3 p-3 rounded-[12px] border border-line cursor-pointer hover:border-ink/40 transition-colors duration-120 max-w-[640px]">
        <Checkbox
          checked={wiz.latestVersion.requiresEmptyProject}
          onCheckedChange={(c) => wiz.patch({ requiresEmptyProject: c === true })}
        />
        <div>
          <p className="text-[14px] font-medium text-ink">{t('requiresEmptyProjectLabel')}</p>
          <p className="text-caption text-ink-3 mt-0.5">{t('requiresEmptyProjectHint')}</p>
        </div>
      </label>
    </div>
  );
}

function TaskRow({
  row,
  locale,
  onCancel,
  onRetry,
}: {
  row: Extract<DisplayRow, { kind: 'task' }>;
  locale: LocaleCode;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations('publish.files');
  const isDone = row.status === 'analyzing' || row.status === 'ready';
  const isFailed = row.status === 'failed' || row.status === 'cancelled';
  return (
    <li className="p-3 flex items-center gap-3">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-surface-muted text-ink-2">
        <FileBox className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-medium text-ink truncate">{row.relativePath}</span>
          <span className="text-caption text-ink-3 geist-tnum shrink-0">
            {formatBytes(row.bytes, locale)}
            {row.status === 'uploading' ? ` · ${row.progress}%` : ''}
          </span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-line overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-200',
              isFailed ? 'bg-brand-red/70' : isDone ? 'bg-brand-green' : 'bg-brand-blue',
            )}
            style={{ width: `${isDone ? 100 : row.progress}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-caption text-ink-3">
          <TaskStatusPill status={row.status} />
          {row.error ? <span className="text-brand-red truncate">· {row.error}</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {row.status === 'failed' ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-2 hover:bg-surface-muted hover:text-ink transition-colors"
            aria-label={t('retry')}
          >
            <RefreshCcw className="h-4 w-4" strokeWidth={2.25} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-2 hover:bg-surface-muted hover:text-ink transition-colors"
          aria-label={t('remove')}
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
    </li>
  );
}

function SavedRow({
  row,
  locale,
}: {
  row: Extract<DisplayRow, { kind: 'saved' }>;
  locale: LocaleCode;
}) {
  return (
    <li className="p-3 flex items-center gap-3">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-brand-green-50 text-brand-green">
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-medium text-ink truncate">{row.relativePath}</span>
          <span className="text-caption text-ink-3 geist-tnum shrink-0">
            {formatBytes(row.bytes, locale)}
          </span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-brand-green overflow-hidden" />
        <p className="mt-1.5 text-caption text-brand-green font-medium inline-flex items-center gap-1">
          <Check className="h-3 w-3" strokeWidth={2.5} /> Uploaded
        </p>
      </div>
    </li>
  );
}

function TaskStatusPill({ status }: { status: UploadStatus }) {
  const t = useTranslations('publish.files');
  if (status === 'ready' || status === 'analyzing') {
    return (
      <span className="inline-flex items-center gap-1 text-brand-green font-medium">
        <Check className="h-3 w-3" strokeWidth={2.25} />
        Uploaded
      </span>
    );
  }
  if (status === 'uploading') {
    return (
      <span className="inline-flex items-center gap-1 text-brand-blue font-medium">
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.25} />
        Uploading
      </span>
    );
  }
  const key =
    status === 'queued'
      ? 'statusQueued'
      : status === 'failed'
        ? 'statusFailed'
        : 'statusCancelled';
  return <span>{t(key as 'statusQueued')}</span>;
}

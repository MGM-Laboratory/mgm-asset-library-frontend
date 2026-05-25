'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, FileBox, FolderUp, RefreshCcw, X, ShieldAlert, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { useWizard } from '../wizard-context';
import { useUploader } from '@/lib/upload/use-uploader';
import { useAnalyzerStore } from '@/lib/stores/analyzer-store';
import { AvBanner } from '../av-banner';
import { formatBytes } from '@/lib/format';
import type { LocaleCode } from '@/lib/api/types';
import type { UploadStatus, UploadTask } from '@/lib/upload/types';
import type { AvStatus } from '@/lib/api/types';
import { cn } from '@/lib/utils';

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

  // Sync analyzer/AV state into the per-task display so file rows transition
  // beyond `analyzing` once WS events flow.
  const analyzerVersion = useAnalyzerStore(
    (s) => (wiz.latestVersion ? s.versions[wiz.latestVersion.id] : undefined),
  );

  const tasks = uploader.tasks;

  const addFiles = (files: File[], stripBase = false) => {
    const items = files.map((f) => {
      const raw =
        (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const path = raw.replace(/\\/g, '/');
      const relativePath = stripBase
        ? path.split('/').slice(1).join('/') || path
        : path;
      return { file: f, relativePath };
    });
    uploader.addFiles(items);
  };

  useEffect(() => {
    if (!wiz.latestVersion) return;
    // no-op — placeholder for future
  }, [wiz.latestVersion]);

  if (!wiz.latestVersion) {
    return (
      <Alert variant="warning">
        Create a version first by filling out Basics — semver is required.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-h2 text-ink tracking-[-0.01em] mb-1">{t('title')}</h2>
        <p className="text-body-sm text-ink-3">{t('subtitle')}</p>
      </div>

      <AvBanner />

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
          <Button variant="secondary" onClick={() => fileInput.current?.click()} leadingIcon={<Upload className="h-4 w-4" strokeWidth={2.25} />}>
            {t('browseFiles')}
          </Button>
          <Button variant="ghost" onClick={() => dirInput.current?.click()} leadingIcon={<FolderUp className="h-4 w-4" strokeWidth={2.25} />}>
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

      {tasks.length > 0 ? (
        <div className="rounded-[14px] border border-line bg-surface overflow-hidden">
          <ul className="divide-y divide-line">
            {tasks.map((task) => {
              const av = task.fileId ? analyzerVersion?.files[task.fileId]?.av : undefined;
              return (
                <FileRow
                  key={task.id}
                  task={task}
                  av={av}
                  onCancel={() => uploader.cancel(task.id)}
                  onRetry={() => uploader.retry(task.id)}
                  locale={locale}
                />
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-caption text-ink-3 geist-tnum">
            <span>{tasks.length} files</span>
            <span>
              {t('totalBytes', {
                size: formatBytes(
                  tasks.reduce((acc, t) => acc + t.totalBytes, 0),
                  locale,
                ),
              })}
            </span>
          </div>
        </div>
      ) : null}

      {wiz.latestVersion.requiresEmptyProject ||
      (wiz.latestVersion.files ?? []).some(
        (f) => (f.meta as { requiresEmptyProject?: boolean } | null | undefined)?.requiresEmptyProject,
      ) ? (
        <Alert variant="warning" title="Empty project required">
          This asset will install into an empty Unity / Unreal project. Existing project assets may be overwritten.
        </Alert>
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

function FileRow({
  task,
  av,
  onCancel,
  onRetry,
  locale,
}: {
  task: UploadTask;
  av?: AvStatus;
  onCancel: () => void;
  onRetry: () => void;
  locale: LocaleCode;
}) {
  const t = useTranslations('publish.files');
  const pct = task.totalBytes
    ? Math.min(100, Math.round((task.bytesUploaded / task.totalBytes) * 100))
    : 0;
  const status = derivedStatus(task.status, av);
  return (
    <li className="p-3 flex items-center gap-3">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-surface-muted text-ink-2">
        <FileBox className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-medium text-ink truncate">{task.input.relativePath}</span>
          <span className="text-caption text-ink-3 geist-tnum shrink-0">
            {formatBytes(task.totalBytes, locale)}
          </span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-line overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-200',
              av === 'INFECTED'
                ? 'bg-brand-red'
                : status === 'ready'
                  ? 'bg-brand-green'
                  : status === 'failed' || status === 'cancelled'
                    ? 'bg-brand-red/70'
                    : 'bg-brand-blue',
            )}
            style={{ width: `${status === 'ready' ? 100 : pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-caption text-ink-3">
          <StatusPill status={status} av={av} />
          {task.error ? <span className="text-brand-red truncate">· {task.error}</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {status === 'failed' ? (
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

function derivedStatus(taskStatus: UploadStatus, av?: string): UploadStatus | 'av-scanning' {
  if (taskStatus === 'analyzing' && av === undefined) return 'analyzing';
  if (taskStatus === 'analyzing' && av === 'PENDING') return 'av-scanning';
  if (av === 'INFECTED') return 'failed';
  if (av === 'CLEAN' && taskStatus === 'analyzing') return 'ready';
  return taskStatus;
}

function StatusPill({
  status,
  av,
}: {
  status: UploadStatus | 'av-scanning';
  av?: string;
}) {
  const t = useTranslations('publish.files');
  if (av === 'INFECTED') {
    return (
      <span className="inline-flex items-center gap-1 text-brand-red font-medium">
        <ShieldAlert className="h-3 w-3" strokeWidth={2.25} />
        {t('infected')}
      </span>
    );
  }
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-brand-green font-medium">
        <Check className="h-3 w-3" strokeWidth={2.25} />
        {t('statusReady')}
      </span>
    );
  }
  const key =
    status === 'queued'
      ? 'statusQueued'
      : status === 'uploading'
        ? 'statusUploading'
        : status === 'analyzing'
          ? 'statusAnalyzing'
          : status === 'av-scanning'
            ? 'statusAvScanning'
            : status === 'failed'
              ? 'statusFailed'
              : 'statusCancelled';
  return <span>{t(key as 'statusReady')}</span>;
}

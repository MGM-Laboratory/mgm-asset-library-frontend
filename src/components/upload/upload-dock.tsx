'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { ChevronUp, ChevronDown, X, Loader2, Check, AlertCircle, FileBox } from 'lucide-react';
import { useUploadStore } from '@/lib/upload/upload-store';
import type { LocaleCode } from '@/lib/api/types';
import type { UploadTask } from '@/lib/upload/types';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

const ACTIVE = new Set(['queued', 'uploading']);

/**
 * Pushes the live access token into the global upload store and renders the
 * floating progress dock (bottom-right) whenever uploads are in flight and the
 * user is NOT currently on that asset's publish page (where the inline view
 * already shows progress).
 */
export function UploadDock() {
  const { data: session } = useSession();
  const locale = useLocale() as LocaleCode;
  const setAuth = useUploadStore((s) => s.setAuth);
  const tasks = useUploadStore((s) => s.order.map((id) => s.tasks[id]).filter(Boolean) as UploadTask[]);
  const cancel = useUploadStore((s) => s.cancel);
  const retry = useUploadStore((s) => s.retry);
  const dismiss = useUploadStore((s) => s.dismiss);
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setAuth(session?.accessToken, locale);
  }, [session?.accessToken, locale, setAuth]);

  // Hide the dock for the asset whose publish page we're currently on — that
  // page shows the inline file list already. Uploads for *other* assets still
  // surface here.
  const publishMatch = pathname.match(/\/publish\/([^/]+)/);
  const currentAssetId = publishMatch?.[1];
  const dockTasks = tasks.filter((t) => t.input.assetId !== currentAssetId);
  const dockActive = dockTasks.filter((t) => ACTIVE.has(t.status));

  if (dockTasks.length === 0) return null;

  const totalBytes = dockTasks.reduce((a, t) => a + t.totalBytes, 0);
  const doneBytes = dockTasks.reduce((a, t) => a + t.bytesUploaded, 0);
  const overallPct = totalBytes ? Math.min(100, Math.round((doneBytes / totalBytes) * 100)) : 0;
  const stillActive = dockActive.length;

  const goToAsset = (assetId: string) => router.push(`/publish/${assetId}`);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)]">
      <div className="rounded-[16px] border border-line bg-surface shadow-2 overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center gap-3 px-4 h-14 hover:bg-surface-muted/50 transition-colors"
        >
          <CircularProgress pct={overallPct} active={stillActive > 0} />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13.5px] font-semibold text-ink truncate">
              {stillActive > 0
                ? `Uploading ${stillActive} file${stillActive === 1 ? '' : 's'} · ${overallPct}%`
                : 'Uploads complete'}
            </p>
            <p className="text-caption text-ink-3 truncate">
              {formatBytes(doneBytes, locale)} / {formatBytes(totalBytes, locale)}
            </p>
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-ink-3" strokeWidth={2.25} />
          ) : (
            <ChevronUp className="h-4 w-4 text-ink-3" strokeWidth={2.25} />
          )}
        </button>

        {expanded ? (
          <ul className="max-h-[320px] overflow-y-auto border-t border-line divide-y divide-line">
            {dockTasks.map((t) => (
              <li key={t.id} className="p-3">
                <button
                  type="button"
                  onClick={() => goToAsset(t.input.assetId)}
                  className="w-full flex items-center gap-2.5 text-left group"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] bg-surface-muted text-ink-2 shrink-0">
                    <FileBox className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-medium text-ink truncate group-hover:text-brand-blue">
                      {t.input.relativePath}
                    </span>
                    <span className="mt-1 block h-1 rounded-full bg-line overflow-hidden">
                      <span
                        className={cn(
                          'block h-full transition-[width] duration-150',
                          t.status === 'failed' ? 'bg-brand-red' : t.status === 'uploading' ? 'bg-brand-blue' : 'bg-brand-green',
                        )}
                        style={{
                          width: `${
                            t.status === 'analyzing' || t.status === 'ready'
                              ? 100
                              : t.totalBytes
                                ? Math.round((t.bytesUploaded / t.totalBytes) * 100)
                                : 0
                          }%`,
                        }}
                      />
                    </span>
                  </span>
                  <StatusGlyph status={t.status} />
                </button>
                {t.status === 'failed' ? (
                  <div className="mt-1.5 flex items-center gap-2 pl-9">
                    <span className="text-caption text-brand-red truncate flex-1">{t.error}</span>
                    <button
                      type="button"
                      onClick={() => retry(t.id)}
                      className="text-caption font-medium text-brand-blue hover:underline"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(t.id)}
                      className="text-ink-3 hover:text-ink"
                      aria-label="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  </div>
                ) : ACTIVE.has(t.status) ? (
                  <div className="mt-1.5 pl-9">
                    <button
                      type="button"
                      onClick={() => cancel(t.id)}
                      className="text-caption text-ink-3 hover:text-brand-red"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function CircularProgress({ pct, active }: { pct: number; active: boolean }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <span className="relative inline-flex h-9 w-9 items-center justify-center shrink-0">
      <svg className="h-9 w-9 -rotate-90" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-line" />
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          className={active ? 'text-brand-blue transition-[stroke-dashoffset] duration-200' : 'text-brand-green'}
        />
      </svg>
      <span className="absolute text-[9px] font-semibold text-ink geist-tnum">{pct}</span>
    </span>
  );
}

function StatusGlyph({ status }: { status: UploadTask['status'] }) {
  if (status === 'uploading' || status === 'queued')
    return <Loader2 className="h-4 w-4 animate-spin text-brand-blue shrink-0" strokeWidth={2.25} />;
  if (status === 'failed')
    return <AlertCircle className="h-4 w-4 text-brand-red shrink-0" strokeWidth={2.25} />;
  return <Check className="h-4 w-4 text-brand-green shrink-0" strokeWidth={2.5} />;
}

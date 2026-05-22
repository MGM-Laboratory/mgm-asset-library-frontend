'use client';

import { useState } from 'react';
import { ShieldAlert, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWizard } from './wizard-context';
import { useAnalyzerStore } from '@/lib/stores/analyzer-store';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export function AvBanner() {
  const wiz = useWizard();
  const t = useTranslations('publish.av');
  const [expanded, setExpanded] = useState(false);
  const versionState = useAnalyzerStore(
    (s) => (wiz.latestVersion ? s.versions[wiz.latestVersion.id] : undefined),
  );

  const infected =
    versionState?.hasInfected ||
    wiz.latestVersion?.avStatus === 'INFECTED' ||
    (wiz.latestVersion?.files ?? []).some(
      (f) => (f.meta as { avStatus?: string } | null | undefined)?.avStatus === 'INFECTED',
    );

  if (!infected) return null;

  const flaggedFiles = Object.entries(versionState?.files ?? {})
    .filter(([, v]) => v.av === 'INFECTED')
    .map(([id, v]) => ({
      id,
      signature: v.signature ?? '—',
      relativePath:
        wiz.latestVersion?.files.find((f) => f.id === id)?.relativePath ?? id,
    }));

  return (
    <div
      role="alert"
      className="border border-brand-red/40 bg-brand-red-50 rounded-[16px] p-5"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-brand-red shrink-0 mt-0.5" strokeWidth={2.25} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-ink">{t('warningTitle')}</p>
          <p className="text-body-sm text-ink-2 mt-1">{t('warningBody')}</p>

          {flaggedFiles.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setExpanded((x) => !x)}
                className="mt-3 inline-flex items-center gap-1 text-caption font-medium text-ink-2 hover:text-ink"
                aria-expanded={expanded}
              >
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    expanded && 'rotate-180',
                  )}
                  strokeWidth={2.25}
                />
                {t('showDetails')}
              </button>
              {expanded ? (
                <ul className="mt-3 space-y-1 text-[12.5px] font-mono text-ink-2">
                  {flaggedFiles.map((f) => (
                    <li key={f.id}>
                      {t('fileLabel', { file: f.relativePath, signature: f.signature })}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          <label className="mt-4 inline-flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={wiz.avAcknowledged}
              onCheckedChange={(c) => wiz.setAvAcknowledged(c === true)}
            />
            <span className="text-[13.5px] font-medium text-ink">{t('ack')}</span>
          </label>
        </div>
      </div>
    </div>
  );
}

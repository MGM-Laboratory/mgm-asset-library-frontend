'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Field, Textarea } from '@/components/ui/input';
import { RichTextEditor } from '@/components/rich-text/rich-text-editor';
import { Alert } from '@/components/ui/alert';
import { useWizard } from '../wizard-context';
import { cn } from '@/lib/utils';
import type { LocaleCode, TipTapDoc } from '@/lib/api/types';

const LOCALES: { code: LocaleCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'id', label: 'Bahasa Indonesia' },
];

interface TranslationDraft {
  short: string;
  long: TipTapDoc | null;
}

export function StepDescription() {
  const wiz = useWizard();
  const t = useTranslations('publish.description');
  const [activeLocale, setActiveLocale] = useState<LocaleCode>('en');

  const translations: Record<LocaleCode, TranslationDraft> =
    ((wiz.asset as unknown as { translations?: Record<LocaleCode, TranslationDraft> }).translations) ?? {
      en: { short: wiz.asset.shortDescription ?? '', long: wiz.asset.longDescription ?? null },
      id: { short: '', long: null },
    };

  const update = (locale: LocaleCode, patch: Partial<TranslationDraft>) => {
    const next = {
      ...translations,
      [locale]: { ...translations[locale], ...patch },
    };
    wiz.patch({
      translations: Object.entries(next).map(([code, v]) => ({
        locale: code,
        shortDescription: v.short,
        longDescription: v.long ?? { type: 'doc', content: [] },
      })),
    });
  };

  const current = translations[activeLocale];
  const isFallback = !current.short && !current.long?.content?.length;

  return (
    <div className="space-y-5 max-w-[820px]">
      <div role="tablist" aria-label="Description languages" className="flex items-center gap-1 border-b border-line">
        {LOCALES.map((l) => {
          const active = activeLocale === l.code;
          return (
            <button
              key={l.code}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveLocale(l.code)}
              className={cn(
                'relative h-10 px-3 text-[14px] font-medium',
                active ? 'text-ink' : 'text-ink-3 hover:text-ink',
                'after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px]',
                active ? 'after:bg-brand-blue' : 'after:bg-transparent',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
              )}
            >
              {l.label}
            </button>
          );
        })}
        <span className="ml-auto inline-flex h-9 items-center px-2.5 rounded-full bg-surface-muted text-caption text-ink-3 opacity-60 cursor-not-allowed">
          + {t('addLanguage')}
        </span>
      </div>

      {isFallback ? (
        <Alert variant="info">{t('fallbackNote')}</Alert>
      ) : null}

      <Field id={`short-${activeLocale}`} label={t('shortLabel')} helper={t('shortHelper')}>
        <Textarea
          id={`short-${activeLocale}`}
          rows={2}
          maxLength={280}
          value={current.short}
          onChange={(e) => update(activeLocale, { short: e.target.value })}
        />
      </Field>

      <Field id={`long-${activeLocale}`} label={t('longLabel')}>
        <RichTextEditor
          mode="full"
          value={current.long ?? undefined}
          onChange={(doc) => update(activeLocale, { long: doc })}
        />
      </Field>
    </div>
  );
}

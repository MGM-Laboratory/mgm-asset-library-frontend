'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

declare global {
  // model-viewer is a web component — augment intrinsic elements so JSX accepts it.
  // We type the few attributes we actually use; the rest are passed through.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          'shadow-intensity'?: string;
          exposure?: string;
          'camera-controls'?: boolean;
          'tone-mapping'?: string;
          'animation-name'?: string;
          autoplay?: boolean;
          'interaction-prompt'?: string;
          'environment-image'?: string;
        },
        HTMLElement
      >;
    }
  }
}

const MODEL_VIEWER_SCRIPT = 'https://unpkg.com/@google/model-viewer@^3.5.0/dist/model-viewer.min.js';

let scriptLoadPromise: Promise<void> | null = null;
function loadModelViewerScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  if (typeof window === 'undefined') return Promise.resolve();
  if (customElements.get('model-viewer')) return Promise.resolve();
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const tag = document.createElement('script');
    tag.type = 'module';
    tag.src = MODEL_VIEWER_SCRIPT;
    tag.onload = () => resolve();
    tag.onerror = (e) => reject(e);
    document.head.appendChild(tag);
  });
  return scriptLoadPromise;
}

interface ModelViewerProps {
  src: string;
  alt?: string;
  className?: string;
  /** Animation names embedded in the GLB; if non-empty we expose the picker UI. */
  animations?: string[];
}

export function ModelViewerPanel({ src, alt, className, animations = [] }: ModelViewerProps) {
  const t = useTranslations('asset.viewer');
  const ref = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(true);
  const [activeAnim, setActiveAnim] = useState<string | undefined>(animations[0]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    void loadModelViewerScript().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ref.current || !ready) return;
    const el = ref.current as unknown as HTMLElement & {
      currentTime?: number;
      duration?: number;
      pause?: () => void;
      play?: () => void;
    };
    const onTimeUpdate = () => {
      if (el.duration) setProgress(((el.currentTime ?? 0) / el.duration) * 100);
    };
    el.addEventListener('animation-finished', () => setPaused(true));
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      el.removeEventListener('animation-finished', () => setPaused(true));
      el.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [ready]);

  const togglePlay = () => {
    const el = ref.current as unknown as { pause?: () => void; play?: () => void } | null;
    if (!el) return;
    if (paused) {
      el.play?.();
      setPaused(false);
    } else {
      el.pause?.();
      setPaused(true);
    }
  };

  const scrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = ref.current as unknown as { duration?: number; currentTime?: number } | null;
    if (!el?.duration) return;
    const pct = Number(e.target.value);
    el.currentTime = (pct / 100) * el.duration;
    setProgress(pct);
  };

  return (
    <div className={cn('relative w-full h-full bg-surface-muted', className)}>
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center text-ink-3 gap-2 text-body-sm">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          {t('loading')}
        </div>
      ) : null}

      {/* @ts-expect-error custom element */}
      <model-viewer
        ref={ref}
        src={src}
        alt={alt}
        camera-controls
        shadow-intensity="0.5"
        exposure="1.0"
        tone-mapping="aces"
        interaction-prompt="none"
        animation-name={activeAnim}
        onDoubleClick={() => {
          const el = ref.current as unknown as { resetTurntableRotation?: () => void } | null;
          el?.resetTurntableRotation?.();
        }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      />

      <div className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-[6px] border border-line px-2 py-1 text-[11px] text-ink-3">
        <RotateCcw className="h-3 w-3" strokeWidth={2.25} />
        {t('resetCamera')}
      </div>

      {animations.length > 0 ? (
        <div className="absolute bottom-3 left-3 right-3 md:right-auto inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-[8px] border border-line p-1 pl-2 shadow-1 max-w-full overflow-hidden">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={t('playPause')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white hover:bg-[#1a1f29] transition-colors duration-120"
          >
            {paused ? <Play className="h-3.5 w-3.5" strokeWidth={2.25} /> : <Pause className="h-3.5 w-3.5" strokeWidth={2.25} />}
          </button>
          <div className="flex items-center gap-1 overflow-x-auto max-w-[300px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {animations.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setActiveAnim(name);
                  setPaused(false);
                }}
                className={cn(
                  'shrink-0 inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors duration-120 whitespace-nowrap',
                  activeAnim === name
                    ? 'bg-brand-blue-50 text-brand-blue'
                    : 'text-ink-2 hover:bg-surface-muted',
                )}
              >
                {name}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={scrub}
            aria-label="Animation progress"
            className="hidden md:block w-24 accent-brand-blue"
          />
        </div>
      ) : null}
    </div>
  );
}

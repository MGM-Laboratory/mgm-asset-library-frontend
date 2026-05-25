'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ThumbnailImageProps {
  src?: string | null;
  fallback?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
}

/**
 * Thumbnail wrapper. Picks `src` first, falls back to `fallback`
 * (auto-generated preview), then to a brand-tinted placeholder.
 * Applies the DS-required 1px inner border + 20px radius and a
 * surface-muted shimmer until the image loads.
 */
export function ThumbnailImage({
  src,
  fallback,
  alt,
  fill = true,
  width,
  height,
  priority = false,
  className,
  sizes = '(min-width: 1280px) 320px, (min-width: 768px) 50vw, 100vw',
}: ThumbnailImageProps) {
  const url = src || fallback || null;
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[20px] bg-surface-muted',
        'after:absolute after:inset-0 after:rounded-[20px] after:pointer-events-none after:shadow-[inset_0_0_0_1px_rgba(14,17,22,0.06)]',
        !fill && 'inline-block',
        className,
      )}
      style={fill ? undefined : { width, height }}
    >
      {!loaded && !errored ? (
        <div className="absolute inset-0 skeleton" aria-hidden />
      ) : null}
      {url && !errored ? (
        // next/image refuses blob: / data: URLs (no remote-pattern match) — fall
        // back to a plain <img> for local-preview thumbnails uploaded by the
        // publish wizard so the preview renders the moment the file is picked.
        url.startsWith('blob:') || url.startsWith('data:') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={alt}
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        ) : (
          <Image
            src={url}
            alt={alt}
            fill={fill}
            width={fill ? undefined : width}
            height={fill ? undefined : height}
            priority={priority}
            sizes={fill ? sizes : undefined}
            className={cn(
              'object-cover transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        )
      ) : null}
      {errored || !url ? <ThumbnailPlaceholder alt={alt} /> : null}
    </div>
  );
}

function ThumbnailPlaceholder({ alt }: { alt: string }) {
  // Hash-based brand tint so duplicate empty thumbnails don't all look the same.
  const palette = ['#ecf1fa', '#fef6e0', '#fee5e5', '#e2f1ea'];
  let h = 0;
  for (let i = 0; i < alt.length; i++) h = (h * 31 + alt.charCodeAt(i)) | 0;
  const bg = palette[Math.abs(h) % palette.length]!;
  const initials =
    alt
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: bg }}
    >
      <span className="font-display text-h1 text-ink/30 tracking-[-0.02em] uppercase">
        {initials}
      </span>
    </div>
  );
}

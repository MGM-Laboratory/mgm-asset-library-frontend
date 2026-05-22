'use client';

import { useEffect } from 'react';
import { useWsStore } from './store';
import { useAnalyzerStore } from '@/lib/stores/analyzer-store';
import type { AnalysisStatus, AvStatus } from '@/lib/api/types';

/**
 * Bridges incoming `version.analyze.*` / `version.av.*` WS messages into the
 * analyzer Zustand store. Mounted once inside the publish wizard.
 */
export function AnalyzerBridge() {
  const subscribe = useWsStore((s) => s.subscribe);
  const progress = useAnalyzerStore((s) => s.applyAnalyzeProgress);
  const ready = useAnalyzerStore((s) => s.applyAnalyzeReady);
  const av = useAnalyzerStore((s) => s.applyAvResult);

  useEffect(() => {
    const unsubs = [
      subscribe('version.analyze.progress', (msg) => {
        const p = (msg.payload ?? {}) as { versionId?: string; fileId?: string; status?: AnalysisStatus };
        if (p.versionId && p.fileId && p.status) progress(p.versionId, p.fileId, p.status);
      }),
      subscribe('version.analyze.ready', (msg) => {
        const p = (msg.payload ?? {}) as { versionId?: string };
        if (p.versionId) ready(p.versionId);
      }),
      subscribe('version.av.result', (msg) => {
        const p = (msg.payload ?? {}) as {
          versionId?: string;
          fileId?: string;
          status?: AvStatus;
          signature?: string;
        };
        if (p.versionId && p.fileId && p.status) av(p.versionId, p.fileId, p.status, p.signature);
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [subscribe, progress, ready, av]);

  return null;
}

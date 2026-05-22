'use client';

import { create } from 'zustand';
import type { AnalysisStatus, AvStatus } from '@/lib/api/types';

interface VersionAnalysisState {
  versionId: string;
  analysisStatus: AnalysisStatus;
  avStatus: AvStatus;
  /** Per-file statuses keyed by file id. */
  files: Record<string, { status: AnalysisStatus; av?: AvStatus; signature?: string }>;
  /** Sticky flag — once any file is INFECTED, this stays true until the version restarts. */
  hasInfected: boolean;
  updatedAt: number;
}

interface AnalyzerState {
  versions: Record<string, VersionAnalysisState>;
  applyAnalyzeProgress: (
    versionId: string,
    fileId: string,
    status: AnalysisStatus,
  ) => void;
  applyAnalyzeReady: (versionId: string) => void;
  applyAvResult: (
    versionId: string,
    fileId: string,
    status: AvStatus,
    signature?: string,
  ) => void;
  reset: (versionId: string) => void;
}

function ensureVersion(
  state: AnalyzerState,
  versionId: string,
): VersionAnalysisState {
  return (
    state.versions[versionId] ?? {
      versionId,
      analysisStatus: 'PENDING',
      avStatus: 'PENDING',
      files: {},
      hasInfected: false,
      updatedAt: Date.now(),
    }
  );
}

export const useAnalyzerStore = create<AnalyzerState>((set) => ({
  versions: {},
  applyAnalyzeProgress: (versionId, fileId, status) =>
    set((state) => {
      const v = ensureVersion(state, versionId);
      return {
        versions: {
          ...state.versions,
          [versionId]: {
            ...v,
            analysisStatus: status === 'READY' ? 'READY' : 'ANALYZING',
            files: { ...v.files, [fileId]: { ...v.files[fileId], status } },
            updatedAt: Date.now(),
          },
        },
      };
    }),
  applyAnalyzeReady: (versionId) =>
    set((state) => {
      const v = ensureVersion(state, versionId);
      return {
        versions: {
          ...state.versions,
          [versionId]: { ...v, analysisStatus: 'READY', updatedAt: Date.now() },
        },
      };
    }),
  applyAvResult: (versionId, fileId, status, signature) =>
    set((state) => {
      const v = ensureVersion(state, versionId);
      // avStatus is sticky once INFECTED: a later CLEAN on a different file
      // must not flip the whole version back to CLEAN.
      const nextAvStatus = v.avStatus === 'INFECTED' ? 'INFECTED' : status;
      const next: VersionAnalysisState = {
        ...v,
        avStatus: nextAvStatus,
        files: {
          ...v.files,
          [fileId]: { ...v.files[fileId], status: v.files[fileId]?.status ?? 'READY', av: status, signature },
        },
        hasInfected: v.hasInfected || status === 'INFECTED',
        updatedAt: Date.now(),
      };
      return { versions: { ...state.versions, [versionId]: next } };
    }),
  reset: (versionId) =>
    set((state) => {
      const next = { ...state.versions };
      delete next[versionId];
      return { versions: next };
    }),
}));

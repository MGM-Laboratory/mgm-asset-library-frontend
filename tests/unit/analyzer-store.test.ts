import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalyzerStore } from '@/lib/stores/analyzer-store';

describe('analyzerStore', () => {
  beforeEach(() => {
    useAnalyzerStore.setState({ versions: {} });
  });

  it('records per-file progress and bumps the version-level status to ANALYZING', () => {
    useAnalyzerStore.getState().applyAnalyzeProgress('v1', 'f1', 'ANALYZING');
    const v = useAnalyzerStore.getState().versions['v1'];
    expect(v.analysisStatus).toBe('ANALYZING');
    expect(v.files.f1.status).toBe('ANALYZING');
  });

  it('flips analysisStatus to READY when ready event fires', () => {
    useAnalyzerStore.getState().applyAnalyzeProgress('v1', 'f1', 'ANALYZING');
    useAnalyzerStore.getState().applyAnalyzeReady('v1');
    expect(useAnalyzerStore.getState().versions['v1'].analysisStatus).toBe('READY');
  });

  it('marks the version infected when any file scans INFECTED, and the flag is sticky', () => {
    const store = useAnalyzerStore.getState();
    store.applyAvResult('v1', 'f1', 'INFECTED', 'EICAR-Test-File');
    expect(useAnalyzerStore.getState().versions['v1'].hasInfected).toBe(true);
    // Subsequent CLEAN on another file must not unset hasInfected
    store.applyAvResult('v1', 'f2', 'CLEAN');
    expect(useAnalyzerStore.getState().versions['v1'].hasInfected).toBe(true);
  });
});

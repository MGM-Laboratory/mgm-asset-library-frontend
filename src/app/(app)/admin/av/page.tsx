'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Eye, RefreshCcw, Check, Archive } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '@/components/ui/modal';
import { Alert } from '@/components/ui/alert';
import { useAuthedFetch } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/queries';
import { toast } from '@/components/ui/toaster';
import { formatRelative } from '@/lib/format';
import { useLocale } from 'next-intl';
import { useWsStore } from '@/lib/ws';
import type { AdminAvVersion } from '@/lib/api/admin-types';
import type { LocaleCode } from '@/lib/api/types';

export default function AdminAvPage() {
  const fetcher = useAuthedFetch();
  const queryClient = useQueryClient();
  const locale = useLocale() as LocaleCode;
  const subscribe = useWsStore((s) => s.subscribe);
  const [viewing, setViewing] = useState<AdminAvVersion | null>(null);

  const list = useQuery({
    queryKey: queryKeys.adminAv,
    queryFn: () => fetcher<AdminAvVersion[]>('/admin/av/infected'),
    staleTime: 15_000,
  });

  // AV admin alerts → refetch the list.
  useEffect(() => {
    return subscribe('notification:new', (msg) => {
      const env = (msg.payload ?? {}) as { type?: string };
      if (env.type === 'AV_INFECTED_ADMIN_ALERT') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.adminAv });
      }
    });
  }, [subscribe, queryClient]);

  const acknowledge = useMutation({
    mutationFn: async (versionId: string) =>
      fetcher(`/admin/av/${versionId}/acknowledge`, { method: 'POST' }),
    onSuccess: () => toast.success('Acknowledged as false positive'),
    onError: (err) => toast.error('Acknowledge failed', { description: err instanceof Error ? err.message : String(err) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.adminAv }),
  });

  const quarantine = useMutation({
    mutationFn: async (versionId: string) =>
      fetcher(`/admin/av/${versionId}/quarantine`, { method: 'POST' }),
    onSuccess: () => toast.success('Asset archived'),
    onError: (err) => toast.error('Quarantine failed', { description: err instanceof Error ? err.message : String(err) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.adminAv }),
  });

  const rescan = useMutation({
    mutationFn: async (versionId: string) =>
      fetcher(`/admin/av/${versionId}/rescan`, { method: 'POST' }),
    onSuccess: () => toast.success('Rescan enqueued'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.adminAv }),
  });

  const rows = list.data?.map((v) => ({ ...v, id: v.versionId })) ?? [];

  return (
    <>
      <AdminPageHeader
        title="AV queue"
        description="Versions whose files were flagged by the antivirus scanner."
      />
      {rows.length === 0 ? null : (
        <Alert variant="warning" className="mb-4" icon={<ShieldAlert className="h-5 w-5 text-[#a16800]" strokeWidth={2.25} />}>
          {rows.length} infected version{rows.length === 1 ? '' : 's'} need review.
        </Alert>
      )}
      <DataTable
        rows={rows}
        empty="No infected versions. 🎉"
        columns={[
          {
            key: 'asset',
            header: 'Asset',
            cell: (r) => (
              <NextLink href={`/assets/${r.assetSlug || r.assetId}`} className="font-medium text-ink hover:underline">
                {r.assetTitle}
              </NextLink>
            ),
          },
          { key: 'owner', header: 'Owner', cell: (r) => r.ownerDisplayName },
          { key: 'version', header: 'Version', cell: (r) => <code className="font-mono text-[12.5px]">{r.semver}</code> },
          {
            key: 'detected',
            header: 'Detected',
            cell: (r) => <span className="text-caption text-ink-3 geist-tnum">{formatRelative(r.detectedAt, locale)}</span>,
          },
          {
            key: 'signatures',
            header: 'Signatures',
            cell: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.files
                  .filter((f) => f.signature)
                  .slice(0, 3)
                  .map((f) => (
                    <Badge key={f.id} variant="danger" size="sm">
                      {f.signature}
                    </Badge>
                  ))}
                {r.files.length > 3 ? (
                  <span className="text-caption text-ink-3">+{r.files.length - 3}</span>
                ) : null}
              </div>
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (r) => (
              <div className="inline-flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setViewing(r)} leadingIcon={<Eye className="h-3.5 w-3.5" strokeWidth={2.25} />}>
                  Files
                </Button>
                <Button size="sm" variant="ghost" onClick={() => rescan.mutate(r.versionId)} leadingIcon={<RefreshCcw className="h-3.5 w-3.5" strokeWidth={2.25} />}>
                  Rescan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => acknowledge.mutate(r.versionId)} leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.25} />}>
                  Acknowledge
                </Button>
                <Button size="sm" variant="danger" onClick={() => quarantine.mutate(r.versionId)} leadingIcon={<Archive className="h-3.5 w-3.5" strokeWidth={2.25} />}>
                  Quarantine
                </Button>
              </div>
            ),
          },
        ]}
      />

      {viewing ? (
        <Modal open onOpenChange={(o) => !o && setViewing(null)}>
          <ModalContent size="md">
            <ModalHeader>
              <ModalTitle>Files in {viewing.semver}</ModalTitle>
            </ModalHeader>
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
              {viewing.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 p-2.5 rounded-[10px] border border-line bg-surface">
                  <span className="font-mono text-[12.5px] text-ink-2 truncate">{f.relativePath}</span>
                  {f.signature ? (
                    <Badge variant="danger" size="sm">
                      {f.signature}
                    </Badge>
                  ) : (
                    <Badge variant={f.status === 'CLEAN' ? 'success' : 'neutral'} size="sm">
                      {f.status}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setViewing(null)}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      ) : null}
    </>
  );
}

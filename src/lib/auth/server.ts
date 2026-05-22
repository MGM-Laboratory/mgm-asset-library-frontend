import 'server-only';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth, isMockAuth } from './index';
import { apiFetch } from '@/lib/api/fetcher';
import type { MeResponse } from '@/lib/api/types';
import { logger } from '@/lib/logger';

const MOCK_USER: MeResponse = {
  id: 'mock-admin',
  email: 'admin@labmgm.org',
  displayName: 'Mock Admin',
  locale: 'en',
  isAdmin: true,
  role: 'admin',
  avatar: { initials: 'MA', bgColor: 'brand-blue', fgColor: 'ink-white' },
  hasPublishedAssets: false,
  unreadNotifications: 0,
  createdAt: new Date('2025-01-01T00:00:00Z').toISOString(),
};

export interface ResolvedSession {
  accessToken?: string;
  expiresAt?: number;
  error?: string;
  mock?: true;
}

export async function getSession(): Promise<ResolvedSession | null> {
  if (isMockAuth) {
    return { mock: true, accessToken: 'mock', expiresAt: Number.MAX_SAFE_INTEGER };
  }
  const session = await auth();
  if (!session) return null;
  return {
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    error: session.error,
  };
}

export async function requireSession(callbackUrl?: string): Promise<ResolvedSession> {
  const session = await getSession();
  if (!session || session.error === 'RefreshAccessTokenError') {
    const target = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : '';
    redirect(`/auth/signin${target}`);
  }
  return session;
}

export async function fetchMe(session: ResolvedSession): Promise<MeResponse> {
  if (session.mock) return MOCK_USER;
  const locale = (await cookies()).get('NEXT_LOCALE')?.value as 'en' | 'id' | undefined;
  try {
    return await apiFetch<MeResponse>('/auth/me', {
      accessToken: session.accessToken,
      locale,
      cache: 'no-store',
    });
  } catch (err) {
    logger.warn('fetchMe failed', { err: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function requireAdmin(): Promise<MeResponse> {
  const session = await requireSession();
  const me = await fetchMe(session);
  if (!me.isAdmin) {
    redirect('/403');
  }
  return me;
}

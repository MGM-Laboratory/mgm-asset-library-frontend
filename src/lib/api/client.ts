'use client';

import { useSession } from 'next-auth/react';
import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { apiFetch, type ApiFetchInit } from './fetcher';
import type { LocaleCode } from './types';

/**
 * Client-side wrapper that automatically forwards the session access token
 * + the current locale to every request. Use inside client components
 * (TanStack Query, mutations). Server-side code should call apiFetch
 * directly with `accessToken` from the resolved session.
 */
export function useAuthedFetch() {
  const { data: session } = useSession();
  const locale = useLocale() as LocaleCode;
  return useCallback(
    <T = unknown>(path: string, init: ApiFetchInit = {}): Promise<T> =>
      apiFetch<T>(path, {
        accessToken: session?.accessToken,
        locale: init.locale ?? locale,
        ...init,
      }),
    [session?.accessToken, locale],
  );
}

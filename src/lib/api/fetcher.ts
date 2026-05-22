import { publicEnv } from '@/lib/env.public';
import { ApiError, type ProblemDetail } from './errors';
import { addBreadcrumb } from '@/lib/sentry';

type QueryPrimitive = string | number | boolean;
type QueryValue = QueryPrimitive | QueryPrimitive[] | undefined | null;

export interface ApiFetchInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
  locale?: 'en' | 'id';
  accessToken?: string;
  idempotencyKey?: string;
  query?: Record<string, QueryValue>;
}

function buildUrl(path: string, query?: ApiFetchInit['query']): string {
  const base = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  const url = new URL(path.startsWith('/') ? `${base}${path}` : `${base}/${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) {
        // Repeat the param per value — the OpenAPI default for array
        // schemas. The backend's `asArray` transform also accepts
        // comma-separated, so either form would land correctly.
        for (const item of v) {
          if (item === undefined || item === null || item === '') continue;
          url.searchParams.append(k, String(item));
        }
        continue;
      }
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function apiFetch<T = unknown>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { body, locale, accessToken, idempotencyKey, query, headers, ...rest } = init;
  const requestId = newRequestId();
  const url = buildUrl(path, query);

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Request-Id': requestId,
    ...(headers as Record<string, string> | undefined),
  };
  if (locale) finalHeaders['Accept-Language'] = locale;
  if (accessToken) finalHeaders['Authorization'] = `Bearer ${accessToken}`;
  if (idempotencyKey) finalHeaders['Idempotency-Key'] = idempotencyKey;

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    void addBreadcrumb('api:network-error', { url, requestId });
    throw new ApiError(
      {
        type: 'about:blank',
        title: 'NetworkError',
        status: 0,
        code: 'network.error',
        detail: err instanceof Error ? err.message : String(err),
      },
      requestId,
    );
  }

  const elapsedMs = Date.now() - startedAt;
  void addBreadcrumb('api:response', {
    url,
    status: response.status,
    elapsedMs,
    requestId,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const parsed = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const problem: ProblemDetail = parsed && isProblem(parsed)
      ? parsed
      : {
          type: 'about:blank',
          title: response.statusText || 'Error',
          status: response.status,
          code: response.status === 401 ? 'auth.unauthenticated' : 'http.error',
          detail: typeof parsed === 'object' && parsed && 'message' in parsed
            ? String((parsed as { message: unknown }).message)
            : undefined,
        };
    throw new ApiError(problem, requestId);
  }

  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isProblem(value: unknown): value is ProblemDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'code' in value &&
    'title' in value
  );
}

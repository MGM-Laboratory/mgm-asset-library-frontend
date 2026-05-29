/**
 * React Query key convention. Keep keys serializable and tuple-shaped so
 * cache eviction with `queryClient.invalidateQueries({ queryKey: [...] })`
 * can match by prefix.
 *
 * Each new feature area registers its keys here — do not define inline.
 */
import type { LocaleCode } from './types';

export const queryKeys = {
  me: ['me'] as const,

  notifications: (params: { unreadOnly?: boolean } = {}) =>
    ['notifications', params] as const,
  notificationsUnreadCount: ['notifications', 'unread-count'] as const,

  discover: (locale: LocaleCode) => ['discover', locale] as const,

  assets: (filters: Record<string, unknown> = {}) => ['assets', filters] as const,
  asset: (idOrSlug: string, locale: LocaleCode) => ['asset', idOrSlug, locale] as const,
  assetRecommended: (idOrSlug: string, locale: LocaleCode) =>
    ['asset', idOrSlug, 'recommended', locale] as const,

  library: (filters: Record<string, unknown> = {}) => ['library', filters] as const,
  libraryAll: ['library'] as const,
  savedIds: ['library', 'saved-ids'] as const,

  searchAssets: (q: string, filters: Record<string, unknown> = {}) =>
    ['search', 'assets', q, filters] as const,
  searchTags: (q: string) => ['search', 'tags', q] as const,
  searchTypeahead: (q: string) => ['search', 'typeahead', q] as const,

  categories: (locale: LocaleCode) => ['categories', locale] as const,
  tags: (q: string) => ['tags', q] as const,
  licenses: (locale: LocaleCode) => ['licenses', locale] as const,

  downloadOptions: (assetId: string, versionId: string) =>
    ['download-options', assetId, versionId] as const,

  assetVersions: (assetId: string) => ['asset', assetId, 'versions'] as const,

  comments: (assetId: string, filter: { kind?: 'ALL' | 'COMMENT' | 'ISSUE' } = {}) =>
    ['comments', assetId, filter] as const,

  notificationsInbox: (params: { unreadOnly?: boolean } = {}) =>
    ['notifications-inbox', params] as const,

  assetRequests: (filters: Record<string, unknown> = {}) =>
    ['asset-requests', filters] as const,

  myAnalyticsSummary: ['analytics', 'me', 'summary'] as const,
  myAnalyticsAsset: (assetId: string) => ['analytics', 'me', assetId] as const,

  publishManageList: (filters: Record<string, unknown> = {}) =>
    ['publish', 'manage', filters] as const,

  /* ---------- admin ---------- */
  adminDashboard: ['admin', 'dashboard'] as const,
  adminAssets: (filters: Record<string, unknown> = {}) =>
    ['admin', 'assets', filters] as const,
  adminFeatured: ['admin', 'featured'] as const,
  adminCategories: ['admin', 'categories'] as const,
  adminTags: (filters: Record<string, unknown> = {}) => ['admin', 'tags', filters] as const,
  adminLicenses: ['admin', 'licenses'] as const,
  adminReports: (filters: Record<string, unknown> = {}) => ['admin', 'reports', filters] as const,
  adminReport: (id: string) => ['admin', 'report', id] as const,
  adminAssetRequests: (filters: Record<string, unknown> = {}) =>
    ['admin', 'asset-requests', filters] as const,
  adminAssetRequest: (id: string) => ['admin', 'asset-request', id] as const,
  adminAv: ['admin', 'av'] as const,
  adminStorageUsers: (date?: string) => ['admin', 'storage', 'users', date] as const,
  adminStorageAssets: (date?: string) => ['admin', 'storage', 'assets', date] as const,
  adminUsers: (filters: Record<string, unknown> = {}) => ['admin', 'users', filters] as const,
  adminUser: (id: string) => ['admin', 'user', id] as const,
  adminAudit: (filters: Record<string, unknown> = {}) => ['admin', 'audit', filters] as const,
  adminAuditEntry: (id: string) => ['admin', 'audit', id] as const,
  adminWebhooks: (filters: Record<string, unknown> = {}) =>
    ['admin', 'webhooks', filters] as const,
};

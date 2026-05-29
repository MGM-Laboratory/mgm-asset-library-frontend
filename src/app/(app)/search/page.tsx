import { Container } from '@/components/layout/container';
import { SearchFilterSidebar } from '@/components/filters/search-filter-sidebar';
import { SearchResults } from '@/components/search/search-results';
import { requireSession } from '@/lib/auth/server';
import { apiFetch } from '@/lib/api/fetcher';
import type { LibraryPage } from '@/lib/api/types';

export const metadata = { title: 'Search' };
export const revalidate = 30;

export default async function SearchPage() {
  const session = await requireSession();
  let savedIds = new Set<string>();
  try {
    const lib = await apiFetch<LibraryPage>(`/library?limit=100`, {
      accessToken: session.accessToken,
      cache: 'no-store',
    });
    savedIds = new Set(lib.items.map((i) => i.asset.id));
  } catch {
    /* non-fatal */
  }

  return (
    <Container size="2xl">
      <div className="pt-6 pb-20 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <SearchFilterSidebar />
        <SearchResults savedIds={savedIds} />
      </div>
    </Container>
  );
}

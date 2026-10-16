import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DiscoveryFilterBar from '@/components/discovery/DiscoveryFilterBar';
import DiscoveryRecordPanel from '@/components/discovery/DiscoveryRecordPanel';
import DiscoveryResultCard from '@/components/discovery/DiscoveryResultCard';
import { useDiscoverySearch } from '@/hooks/useDiscoverySearch';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useSelection } from '@/hooks/useSelection';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';
import { discoveryResultToCourseItem } from '@/utils/discoveryResultToCourseItem';
import { useSubmissionEditorContext } from '@/pages/SubmissionEditor/SubmissionEditorContext';

interface SearchTabProps {
  isRecordRoute?: boolean;
  dbId?: string;
  an?: string;
}

export default function SearchTab({ isRecordRoute = false, dbId, an }: SearchTabProps) {
  const { id, reserve, addItem } = useSubmissionEditorContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const route = useParams();
  const recordDbId = dbId || route.dbId;
  const recordAn = an || route.an;
  const search = useDiscoverySearch({ enabled: !isRecordRoute });
  const { record, loading, error, loadRecord, clearSelection } = useSelection();
  const [draftQuery, setDraftQuery] = useState(search.query);

  useEffect(() => setDraftQuery(search.query), [search.query]);
  useEffect(() => {
    if (recordDbId && recordAn) void loadRecord(recordDbId, recordAn);
    else clearSelection();
  }, [recordDbId, recordAn, clearSelection, loadRecord]);

  const sentinelRef = useInfiniteScroll(search.loadMore, search.hasMore && !search.loading && !search.loadingMore);
  const searchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    search.setQuery(draftQuery);
  };
  const isDuplicate = (result: Parameters<typeof discoveryResultToCourseItem>[0]) =>
    Boolean(findDuplicateCourseItem(reserve.items, discoveryResultToCourseItem(result)));
  const openRecord = (result: Parameters<typeof discoveryResultToCourseItem>[0]) => {
    if (window.innerWidth < 768) {
      const params = new URLSearchParams(searchParams);
      params.set('tab', 'search');
      navigate(`/submission/${id}/edit/add/record/${encodeURIComponent(result.dbId)}/${encodeURIComponent(result.id)}?${params.toString()}`);
      return;
    }
    void loadRecord(result.dbId, result.id);
  };
  const addResult = (result: Parameters<typeof discoveryResultToCourseItem>[0]) => {
    if (!isDuplicate(result)) addItem(id, discoveryResultToCourseItem(result));
  };
  const addFullRecord = () => {
    if (record && !isDuplicate(record)) addItem(id, discoveryResultToCourseItem(record));
  };
  const backToSearch = () => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'search');
    navigate(`/submission/${id}/edit/add?${params.toString()}`);
  };
  const showRecordRoute = isRecordRoute || Boolean(recordDbId && recordAn);

  return (
    <section className="space-y-4" aria-label="Search the library">
      {!showRecordRoute && (
        <>
          <form onSubmit={searchSubmit} className="flex gap-2">
            <Input aria-label="Search the library" placeholder="Search by title, author, ISBN, or keywords" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} />
            <Button type="submit" disabled={search.loading || !draftQuery.trim()}>Search</Button>
          </form>
          <DiscoveryFilterBar filters={search.filters} facets={search.facets} onChange={search.setFilter} />
        </>
      )}

      <div className={showRecordRoute ? 'block' : 'grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(20rem,38%)]'}>
        {!showRecordRoute && (
          <div className="min-w-0 space-y-3">
            {search.query && <p className="text-sm text-muted-foreground">Found {search.totalHits.toLocaleString()} results{search.results.length > 0 ? ` · showing ${search.results.length}` : ''}{search.searchTime ? ` · ${search.searchTime}ms` : ''}</p>}
            {search.error && <div role="alert" className="whitespace-pre-line rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{search.error}</div>}
            {search.loading && search.results.length === 0 && <p role="status" className="py-10 text-center text-sm text-muted-foreground">Searching the library…</p>}
            {!search.loading && !search.error && search.results.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Enter a search to find books, articles, and other materials.</p>}
            <div className="space-y-3">
              {search.results.map((result) => (
                <DiscoveryResultCard
                  key={`${result.dbId}:${result.id}`}
                  result={result}
                  isDuplicate={isDuplicate(result)}
                  onOpenRecord={() => openRecord(result)}
                  onAdd={() => addResult(result)}
                />
              ))}
            </div>
            <div ref={sentinelRef} aria-hidden="true" />
            {search.loadingMore && <p role="status" className="py-3 text-center text-sm text-muted-foreground">Loading more results…</p>}
            {search.hasMore && <div className="text-center"><Button variant="outline" onClick={() => void search.loadMore()} disabled={search.loadingMore}>Load more</Button></div>}
          </div>
        )}
        {(showRecordRoute || window.innerWidth >= 768) && (
          <DiscoveryRecordPanel
            record={record}
            loading={loading}
            error={error}
            isRoute={showRecordRoute}
            onBack={showRecordRoute ? backToSearch : clearSelection}
            onAdd={record && !isDuplicate(record) ? addFullRecord : undefined}
          />
        )}
      </div>
    </section>
  );
}

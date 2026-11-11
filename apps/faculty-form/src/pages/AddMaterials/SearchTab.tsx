import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DiscoveryFilterBar from '@/components/discovery/DiscoveryFilterBar';
import DiscoveryRecordPanel from '@/components/discovery/DiscoveryRecordPanel';
import StickyRecordPane from '@/components/discovery/StickyRecordPane';
import DiscoveryResultCard from '@/components/discovery/DiscoveryResultCard';
import { useDiscoverySearch } from '@/hooks/useDiscoverySearch';
import { useCatalogAvailability } from '@/hooks/useCatalogAvailability';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useSelection } from '@/hooks/useSelection';
import { useOpenDiscoveryRecord } from '@/hooks/useOpenDiscoveryRecord';
import { useOnEscape } from './useOnEscape';
import { useDiscoveryResultActions } from './useDiscoveryResultActions';

interface SearchTabProps {
  isRecordRoute?: boolean;
  dbId?: string;
  an?: string;
}

export default function SearchTab({ isRecordRoute = false, dbId, an }: SearchTabProps) {
  const { id, isDuplicate, addResult } = useDiscoveryResultActions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const route = useParams();
  const recordDbId = dbId || route.dbId;
  const recordAn = an || route.an;
  const showRecordRoute = isRecordRoute || Boolean(recordDbId && recordAn);
  const search = useDiscoverySearch({ enabled: !showRecordRoute });
  const { record, selectedId, loading, error, loadRecord, clearSelection } = useSelection();
  const [draftQuery, setDraftQuery] = useState(search.query);
  const recordPaneRef = useRef<HTMLDivElement>(null);
  const returnToList = searchParams.get('returnTo') === 'list';
  const isSplitView = !showRecordRoute && Boolean(selectedId) && search.results.length > 0;
  const selectRecord = useCallback((selectedRecord: { dbId: string; an: string }) => {
    if (recordPaneRef.current) recordPaneRef.current.scrollTop = 0;
    void loadRecord(selectedRecord.dbId, selectedRecord.an);
  }, [loadRecord]);
  const openRecord = useOpenDiscoveryRecord({
    submissionId: id,
    tab: 'search',
    onOpenInline: selectRecord,
  });
  const availabilityResults = useMemo(
    () => showRecordRoute ? (record ? [record] : []) : search.results,
    [record, search.results, showRecordRoute],
  );
  const availability = useCatalogAvailability(availabilityResults);

  useEffect(() => setDraftQuery(search.query), [search.query]);
  useEffect(() => {
    if (recordDbId && recordAn) void loadRecord(recordDbId, recordAn);
    else clearSelection();
  }, [recordDbId, recordAn, clearSelection, loadRecord]);

  useOnEscape(isSplitView && window.innerWidth >= 768, clearSelection);

  const sentinelRef = useInfiniteScroll(
    search.loadMore,
    search.hasMore && !search.loading && !search.loadingMore,
  );
  const searchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    search.setQuery(draftQuery);
  };
  const addFullRecord = () => {
    if (record) addResult(record);
  };
  const backToSearch = () => {
    if (returnToList) {
      navigate(`/submission/${id}/edit`);
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'search');
    navigate(`/submission/${id}/edit/add?${params.toString()}`);
  };
  const fullRecordPanel = (
    <DiscoveryRecordPanel
      record={record}
      availability={availability.get(record?.id || '')}
      loading={loading}
      error={error}
      isRoute={showRecordRoute}
      onBack={showRecordRoute ? backToSearch : clearSelection}
      backLabel={returnToList ? 'Back to my list' : undefined}
      onAdd={record && !returnToList && !isDuplicate(record) ? addFullRecord : undefined}
    />
  );
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

      <div className={showRecordRoute ? 'block' : isSplitView ? 'grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(20rem,38%)]' : 'space-y-3'}>
        {!showRecordRoute && (
          <div
            className="min-w-0 space-y-3"
            role="region"
            aria-label="Search results"
          >
            {search.query && <p className="text-sm text-muted-foreground">Found {search.totalHits.toLocaleString()} results{search.results.length > 0 ? ` · showing ${search.results.length}` : ''}{search.searchTime ? ` · ${search.searchTime}ms` : ''}</p>}
            {search.error && <div role="alert" className="whitespace-pre-line rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{search.error}</div>}
            {search.loading && search.results.length === 0 && <p role="status" className="py-10 text-center text-sm text-muted-foreground">Searching the library…</p>}
            {!search.loading && !search.error && search.results.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Enter a search to find books, articles, and other materials.</p>}
            <div className="space-y-3">
              {search.results.map((result) => (
                <DiscoveryResultCard
                  key={`${result.dbId}:${result.id}`}
                  result={result}
                  availability={availability.get(result.id)}
                  isDuplicate={isDuplicate(result)}
                  isSelected={selectedId === result.id}
                  onOpenRecord={() => openRecord({ dbId: result.dbId, an: result.id })}
                  onAdd={() => addResult(result)}
                />
              ))}
            </div>
            <div ref={sentinelRef} aria-hidden="true" />
            {search.loadingMore && <p role="status" className="py-3 text-center text-sm text-muted-foreground">Loading more results…</p>}
            {search.hasMore && <div className="text-center"><Button variant="outline" onClick={() => void search.loadMore()} disabled={search.loadingMore}>Load more</Button></div>}
          </div>
        )}
        {showRecordRoute ? (
          <div
            className="md:min-h-0 md:overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            role="region"
            aria-label="Full record"
          >
            {fullRecordPanel}
          </div>
        ) : isSplitView && window.innerWidth >= 768 ? (
          <StickyRecordPane ref={recordPaneRef} tabIndex={0}>
            {fullRecordPanel}
          </StickyRecordPane>
        ) : null}
      </div>
    </section>
  );
}

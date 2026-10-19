import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const showRecordRoute = isRecordRoute || Boolean(recordDbId && recordAn);
  const search = useDiscoverySearch({ enabled: !isRecordRoute });
  const { record, selectedId, loading, error, loadRecord, clearSelection } = useSelection();
  const [draftQuery, setDraftQuery] = useState(search.query);
  const [sectionHeight, setSectionHeight] = useState<number>();
  const sectionRef = useRef<HTMLElement>(null);
  const resultsPaneRef = useRef<HTMLDivElement>(null);
  const recordPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraftQuery(search.query), [search.query]);
  useEffect(() => {
    if (recordDbId && recordAn) void loadRecord(recordDbId, recordAn);
    else clearSelection();
  }, [recordDbId, recordAn, clearSelection, loadRecord]);

  useLayoutEffect(() => {
    if (showRecordRoute) {
      setSectionHeight(undefined);
      return undefined;
    }

    const section = sectionRef.current;
    if (!section) return undefined;
    const tray = (section.closest('main') || document).querySelector<HTMLElement>('aside[aria-label="Added materials"]');
    const stickyTop = document.querySelector<HTMLElement>('[data-testid="page-sticky-top"]');
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      if (window.innerWidth < 768) {
        setSectionHeight(undefined);
        return;
      }
      frame = window.requestAnimationFrame(() => {
        const sectionTop = section.getBoundingClientRect().top;
        const trayTop = tray?.getBoundingClientRect().top ?? window.innerHeight;
        const availableBottom = Math.min(window.innerHeight, trayTop);
        setSectionHeight(Math.max(0, availableBottom - sectionTop));
      });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(section);
    if (tray) observer?.observe(tray);
    if (stickyTop) observer?.observe(stickyTop);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    measure();
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [showRecordRoute]);

  const sentinelRef = useInfiniteScroll(
    search.loadMore,
    search.hasMore && !search.loading && !search.loadingMore,
    resultsPaneRef,
  );
  const searchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    search.setQuery(draftQuery);
  };
  const isDuplicate = (result: Parameters<typeof discoveryResultToCourseItem>[0]) =>
    Boolean(findDuplicateCourseItem(reserve.items, discoveryResultToCourseItem(result)));
  const selectRecord = (dbId: string, an: string) => {
    if (recordPaneRef.current) recordPaneRef.current.scrollTop = 0;
    void loadRecord(dbId, an);
  };
  const openRecord = (result: Parameters<typeof discoveryResultToCourseItem>[0]) => {
    if (window.innerWidth < 768) {
      const params = new URLSearchParams(searchParams);
      params.set('tab', 'search');
      navigate(`/submission/${id}/edit/add/record/${encodeURIComponent(result.dbId)}/${encodeURIComponent(result.id)}?${params.toString()}`);
      return;
    }
    selectRecord(result.dbId, result.id);
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
  return (
    <section
      ref={sectionRef}
      className="space-y-4 md:flex md:min-h-0 md:flex-col"
      aria-label="Search the library"
      style={sectionHeight === undefined ? undefined : { height: `${sectionHeight}px` }}
    >
      {!showRecordRoute && (
        <>
          <form onSubmit={searchSubmit} className="flex gap-2">
            <Input aria-label="Search the library" placeholder="Search by title, author, ISBN, or keywords" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} />
            <Button type="submit" disabled={search.loading || !draftQuery.trim()}>Search</Button>
          </form>
          <DiscoveryFilterBar filters={search.filters} facets={search.facets} onChange={search.setFilter} />
        </>
      )}

      <div className={showRecordRoute ? 'block' : 'grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_minmax(20rem,38%)] md:grid-rows-[minmax(0,1fr)]'}>
        {!showRecordRoute && (
          <div
            ref={resultsPaneRef}
            className="min-w-0 space-y-3 md:min-h-0 md:overflow-y-auto md:overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            role="region"
            aria-label="Search results"
            tabIndex={0}
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
                  isDuplicate={isDuplicate(result)}
                  isSelected={selectedId === result.id}
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
          <div
            ref={recordPaneRef}
            className="md:min-h-0 md:overflow-y-auto md:overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            role="region"
            aria-label="Full record"
            tabIndex={0}
          >
            <DiscoveryRecordPanel
              record={record}
              loading={loading}
              error={error}
              isRoute={showRecordRoute}
              onBack={showRecordRoute ? backToSearch : clearSelection}
              onAdd={record && !isDuplicate(record) ? addFullRecord : undefined}
            />
          </div>
        )}
      </div>
    </section>
  );
}

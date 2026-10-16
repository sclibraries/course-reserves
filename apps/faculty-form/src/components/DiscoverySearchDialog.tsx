import { useEffect, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import DiscoveryFilterBar from '@/components/discovery/DiscoveryFilterBar';
import DiscoveryResultCard from '@/components/discovery/DiscoveryResultCard';
import { searchDiscovery } from '@/services/discoverySearchService';
import type { SearchLimiters } from '@/services/discoverySearchService';
import type { CourseItem } from '@/store/courseReservesStore';
import { executeCitationBatchSearch, prepareCitationBatchSearches } from '@/utils/citationBatchSearch';
import type { CitationBatchSearchGroup } from '@/utils/citationBatchSearch';
import { discoveryResultToCourseItem } from '@/utils/discoveryResultToCourseItem';

interface DiscoverySearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemsSelected: (items: Partial<CourseItem>[]) => void;
}

const noFacets = { sourceTypes: [], publicationYears: [] };

export function DiscoverySearchDialog({ open, onOpenChange, onItemsSelected }: DiscoverySearchDialogProps) {
  const [citationRaw, setCitationRaw] = useState('');
  const [groups, setGroups] = useState<CitationBatchSearchGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limiters, setLimiters] = useState<SearchLimiters>({});
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCitationRaw('');
      setGroups([]);
      setSelected(new Set());
      setError(null);
      setLimiters({});
    }
  }, [open]);

  const handleSearch = async (event?: React.FormEvent, nextLimiters = limiters) => {
    event?.preventDefault();
    const prepared = prepareCitationBatchSearches(citationRaw);
    if (prepared.length === 0) {
      setError('No citations were detected. Paste one citation per line or separate citation blocks with blank lines.');
      setGroups([]);
      setSelected(new Set());
      return;
    }
    setSearching(true);
    setError(null);
    setSelected(new Set());
    try {
      setGroups(await executeCitationBatchSearch(prepared, searchDiscovery, nextLimiters));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to search the pasted citations right now. Please try again.');
      setGroups([]);
    } finally {
      setSearching(false);
    }
  };

  const toggleSelection = (key: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const addSelected = () => {
    const items = groups.flatMap((group) => group.results
      .filter((result) => selected.has(selectionKey(group.id, result.id)))
      .map(discoveryResultToCourseItem));
    onItemsSelected(items);
    onOpenChange(false);
  };
  const resultCount = groups.reduce((total, group) => total + group.results.length, 0);
  const totalHits = groups.reduce((total, group) => total + group.totalHits, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle>Search citations in the library</DialogTitle>
          <DialogDescription>Paste citations to find matching library records.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-3">
            <form onSubmit={handleSearch} className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border p-4">
              <label htmlFor="citation-search-input" className="text-sm font-medium">Paste one or more citations</label>
              <Textarea
                id="citation-search-input"
                value={citationRaw}
                onChange={(event) => setCitationRaw(event.target.value)}
                placeholder="Paste citations here, one per line or separated by blank lines…"
                className="min-h-[180px] flex-1 resize-none font-mono text-sm"
              />
              <Button type="submit" disabled={searching || !citationRaw.trim()}>
                {searching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching citations…</> : <><Search className="mr-2 h-4 w-4" />Parse & Search Citations</>}
              </Button>
            </form>
            <DiscoveryFilterBar
              filters={limiters}
              facets={noFacets}
              onChange={(key, value) => {
                const next = { ...limiters, [key]: value };
                setLimiters(next);
                if (groups.length > 0) void handleSearch(undefined, next);
              }}
            />
            {error && <p role="alert" className="whitespace-pre-line rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {groups.length > 0 ? `${groups.length} citations · ${resultCount} results · ${totalHits.toLocaleString()} total hits · ${selected.size} selected` : 'Run a batch search to review matching records.'}
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-4">
                {groups.map((group) => (
                  <section key={group.id} className="space-y-3 rounded-lg border p-4">
                    <div>
                      <p className="text-sm font-medium">{group.rawCitation}</p>
                      {group.error ? <p className="mt-1 whitespace-pre-line text-sm text-destructive">{group.error}</p> : <p className="mt-1 text-xs text-muted-foreground">{group.totalHits.toLocaleString()} matches · {group.searchTime}ms</p>}
                    </div>
                    {group.results.map((result) => {
                      const key = selectionKey(group.id, result.id);
                      return <DiscoveryResultCard key={key} result={result} isSelected={selected.has(key)} onToggleSelection={() => toggleSelection(key)} />;
                    })}
                  </section>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={addSelected} disabled={selected.size === 0}><Plus className="mr-2 h-4 w-4" />Add {selected.size || ''} selected</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function selectionKey(groupId: string, resultId: string) {
  return `${groupId}::${resultId}`;
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import DiscoveryRecordPanel from '@/components/discovery/DiscoveryRecordPanel';
import { useOpenDiscoveryRecord, type OpenDiscoveryRecordOptions } from '@/hooks/useOpenDiscoveryRecord';
import { useSelection } from '@/hooks/useSelection';
import { searchDiscovery } from '@/services/discoverySearchService';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import { extractCitationsFromSyllabus } from '@/utils/syllabusCitationExtractor';
import { executeCitationBatchSearch, prepareCitationSearches } from '@/utils/citationBatchSearch';
import CitationReviewGroup from './CitationReviewGroup';
import PasteSkippedNotice from './PasteSkippedNotice';
import { EMPTY_PASTE_WORKSPACE, type PasteWorkspace } from './pasteCitationTypes';
import { useOnEscape } from './useOnEscape';
import { usePasteCitationActions } from './usePasteCitationActions';

interface PasteTabProps {
  isRecordRoute?: boolean;
  dbId?: string;
  an?: string;
}

export default function PasteTab({ isRecordRoute = false, dbId, an }: PasteTabProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pasteText, setPasteText] = useState(() => restorePasteText(location.state));
  const [workspace, setWorkspace] = useState<PasteWorkspace>(() => restoreWorkspace(location.state));
  const [hasAttemptedExtraction, setHasAttemptedExtraction] = useState(() => workspace.citations.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState<{ completed: number; total: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeCitationId, setActiveCitationId] = useState<string>();
  const { id, addedItemsByCitation, isWrittenDuplicate, isResultDuplicate, addAsWritten, addMatch, undoAddedMaterial } =
    usePasteCitationActions(workspace, setWorkspace);
  const { record, loading, error: recordError, loadRecord, clearSelection } = useSelection();
  const selectRecord = useCallback((selectedRecord: { dbId: string; an: string }, options: OpenDiscoveryRecordOptions) => {
    if (!options.citationId) return;
    setActiveCitationId(options.citationId);
    void loadRecord(selectedRecord.dbId, selectedRecord.an);
  }, [loadRecord]);
  const openDiscoveryRecord = useOpenDiscoveryRecord({
    submissionId: id,
    tab: 'paste',
    onOpenInline: selectRecord,
  });
  const routeCitationId = searchParams.get('citation') || undefined;
  const selectedCitationId = isRecordRoute ? routeCitationId : activeCitationId;
  const hasRecordPanel = !isRecordRoute && Boolean(activeCitationId) && window.innerWidth >= 768;
  const closeRecordPanel = useCallback(() => {
    setActiveCitationId(undefined);
    clearSelection();
  }, [clearSelection]);
  const groupsById = useMemo(() => new Map(workspace.groups.map((group) => [group.id, group])), [workspace.groups]);

  useEffect(() => {
    if (isRecordRoute && dbId && an) void loadRecord(dbId, an);
    else clearSelection();
  }, [an, clearSelection, dbId, isRecordRoute, loadRecord]);

  useOnEscape(hasRecordPanel, closeRecordPanel);

  const extractCitations = () => {
    setHasAttemptedExtraction(true);
    const extraction = extractCitationsFromSyllabus(pasteText);
    const citations = extraction.citations.map((text, index) => ({ id: 'citation-' + (index + 1), text }));
    const skipped = extraction.skipped.map((text, index) => ({ id: 'skipped-' + (index + 1), text }));
    setWorkspace((current) => ({
      citations,
      skipped,
      groups: [],
      choices: citations.reduce<PasteWorkspace['choices']>((choices, citation) => {
        const previousCitation = current.citations.find((entry) => entry.id === citation.id);
        const choice = previousCitation?.text === citation.text ? current.choices[citation.id] : undefined;
        if (choice) choices[citation.id] = choice;
        return choices;
      }, {}),
    }));
    setError(citations.length ? null : 'No citations were detected. Paste a reading list with citation details and try again.');
  };

  const addSkippedToList = (idToAdd: string) => {
    setError(null);
    setWorkspace((current) => {
      const skipped = current.skipped.find((block) => block.id === idToAdd);
      if (!skipped) return current;
      return {
        ...current,
        citations: [...current.citations, { id: `citation-from-${skipped.id}`, text: skipped.text }],
        skipped: current.skipped.filter((block) => block.id !== idToAdd),
      };
    });
  };

  const editCitation = (idToEdit: string, text: string) => {
    setWorkspace((current) => ({
      ...current,
      citations: current.citations.map((citation) => citation.id === idToEdit ? { ...citation, text } : citation),
      groups: [],
    }));
  };

  const removeCitation = (idToRemove: string) => {
    setWorkspace((current) => ({
      ...current,
      citations: current.citations.filter((citation) => citation.id !== idToRemove),
      groups: [],
      choices: Object.fromEntries(Object.entries(current.choices).filter(([id]) => id !== idToRemove)),
    }));
  };

  const openRecord = (citationId: string, result: DiscoverySearchResult) => openDiscoveryRecord(
    { dbId: result.dbId, an: result.id },
    { citationId, navigationState: { pasteWorkspace: workspace, pasteText } },
  );

  const backToPaste = (nextWorkspace = workspace) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'paste');
    params.delete('citation');
    navigate('/submission/' + id + '/edit/add?' + params.toString(), { state: { pasteWorkspace: nextWorkspace, pasteText } });
  };

  const useFullRecord = () => {
    const citationId = selectedCitationId;
    if (!record || !citationId) return;
    const nextWorkspace = addMatch(citationId, record);
    if (!nextWorkspace) return;
    if (isRecordRoute) backToPaste(nextWorkspace);
    else closeRecordPanel();
  };

  const findMatches = async () => {
    const citations = workspace.citations.filter((citation) => citation.text.trim());
    if (citations.length === 0) {
      setError('Add at least one citation before searching.');
      return;
    }
    const searches = prepareCitationSearches(citations.map((citation) => citation.text.trim()), citations.map((citation) => citation.id));
    setSearching(true);
    setError(null);
    setSearchProgress({ completed: 0, total: searches.length });
    setWorkspace((current) => ({ ...current, groups: [] }));
    try {
      const groups = await executeCitationBatchSearch(searches, searchDiscovery, undefined, {
        onProgress: (completed, total) => setSearchProgress({ completed, total }),
      });
      setWorkspace((current) => ({ ...current, groups }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to search the pasted citations right now. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  if (isRecordRoute) {
    return (
      <section aria-label="Paste a list record" className="space-y-4">
        <DiscoveryRecordPanel
          record={record}
          loading={loading}
          error={recordError}
          isRoute
          onBack={() => backToPaste()}
          onAdd={record && selectedCitationId && !addedItemsByCitation.has(selectedCitationId) && !isResultDuplicate(record) ? useFullRecord : undefined}
          addLabel="Use this match"
        />
      </section>
    );
  }

  return (
    <section aria-label="Paste a list" className="space-y-4">
      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <h2 className="text-lg font-semibold">Paste a reading list</h2>
          <p className="mt-1 text-sm text-muted-foreground">Paste citations, review the lines, then find library matches. Each one you add goes straight to your list.</p>
        </div>
        <Textarea
          aria-label="Paste a reading list"
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          placeholder="Paste citations here. Multi-line citations will be grouped together."
          rows={8}
          className="font-mono text-sm"
        />
        <Button variant="outline" onClick={extractCitations} disabled={searching || !pasteText.trim()}>
          {hasAttemptedExtraction ? 'Re-extract citations' : 'Extract citations'}
        </Button>
      </div>

      {error && <p role="alert" className="whitespace-pre-line rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {hasAttemptedExtraction && workspace.citations.length === 0 && !error && <p className="text-sm text-muted-foreground">No citations to review yet.</p>}
      {searching && searchProgress && (
        <p role="status" className="text-sm text-muted-foreground">Searching citations {searchProgress.completed} of {searchProgress.total}…</p>
      )}

      {workspace.citations.length > 0 && (
        <>
          <div className={hasRecordPanel ? 'grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(20rem,38%)]' : 'space-y-3'}>
            <div className="min-w-0 space-y-3">
              {workspace.citations.map((citation, index) => (
                <CitationReviewGroup
                  key={citation.id}
                  citation={citation}
                  index={index}
                  group={groupsById.get(citation.id)}
                  choice={addedItemsByCitation.has(citation.id) ? workspace.choices[citation.id] : undefined}
                  addedItem={addedItemsByCitation.get(citation.id)}
                  writtenDuplicate={isWrittenDuplicate(citation)}
                  isResultDuplicate={isResultDuplicate}
                  disabled={searching}
                  onEdit={editCitation}
                  onRemove={removeCitation}
                  onAddAsWritten={addAsWritten}
                  onOpenRecord={openRecord}
                  onAddMatch={(citationId, result) => { if (addMatch(citationId, result)) closeRecordPanel(); }}
                  onUndo={undoAddedMaterial}
                />
              ))}
            </div>
            {hasRecordPanel && (
              <DiscoveryRecordPanel
                record={record}
                loading={loading}
                error={recordError}
                onBack={closeRecordPanel}
                onAdd={record && selectedCitationId && !addedItemsByCitation.has(selectedCitationId) && !isResultDuplicate(record) ? useFullRecord : undefined}
                addLabel="Use this match"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button onClick={() => void findMatches()} disabled={searching || workspace.citations.length === 0}>
              {searching ? 'Finding matches…' : 'Find matches'}
            </Button>
          </div>
        </>
      )}
      <PasteSkippedNotice skipped={workspace.skipped} onAddToList={addSkippedToList} />
    </section>
  );
}

function restoreWorkspace(locationState: unknown): PasteWorkspace {
  if (!locationState || typeof locationState !== 'object' || !('pasteWorkspace' in locationState)) return EMPTY_PASTE_WORKSPACE;
  const workspace = locationState.pasteWorkspace;
  if (!workspace || typeof workspace !== 'object' || !('citations' in workspace) || !Array.isArray(workspace.citations)) return EMPTY_PASTE_WORKSPACE;
  return {
    ...workspace,
    skipped: Array.isArray(workspace.skipped) ? workspace.skipped : [],
  } as PasteWorkspace;
}

function restorePasteText(locationState: unknown): string {
  if (!locationState || typeof locationState !== 'object' || !('pasteText' in locationState)) return '';
  return typeof locationState.pasteText === 'string' ? locationState.pasteText : '';
}

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import DiscoveryRecordPanel from '@/components/discovery/DiscoveryRecordPanel';
import { useSelection } from '@/hooks/useSelection';
import { searchDiscovery } from '@/services/discoverySearchService';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import { useSubmissionEditorContext } from '@/pages/SubmissionEditor/SubmissionEditorContext';
import { extractCitationsFromSyllabus } from '@/utils/syllabusCitationExtractor';
import { citationToCourseItem } from '@/utils/citationToCourseItem';
import { discoveryResultToCourseItem } from '@/utils/discoveryResultToCourseItem';
import { executeCitationBatchSearch, prepareCitationSearches } from '@/utils/citationBatchSearch';
import CitationReviewGroup from './CitationReviewGroup';
import { EMPTY_PASTE_WORKSPACE, type CitationChoice, type EditableCitation, type PasteWorkspace } from './pasteCitationTypes';

interface PasteTabProps {
  isRecordRoute?: boolean;
  dbId?: string;
  an?: string;
}

export default function PasteTab({ isRecordRoute = false, dbId, an }: PasteTabProps) {
  const { id, addItemsFromExternalSource } = useSubmissionEditorContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pasteText, setPasteText] = useState(() => restorePasteText(location.state));
  const [workspace, setWorkspace] = useState<PasteWorkspace>(() => restoreWorkspace(location.state));
  const [hasAttemptedExtraction, setHasAttemptedExtraction] = useState(() => restoreWorkspace(location.state).citations.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState<{ completed: number; total: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeCitationId, setActiveCitationId] = useState<string>();
  const { record, loading, error: recordError, loadRecord, clearSelection } = useSelection();
  const routeCitationId = searchParams.get('citation') || undefined;
  const selectedCitationId = isRecordRoute ? routeCitationId : activeCitationId;
  const groupsById = useMemo(() => new Map(workspace.groups.map((group) => [group.id, group])), [workspace.groups]);

  useEffect(() => {
    if (isRecordRoute && dbId && an) void loadRecord(dbId, an);
    else clearSelection();
  }, [an, clearSelection, dbId, isRecordRoute, loadRecord]);

  const extractCitations = () => {
    setHasAttemptedExtraction(true);
    const citations = extractCitationsFromSyllabus(pasteText).map((text, index) => ({ id: 'citation-' + (index + 1), text }));
    setWorkspace({ citations, groups: [], choices: {} });
    setError(citations.length ? null : 'No citations were detected. Paste a reading list with citation details and try again.');
  };

  const editCitation = (idToEdit: string, text: string) => {
    setWorkspace((current) => ({
      citations: current.citations.map((citation) => citation.id === idToEdit ? { ...citation, text } : citation),
      groups: [],
      choices: {},
    }));
  };

  const removeCitation = (idToRemove: string) => {
    setWorkspace((current) => ({
      citations: current.citations.filter((citation) => citation.id !== idToRemove),
      groups: [],
      choices: {},
    }));
  };

  const addAsWritten = (citation: EditableCitation) => {
    setWorkspace((current) => ({
      ...current,
      choices: { ...current.choices, [citation.id]: { item: citationToCourseItem(citation.text), source: 'written', label: citation.text } },
    }));
  };

  const clearChoice = (citationId: string) => {
    setWorkspace((current) => {
      const choices = { ...current.choices };
      delete choices[citationId];
      return { ...current, choices };
    });
  };

  const chooseMatch = (citationId: string, result: DiscoverySearchResult) => {
    const choice: CitationChoice = {
      item: discoveryResultToCourseItem(result),
      source: 'match',
      label: result.title,
      resultId: result.id,
    };
    setWorkspace((current) => withChoice(current, citationId, choice));
    setActiveCitationId(undefined);
    clearSelection();
  };

  const openRecord = (citationId: string, result: DiscoverySearchResult) => {
    if (window.innerWidth < 768) {
      const params = new URLSearchParams(searchParams);
      params.set('tab', 'paste');
      params.set('citation', citationId);
      const recordPath = '/submission/' + id + '/edit/add/record/' + encodeURIComponent(result.dbId) + '/' + encodeURIComponent(result.id) + '?' + params.toString();
      navigate(recordPath, { state: { pasteWorkspace: workspace, pasteText } });
      return;
    }
    setActiveCitationId(citationId);
    void loadRecord(result.dbId, result.id);
  };

  const backToPaste = (nextWorkspace = workspace) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'paste');
    params.delete('citation');
    navigate('/submission/' + id + '/edit/add?' + params.toString(), { state: { pasteWorkspace: nextWorkspace, pasteText } });
  };

  const useFullRecord = () => {
    const citationId = selectedCitationId;
    if (!record || !citationId) return;
    const nextWorkspace = withChoice(workspace, citationId, {
      item: discoveryResultToCourseItem(record),
      source: 'match',
      label: record.title,
      resultId: record.id,
    });
    if (isRecordRoute) backToPaste(nextWorkspace);
    else chooseMatch(citationId, record);
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
    setWorkspace((current) => ({ ...current, groups: [], choices: {} }));
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

  const addSelected = () => {
    const items = workspace.citations.flatMap((citation) => {
      const choice = workspace.choices[citation.id];
      return choice ? [choice.item] : [];
    });
    if (items.length === 0) return;
    addItemsFromExternalSource(items);
    setWorkspace((current) => ({ ...current, choices: {} }));
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
          onAdd={record && selectedCitationId ? useFullRecord : undefined}
          addLabel="Use this match"
        />
      </section>
    );
  }

  const selectedCount = Object.keys(workspace.choices).length;
  return (
    <section aria-label="Paste a list" className="space-y-4">
      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <h2 className="text-lg font-semibold">Paste a reading list</h2>
          <p className="mt-1 text-sm text-muted-foreground">Paste citations, review the extracted lines, then search for library matches or add citations as written.</p>
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,38%)]">
            <div className="min-w-0 space-y-3">
              {workspace.citations.map((citation, index) => (
                <CitationReviewGroup
                  key={citation.id}
                  citation={citation}
                  index={index}
                  group={groupsById.get(citation.id)}
                  choice={workspace.choices[citation.id]}
                  disabled={searching}
                  onEdit={editCitation}
                  onRemove={removeCitation}
                  onAddAsWritten={addAsWritten}
                  onClearChoice={clearChoice}
                  onOpenRecord={openRecord}
                />
              ))}
            </div>
            {window.innerWidth >= 768 && (
              <DiscoveryRecordPanel
                record={record}
                loading={loading}
                error={recordError}
                onBack={() => { clearSelection(); setActiveCitationId(undefined); }}
                onAdd={record && selectedCitationId ? useFullRecord : undefined}
                addLabel="Use this match"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button onClick={() => void findMatches()} disabled={searching || workspace.citations.length === 0}>
              {searching ? 'Finding matches…' : 'Find matches'}
            </Button>
            <Button onClick={addSelected} disabled={searching || selectedCount === 0}>Add selected ({selectedCount})</Button>
          </div>
        </>
      )}
    </section>
  );
}

function withChoice(workspace: PasteWorkspace, citationId: string, choice: CitationChoice): PasteWorkspace {
  return { ...workspace, choices: { ...workspace.choices, [citationId]: choice } };
}

function restoreWorkspace(locationState: unknown): PasteWorkspace {
  if (!locationState || typeof locationState !== 'object' || !('pasteWorkspace' in locationState)) return EMPTY_PASTE_WORKSPACE;
  const workspace = locationState.pasteWorkspace;
  if (!workspace || typeof workspace !== 'object' || !('citations' in workspace) || !Array.isArray(workspace.citations)) return EMPTY_PASTE_WORKSPACE;
  return workspace as PasteWorkspace;
}

function restorePasteText(locationState: unknown): string {
  if (!locationState || typeof locationState !== 'object' || !('pasteText' in locationState)) return '';
  return typeof locationState.pasteText === 'string' ? locationState.pasteText : '';
}

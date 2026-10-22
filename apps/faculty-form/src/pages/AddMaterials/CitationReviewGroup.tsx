import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import DiscoveryResultCard from '@/components/discovery/DiscoveryResultCard';
import { findCitationBestMatch, type CitationBatchSearchGroup } from '@course-reserves/citations';
import type { CitationChoice, EditableCitation } from './pasteCitationTypes';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import type { CatalogAvailabilityLookup } from '@/hooks/useCatalogAvailability';
import type { CourseItem } from '@/store/courseReservesStore';

interface CitationReviewGroupProps {
  citation: EditableCitation;
  index: number;
  group?: CitationBatchSearchGroup<DiscoverySearchResult>;
  choice?: CitationChoice;
  addedItem?: CourseItem;
  writtenDuplicate?: boolean;
  isResultDuplicate: (result: DiscoverySearchResult) => boolean;
  disabled?: boolean;
  availability: CatalogAvailabilityLookup['get'];
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onAddAsWritten: (citation: EditableCitation) => void;
  onOpenRecord: (citationId: string, result: DiscoverySearchResult) => void;
  onAddMatch: (citationId: string, result: DiscoverySearchResult) => void;
  onUndo: (itemId: string) => void;
}

export default function CitationReviewGroup({ citation, index, group, choice, addedItem, writtenDuplicate, isResultDuplicate, disabled = false, availability, onEdit, onRemove, onAddAsWritten, onOpenRecord, onAddMatch, onUndo }: CitationReviewGroupProps) {
  const [showOtherMatches, setShowOtherMatches] = useState(false);
  const { best, others } = group ? findCitationBestMatch(citation.text, group.results) : { best: undefined, others: [] };
  const hasAddedChoice = Boolean(choice && addedItem);
  const otherMatchesId = `other-matches-${citation.id}`;

  const renderMatch = (result: DiscoverySearchResult) => {
    const selectedChoice = Boolean(addedItem && choice?.resultId === result.id);
    return (
      <DiscoveryResultCard
        key={`${citation.id}:${result.dbId}:${result.id}`}
        result={result}
        availability={availability(result.id)}
        isDuplicate={!selectedChoice && isResultDuplicate(result)}
        onOpenRecord={() => onOpenRecord(citation.id, result)}
        onAdd={addedItem ? undefined : () => onAddMatch(citation.id, result)}
        addLabel="Use this match"
      />
    );
  };

  return (
    <section data-citation-id={citation.id} className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start gap-2">
        <span className="pt-2 text-sm font-mono text-muted-foreground">{index + 1}.</span>
        <Textarea
          aria-label={`Edit citation ${index + 1}`}
          value={citation.text}
          onChange={(event) => onEdit(citation.id, event.target.value)}
          disabled={disabled}
          rows={3}
        />
        <Button aria-label={`Remove citation ${index + 1}`} variant="ghost" size="sm" disabled={disabled} onClick={() => onRemove(citation.id)}>Remove</Button>
      </div>

      {choice && addedItem ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <span>
            {choice.source === 'written' ? 'Added as written ✓' : 'Added to your list ✓'}
            {choice.source === 'match' && <span className="ml-2 text-muted-foreground">{addedItem.title}</span>}
          </span>
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onUndo(addedItem.id)}>Undo</Button>
        </div>
      ) : writtenDuplicate ? (
        <p className="text-sm text-muted-foreground">In your list ✓</p>
      ) : (
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => onAddAsWritten(citation)}>Add as written</Button>
      )}

      {group?.error && <p role="alert" className="whitespace-pre-line text-sm text-destructive">{group.error}</p>}
      {group && !group.error && group.results.length === 0 && <p className="text-sm text-muted-foreground">No matches found. You can add this citation as written.</p>}
      {group && !group.error && best && !hasAddedChoice && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Best match</h3>
          {renderMatch(best)}
          {others.length > 0 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={showOtherMatches}
                aria-controls={otherMatchesId}
                disabled={disabled}
                onClick={() => setShowOtherMatches((current) => !current)}
              >
                {showOtherMatches ? 'Hide other matches' : `Show ${others.length} more matches`}
              </Button>
              <div id={otherMatchesId} className="space-y-2" hidden={!showOtherMatches}>
                {others.map(renderMatch)}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

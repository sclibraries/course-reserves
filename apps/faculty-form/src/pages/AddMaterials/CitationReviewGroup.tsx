import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import DiscoveryResultCard from '@/components/discovery/DiscoveryResultCard';
import type { CitationBatchSearchGroup } from '@/utils/citationBatchSearch';
import type { CitationChoice, EditableCitation } from './pasteCitationTypes';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';

interface CitationReviewGroupProps {
  citation: EditableCitation;
  index: number;
  group?: CitationBatchSearchGroup;
  choice?: CitationChoice;
  disabled?: boolean;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onAddAsWritten: (citation: EditableCitation) => void;
  onClearChoice: (id: string) => void;
  onOpenRecord: (citationId: string, result: DiscoverySearchResult) => void;
}

export default function CitationReviewGroup({ citation, index, group, choice, disabled = false, onEdit, onRemove, onAddAsWritten, onClearChoice, onOpenRecord }: CitationReviewGroupProps) {
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

      {choice ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <span>{choice.source === 'written' ? 'Selected as written' : `Selected match: ${choice.label}`}</span>
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onClearChoice(citation.id)}>Clear selection</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => onAddAsWritten(citation)}>Add as written</Button>
      )}

      {group?.error && <p role="alert" className="whitespace-pre-line text-sm text-destructive">{group.error}</p>}
      {group && !group.error && group.results.length === 0 && <p className="text-sm text-muted-foreground">No matches found. You can add this citation as written.</p>}
      {group && group.results.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Best matches</h3>
          {group.results.map((result) => (
            <DiscoveryResultCard
              key={`${citation.id}:${result.dbId}:${result.id}`}
              result={result}
              isSelected={choice?.resultId === result.id}
              onOpenRecord={() => onOpenRecord(citation.id, result)}
              onAdd={() => onOpenRecord(citation.id, result)}
              addLabel="Use this match"
            />
          ))}
        </div>
      )}
    </section>
  );
}

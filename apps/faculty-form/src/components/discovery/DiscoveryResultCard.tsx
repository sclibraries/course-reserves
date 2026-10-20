import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CatalogAvailability } from '@/services/catalogAvailabilityApi';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import DiscoveryAvailabilityBadge from './DiscoveryAvailabilityBadge';

interface DiscoveryResultCardProps {
  result: DiscoverySearchResult;
  availability?: CatalogAvailability;
  availabilityLoading?: boolean;
  availabilityFailed?: boolean;
  isDuplicate?: boolean;
  isSelected?: boolean;
  onOpenRecord?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  onToggleSelection?: () => void;
}

export default function DiscoveryResultCard({
  result,
  availability,
  availabilityLoading = false,
  availabilityFailed = false,
  isDuplicate = false,
  isSelected = false,
  onOpenRecord,
  onAdd,
  addLabel = 'Add',
  onToggleSelection,
}: DiscoveryResultCardProps) {
  const activate = onOpenRecord || onToggleSelection;

  return (
    <article className={`rounded-lg border p-4 ${isSelected ? 'border-primary bg-primary/5' : 'bg-background'}`}>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          aria-label={`Open full record for ${result.title}`}
          onClick={activate}
          disabled={!activate}
        >
          <h3 className="font-semibold leading-snug">{result.title}</h3>
          {result.authors.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{result.authors.join('; ')}</p>}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{result.publicationType}</span>
            {result.publicationDate?.year && <span>{result.publicationDate.year}</span>}
            {result.journalTitle && <span>{result.journalTitle}</span>}
            {result.publicationInfo && <span>{result.publicationInfo}</span>}
            {result.database && <span>{result.database}</span>}
          </div>
        </button>
        {isSelected && <Badge variant="secondary">Selected</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DiscoveryAvailabilityBadge
            result={result}
            availability={availability}
            loading={availabilityLoading}
            failed={availabilityFailed}
          />
          {isDuplicate && <Badge variant="secondary">In your list ✓</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenRecord && (
            <Button
              size="sm"
              variant="outline"
              aria-label={`View full record for ${result.title}`}
              onClick={onOpenRecord}
            >
              View full record
            </Button>
          )}
          {onAdd && <Button size="sm" onClick={onAdd} disabled={isDuplicate}>{addLabel}</Button>}
        </div>
      </div>
    </article>
  );
}

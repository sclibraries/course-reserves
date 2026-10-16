import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';

interface DiscoveryResultCardProps {
  result: DiscoverySearchResult;
  isDuplicate?: boolean;
  isSelected?: boolean;
  onOpenRecord?: () => void;
  onAdd?: () => void;
  onToggleSelection?: () => void;
}

export default function DiscoveryResultCard({
  result,
  isDuplicate = false,
  isSelected = false,
  onOpenRecord,
  onAdd,
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
          <Badge variant="outline">{result.hasFullText ? 'Full text available' : 'Check availability'}</Badge>
          {isDuplicate && <Badge variant="secondary">In your list ✓</Badge>}
        </div>
        {onAdd && (
          <Button size="sm" onClick={onAdd} disabled={isDuplicate}>
            Add
          </Button>
        )}
      </div>
    </article>
  );
}

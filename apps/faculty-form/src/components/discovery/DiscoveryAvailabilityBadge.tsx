import { Badge } from '@/components/ui/badge';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import type { CatalogAvailabilityView } from '@/hooks/useCatalogAvailability';
import { isHeldElectronically, isPhysicalRecord, summarizeCopies } from '@/utils/holdingsSummary';

interface DiscoveryAvailabilityBadgeProps {
  result: DiscoverySearchResult;
  availability?: CatalogAvailabilityView;
}

const toneClasses = {
  checking: 'text-muted-foreground',
  available: 'border-green-700/30 bg-green-50 text-green-900',
  'checked-out': 'border-amber-700/30 bg-amber-50 text-amber-900',
  'other-college': 'text-foreground',
  'not-held': 'text-muted-foreground',
  error: 'border-destructive/40 bg-destructive/5 text-destructive',
};

export default function DiscoveryAvailabilityBadge({ result, availability }: DiscoveryAvailabilityBadgeProps) {
  const summary = isPhysicalRecord(result)
    ? summarizeCopies(availability?.entry, availability?.loading, availability?.failed)
    : result.hasFullText
      ? { label: 'Full text available', tone: 'available' as const }
      : isHeldElectronically(result)
        ? { label: 'Online at Smith', tone: 'available' as const }
        : { label: 'Not held by Smith', tone: 'not-held' as const };

  return <Badge variant="outline" className={toneClasses[summary.tone]}>{summary.label}</Badge>;
}

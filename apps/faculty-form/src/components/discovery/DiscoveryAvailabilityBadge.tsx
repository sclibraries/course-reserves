import { Badge } from '@/components/ui/badge';
import type { CatalogAvailability } from '@/services/catalogAvailabilityApi';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import { isHeldElectronically, isPhysicalRecord, summarizeCopies } from '@/utils/holdingsSummary';

interface DiscoveryAvailabilityBadgeProps {
  result: DiscoverySearchResult;
  availability?: CatalogAvailability;
  loading?: boolean;
  failed?: boolean;
}

const toneClasses = {
  checking: 'text-muted-foreground',
  available: 'border-green-700/30 bg-green-50 text-green-900',
  'checked-out': 'border-amber-700/30 bg-amber-50 text-amber-900',
  'other-college': 'text-foreground',
  'not-held': 'text-muted-foreground',
  error: 'border-destructive/40 bg-destructive/5 text-destructive',
};

export default function DiscoveryAvailabilityBadge({
  result,
  availability,
  loading = false,
  failed = false,
}: DiscoveryAvailabilityBadgeProps) {
  const summary = isPhysicalRecord(result)
    ? summarizeCopies(availability, loading, failed)
    : result.hasFullText
      ? { label: 'Full text available', tone: 'available' as const }
      : isHeldElectronically(result)
        ? { label: 'Online at Smith', tone: 'available' as const }
        : { label: 'Not held by Smith', tone: 'not-held' as const };

  return <Badge variant="outline" className={toneClasses[summary.tone]}>{summary.label}</Badge>;
}

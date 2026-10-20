import { useEffect, useMemo, useState } from 'react';
import { getCatalogAvailability, type CatalogAvailability } from '@/services/catalogAvailabilityApi';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import { isPhysicalRecord } from '@/utils/holdingsSummary';

export interface CatalogAvailabilityState {
  byAn: Record<string, CatalogAvailability>;
  loading: boolean;
  failed: boolean;
}

const EMPTY_STATE: CatalogAvailabilityState = { byAn: {}, loading: false, failed: false };
const EMPTY_BY_AN: Record<string, CatalogAvailability> = {};

export function useCatalogAvailability(
  visibleResults: DiscoverySearchResult[],
  requestKey: string,
  seedByAn: Record<string, CatalogAvailability> = EMPTY_BY_AN,
): CatalogAvailabilityState {
  const accessionNumbers = useMemo(() => Array.from(new Set(
    visibleResults.filter(isPhysicalRecord).map((result) => result.id).filter(Boolean),
  )), [visibleResults]);
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(() => {
    let cancelled = false;
    const seeded = Object.fromEntries(accessionNumbers
      .filter((an) => Object.prototype.hasOwnProperty.call(seedByAn, an))
      .map((an) => [an, seedByAn[an]]));
    const toFetch = accessionNumbers.filter((an) => !Object.prototype.hasOwnProperty.call(seeded, an));

    if (toFetch.length === 0) {
      setState({ byAn: seeded, loading: false, failed: false });
      return () => { cancelled = true; };
    }

    setState({ byAn: seeded, loading: true, failed: false });
    const batches = [];
    for (let index = 0; index < toFetch.length; index += 20) {
      batches.push(toFetch.slice(index, index + 20));
    }

    void Promise.all(batches.map(async (batch) => {
      try {
        return { records: await getCatalogAvailability(batch), failed: false };
      } catch {
        return {
          records: Object.fromEntries(batch.map((an) => [an, { instanceId: null, error: true as const }])),
          failed: true,
        };
      }
    })).then((responses) => {
      if (cancelled) return;
      setState({
        byAn: Object.assign({}, seeded, ...responses.map((response) => response.records)),
        loading: false,
        failed: responses.some((response) => response.failed),
      });
    });

    return () => { cancelled = true; };
  }, [accessionNumbers, requestKey, seedByAn]);

  return state;
}

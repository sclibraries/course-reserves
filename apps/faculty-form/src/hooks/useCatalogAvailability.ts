import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCatalogAvailability, type CatalogAvailability } from '@/services/catalogAvailabilityApi';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import { isPhysicalRecord } from '@/utils/holdingsSummary';

export interface CatalogAvailabilityView {
  entry?: CatalogAvailability;
  loading: boolean;
  failed: boolean;
}

export interface CatalogAvailabilityLookup {
  get: (accessionNumber: string) => CatalogAvailabilityView;
}

const EMPTY_VIEW: CatalogAvailabilityView = { loading: false, failed: false };

export function useCatalogAvailability(visibleResults: DiscoverySearchResult[]): CatalogAvailabilityLookup {
  const accessionNumbers = useMemo(() => Array.from(new Set(
    visibleResults.filter(isPhysicalRecord).map((result) => result.id).filter(Boolean),
  )), [visibleResults]);
  const [entries, setEntries] = useState<Record<string, CatalogAvailabilityView>>({});
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    if (accessionNumbers.length === 0) return;
    const missing = accessionNumbers.filter((an) => !entriesRef.current[an]?.entry);
    if (missing.length) {
      setEntries((current) => ({
        ...current,
        ...Object.fromEntries(missing.map((an) => [an, { loading: true, failed: false }])),
      }));
    }

    void getCatalogAvailability(accessionNumbers).then((records) => {
      setEntries((current) => ({
        ...current,
        ...Object.fromEntries(accessionNumbers.map((an) => [an, {
          entry: records[an],
          loading: false,
          failed: false,
        }])),
      }));
    }).catch(() => {
      setEntries((current) => ({
        ...current,
        ...Object.fromEntries(accessionNumbers.map((an) => [an, { loading: false, failed: true }])),
      }));
    });
  }, [accessionNumbers]);

  const get = useCallback((accessionNumber: string) => entries[accessionNumber] || EMPTY_VIEW, [entries]);
  return { get };
}

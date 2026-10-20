import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CATALOG_AVAILABILITY_BATCH_SIZE,
  getCatalogAvailability,
  getCatalogAvailabilityExpiresAt,
  type CatalogAvailability,
} from '@/services/catalogAvailabilityApi';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import { isPhysicalRecord } from '@/utils/holdingsSummary';

export interface CatalogAvailabilityView {
  entry?: CatalogAvailability;
  loading: boolean;
  failed: boolean;
}

interface StoredAvailabilityView extends CatalogAvailabilityView {
  expiresAt?: number;
}

export interface CatalogAvailabilityLookup {
  get: (accessionNumber: string) => CatalogAvailabilityView;
}

const EMPTY_VIEW: CatalogAvailabilityView = { loading: false, failed: false };

export function useCatalogAvailability(visibleResults: DiscoverySearchResult[]): CatalogAvailabilityLookup {
  const accessionNumbers = useMemo(() => Array.from(new Set(
    visibleResults.filter(isPhysicalRecord).map((result) => result.id).filter(Boolean),
  )), [visibleResults]);
  const [entries, setEntries] = useState<Record<string, StoredAvailabilityView>>({});
  const entriesRef = useRef(entries);
  const pending = useRef(new Set<string>());
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const missing = accessionNumbers.filter((an) => {
      if (pending.current.has(an)) return false;
      const current = entriesRef.current[an];
      return !current?.entry || (current.expiresAt !== undefined && current.expiresAt <= Date.now());
    });
    if (missing.length === 0) return;

    missing.forEach((an) => pending.current.add(an));
    const loadingEntries = { ...entriesRef.current };
    missing.forEach((an) => {
      loadingEntries[an] = { loading: true, failed: false };
    });
    entriesRef.current = loadingEntries;
    setEntries(loadingEntries);

    const batches: string[][] = [];
    for (let index = 0; index < missing.length; index += CATALOG_AVAILABILITY_BATCH_SIZE) {
      batches.push(missing.slice(index, index + CATALOG_AVAILABILITY_BATCH_SIZE));
    }
    void Promise.all(batches.map(async (batch) => {
      try {
        return { accessionNumbers: batch, records: await getCatalogAvailability(batch), failed: false };
      } catch {
        return { accessionNumbers: batch, records: {}, failed: true };
      }
    })).then((responses) => {
      const nextEntries = { ...entriesRef.current };
      responses.forEach((response) => response.accessionNumbers.forEach((an) => {
        pending.current.delete(an);
        nextEntries[an] = response.failed
          ? { loading: false, failed: true }
          : {
            entry: response.records[an],
            loading: false,
            failed: false,
            expiresAt: getCatalogAvailabilityExpiresAt(an),
          };
      }));
      entriesRef.current = nextEntries;
      if (mounted.current) setEntries(nextEntries);
    });
  }, [accessionNumbers]);

  const get = useCallback((accessionNumber: string) => {
    const entry = entries[accessionNumber];
    if (!entry || (entry.expiresAt !== undefined && entry.expiresAt <= Date.now())) return EMPTY_VIEW;
    return entry;
  }, [entries]);

  return { get };
}

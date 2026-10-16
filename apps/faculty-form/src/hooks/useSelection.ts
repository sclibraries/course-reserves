import { useCallback, useRef, useState } from 'react';
import { retrieveDiscoveryRecord } from '@/services/discoverySearchService';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';

export function useSelection() {
  const [record, setRecord] = useState<DiscoverySearchResult>();
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadRecord = useCallback(async (dbId: string, an: string) => {
    const currentRequest = ++requestId.current;
    setSelectedId(an);
    setRecord(undefined);
    setLoading(true);
    setError(null);
    try {
      const response = await retrieveDiscoveryRecord(dbId, an);
      if (requestId.current === currentRequest) setRecord(response);
    } catch (cause) {
      if (requestId.current === currentRequest) {
        setError(cause instanceof Error ? cause.message : 'Unable to retrieve this library record right now. Please try again.');
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    requestId.current += 1;
    setSelectedId(undefined);
    setRecord(undefined);
    setError(null);
    setLoading(false);
  }, []);

  return { record, selectedId, loading, error, loadRecord, clearSelection };
}

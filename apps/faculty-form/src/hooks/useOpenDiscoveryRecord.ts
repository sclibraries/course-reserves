import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export interface DiscoveryRecordReference {
  dbId: string;
  an: string;
}

export interface OpenDiscoveryRecordOptions {
  citationId?: string;
  navigationState?: unknown;
}

interface UseOpenDiscoveryRecordOptions {
  submissionId: string;
  tab: 'search' | 'paste';
  returnToList?: boolean;
  onOpenInline: (record: DiscoveryRecordReference, options: OpenDiscoveryRecordOptions) => void;
}

export function useOpenDiscoveryRecord({
  submissionId,
  tab,
  returnToList = false,
  onOpenInline,
}: UseOpenDiscoveryRecordOptions) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return useCallback((record: DiscoveryRecordReference, options: OpenDiscoveryRecordOptions = {}) => {
    if (window.innerWidth < 768) {
      const params = new URLSearchParams(searchParams);
      params.set('tab', tab);
      if (options.citationId) params.set('citation', options.citationId);
      else params.delete('citation');
      if (returnToList) params.set('returnTo', 'list');
      else params.delete('returnTo');

      const route = `/submission/${submissionId}/edit/add/record/${encodeURIComponent(record.dbId)}/${encodeURIComponent(record.an)}?${params.toString()}`;
      navigate(route, { state: options.navigationState });
      return;
    }

    onOpenInline(record, options);
  }, [navigate, onOpenInline, returnToList, searchParams, submissionId, tab]);
}

import { useCallback } from 'react';
import { useSubmissionEditorContext } from '@/pages/SubmissionEditor/SubmissionEditorContext';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';
import { discoveryResultToCourseItem } from '@/utils/discoveryResultToCourseItem';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';

export function useDiscoveryResultActions() {
  const { id, reserve, addItem } = useSubmissionEditorContext();

  const isDuplicate = useCallback((result: DiscoverySearchResult) => (
    Boolean(findDuplicateCourseItem(reserve.items, discoveryResultToCourseItem(result)))
  ), [reserve.items]);

  const addResult = useCallback((result: DiscoverySearchResult) => {
    const item = discoveryResultToCourseItem(result);
    if (findDuplicateCourseItem(reserve.items, item)) return false;
    return addItem(id, item);
  }, [addItem, id, reserve.items]);

  return { id, isDuplicate, addResult };
}

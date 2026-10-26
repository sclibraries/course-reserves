import { useCallback } from 'react';
import { useSubmissionEditorContext } from '@/pages/SubmissionEditor/SubmissionEditorContext';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';
import { discoveryResultToCourseItem } from '@/utils/discoveryResultToCourseItem';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import type { AddMaterialOptions } from '@/handlers/addMaterialHandler';

export function useDiscoveryResultActions() {
  const { id, reserve, addItem } = useSubmissionEditorContext();

  const isDuplicate = useCallback((result: DiscoverySearchResult) => (
    Boolean(findDuplicateCourseItem(reserve.items, discoveryResultToCourseItem(result)))
  ), [reserve.items]);

  const addResult = useCallback((result: DiscoverySearchResult, folderId?: string, options?: AddMaterialOptions) => {
    const item = { ...discoveryResultToCourseItem(result), ...(folderId ? { folderId } : {}) };
    if (findDuplicateCourseItem(reserve.items, item)) return false;
    return addItem(id, item, options);
  }, [addItem, id, reserve.items]);

  return { id, isDuplicate, addResult };
}

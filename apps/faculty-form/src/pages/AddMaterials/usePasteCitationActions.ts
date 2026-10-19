import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useSubmissionEditorContext } from '@/pages/SubmissionEditor/SubmissionEditorContext';
import { citationToCourseItem } from '@/utils/citationToCourseItem';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';
import { discoveryResultToCourseItem } from '@/utils/discoveryResultToCourseItem';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import type { CitationChoice, EditableCitation, PasteWorkspace } from './pasteCitationTypes';
import { useDiscoveryResultActions } from './useDiscoveryResultActions';

export function usePasteCitationActions(
  workspace: PasteWorkspace,
  setWorkspace: Dispatch<SetStateAction<PasteWorkspace>>,
) {
  const { id, reserve, addItem, addedMaterials, undoAddedMaterial } = useSubmissionEditorContext();
  const { isDuplicate: isResultDuplicate, addResult } = useDiscoveryResultActions();
  const addedItemsByCitation = useMemo(() => new Map(
    Object.entries(workspace.choices).flatMap(([citationId, choice]) => {
      // Plain citations may have no duplicate key, so also confirm their saved list ID exists.
      const item = (choice.addedItemId && reserve.items.find((entry) => entry.id === choice.addedItemId))
        || findDuplicateCourseItem(reserve.items, choice.item)?.item;
      return item ? [[citationId, item] as const] : [];
    }),
  ), [reserve.items, workspace.choices]);

  useEffect(() => {
    const itemIds = new Set(reserve.items.map((item) => item.id));
    const lastAdded = addedMaterials[addedMaterials.length - 1];
    const updates = Object.entries(workspace.choices).flatMap(([citationId, choice]) => {
      if (choice.addedItemId || !lastAdded || lastAdded.title !== choice.item.title || !itemIds.has(lastAdded.id)) return [];
      return [[citationId, lastAdded.id] as const];
    });
    if (updates.length === 0) return;
    setWorkspace((current) => ({
      ...current,
      choices: updates.reduce((choices, [citationId, addedItemId]) => {
        const choice = choices[citationId];
        if (choice && !choice.addedItemId) choices[citationId] = { ...choice, addedItemId };
        return choices;
      }, { ...current.choices }),
    }));
  }, [addedMaterials, reserve.items, setWorkspace, workspace.choices]);

  const isWrittenDuplicate = useCallback((citation: EditableCitation) => (
    Boolean(findDuplicateCourseItem(reserve.items, citationToCourseItem(citation.text)))
  ), [reserve.items]);

  const addAsWritten = useCallback((citation: EditableCitation) => {
    const item = citationToCourseItem(citation.text);
    if (!addItem(id, item)) return false;
    setWorkspace((current) => withChoice(current, citation.id, {
      item, source: 'written',
    }));
    return true;
  }, [addItem, id, setWorkspace]);

  const addMatch = useCallback((citationId: string, result: DiscoverySearchResult) => {
    if (!addResult(result)) return false;
    const choice: CitationChoice = {
      item: discoveryResultToCourseItem(result),
      source: 'match',
      resultId: result.id,
    };
    setWorkspace((current) => withChoice(current, citationId, choice));
    return withChoice(workspace, citationId, choice);
  }, [addResult, setWorkspace, workspace]);

  return { id, addedItemsByCitation, isWrittenDuplicate, isResultDuplicate, addAsWritten, addMatch, undoAddedMaterial };
}

function withChoice(workspace: PasteWorkspace, citationId: string, choice: PasteWorkspace['choices'][string]): PasteWorkspace {
  return { ...workspace, choices: { ...workspace.choices, [citationId]: choice } };
}

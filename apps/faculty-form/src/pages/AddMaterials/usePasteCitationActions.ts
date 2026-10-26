import { useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { useSubmissionEditorContext } from '@/pages/SubmissionEditor/SubmissionEditorContext';
import { citationToCourseItem } from '@/utils/citationToCourseItem';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import type { CitationChoice, EditableCitation, PasteWorkspace } from './pasteCitationTypes';
import { useDiscoveryResultActions } from './useDiscoveryResultActions';

export function usePasteCitationActions(
  workspace: PasteWorkspace,
  setWorkspace: Dispatch<SetStateAction<PasteWorkspace>>,
  keepUnheadedAtRoot = false,
) {
  const { id, reserve, addItem, createFolder, undoAddedMaterial } = useSubmissionEditorContext();
  const { isDuplicate: isResultDuplicate, addResult } = useDiscoveryResultActions();
  const folderIdsByHeading = useRef(new Map<string, string>());
  const addedItemsByCitation = useMemo(() => new Map(
    Object.entries(workspace.choices).flatMap(([citationId, choice]) => {
      // Plain citations may have no duplicate key, so also confirm their saved list ID exists.
      const item = (choice.addedItemId && reserve.items.find((entry) => entry.id === choice.addedItemId))
        || findDuplicateCourseItem(reserve.items, choice.item)?.item;
      return item ? [[citationId, item] as const] : [];
    }),
  ), [reserve.items, workspace.choices]);


  const isWrittenDuplicate = useCallback((citation: EditableCitation) => (
    Boolean(findDuplicateCourseItem(reserve.items, citationToCourseItem(citation.text)))
  ), [reserve.items]);

  const addAsWritten = useCallback((citation: EditableCitation) => {
    const item = citationToCourseItem(citation.text);
    const folderId = folderForHeading(citation.heading, reserve, id, createFolder, folderIdsByHeading.current);
    const itemToAdd = folderId ? { ...item, folderId } : item;
    const addOptions = folderId || keepUnheadedAtRoot ? { preserveFolder: true } : undefined;
    const addedItem = addItem(id, itemToAdd, addOptions);
    if (!addedItem) return false;
    setWorkspace((current) => withChoice(current, citation.id, {
      item: itemToAdd, source: 'written', addedItemId: addedItem.id,
    }));
    return true;
  }, [addItem, createFolder, id, keepUnheadedAtRoot, reserve, setWorkspace]);

  const addMatch = useCallback((citationId: string, result: DiscoverySearchResult) => {
    const citation = workspace.citations.find((entry) => entry.id === citationId);
    const folderId = folderForHeading(citation?.heading, reserve, id, createFolder, folderIdsByHeading.current);
    const addOptions = folderId || keepUnheadedAtRoot ? { preserveFolder: true } : undefined;
    const addedItem = addResult(result, folderId, addOptions);
    if (!addedItem) return false;
    const choice: CitationChoice = { item: addedItem, source: 'match', resultId: result.id, addedItemId: addedItem.id };
    setWorkspace((current) => withChoice(current, citationId, choice));
    return withChoice(workspace, citationId, choice);
  }, [addResult, createFolder, id, keepUnheadedAtRoot, reserve, setWorkspace, workspace]);

  return { id, addedItemsByCitation, isWrittenDuplicate, isResultDuplicate, addAsWritten, addMatch, undoAddedMaterial };
}

function withChoice(workspace: PasteWorkspace, citationId: string, choice: PasteWorkspace['choices'][string]): PasteWorkspace {
  return { ...workspace, choices: { ...workspace.choices, [citationId]: choice } };
}

function folderForHeading(
  heading: string | null | undefined,
  reserve: ReturnType<typeof useSubmissionEditorContext>['reserve'],
  reserveId: string,
  createFolder: ReturnType<typeof useSubmissionEditorContext>['createFolder'],
  folderIdsByHeading: Map<string, string>,
): string | undefined {
  const title = heading?.trim();
  if (!title) return undefined;
  const existing = reserve.folders.find((folder) => folder.title === title)?.id;
  if (existing) return existing;
  const remembered = folderIdsByHeading.get(title);
  if (remembered) return remembered;
  const folderId = createFolder(reserveId, title);
  folderIdsByHeading.set(title, folderId);
  return folderId;
}

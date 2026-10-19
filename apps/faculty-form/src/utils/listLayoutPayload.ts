import type { ListLayoutState } from './listLayoutTypes';

export interface PayloadOrder {
  displayOrder: Array<{ type: 'folder' | 'item'; id: string; displayPosition: number }>;
  folderOrder: Record<string, number>;
  resourceOrder: Record<string, { displayOrder: number; positionInFolder: number | null }>;
  orderedItemIds: string[];
}

export function toPayloadOrder(state: ListLayoutState): PayloadOrder {
  const displayOrder: PayloadOrder['displayOrder'] = [];
  const folderOrder: Record<string, number> = {};
  const resourceOrder: PayloadOrder['resourceOrder'] = {};
  const orderedItemIds: string[] = [];

  state.layout.forEach((entry, index) => {
    displayOrder.push({ type: entry.kind, id: entry.id, displayPosition: index });
    if (entry.kind === 'item') {
      resourceOrder[entry.id] = { displayOrder: index, positionInFolder: null };
      orderedItemIds.push(entry.id);
      return;
    }

    folderOrder[entry.id] = index;
    const folder = state.folders.find((candidate) => candidate.id === entry.id);
    folder?.itemIds.forEach((itemId, itemIndex) => {
      resourceOrder[itemId] = { displayOrder: index, positionInFolder: itemIndex };
      orderedItemIds.push(itemId);
    });
  });

  return { displayOrder, folderOrder, resourceOrder, orderedItemIds };
}

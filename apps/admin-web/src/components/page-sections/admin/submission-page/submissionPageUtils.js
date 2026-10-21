import { formatSubmissionClaimItems } from '../../../../services/admin/workflowClaims/claimsFormatters';

const DONE_STATUSES = new Set(['complete', 'unavailable', 'withdrawn']);

function itemKey(item) {
  return `${item.kind || (item.isReuse ? 'reuse' : 'new')}/${item.id}`;
}

function folderOrder(folder, index) {
  const positions = folder.items.map((item) => Number(item.displayOrder)).filter(Number.isFinite);
  return positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER + index;
}

export function isItemDone(item) {
  return Boolean(item.finish_state) || DONE_STATUSES.has(item.status);
}

export function isItemClaimedByCurrentUser(item, currentUser) {
  return Boolean(currentUser?.username && item.claimed_by === currentUser.username);
}

export function getClaimBadge(item, currentUser) {
  if (isItemDone(item)) return { label: 'Done', variant: 'secondary' };
  if (isItemClaimedByCurrentUser(item, currentUser)) return { label: 'You', variant: 'default' };
  if (item.claimed_by) {
    return { label: item.claimed_by_display || item.claimed_by, variant: 'outline' };
  }
  if (item.assigned_group?.name) return { label: item.assigned_group.name, variant: 'secondary' };
  return { label: 'Unclaimed', variant: 'outline' };
}

export function buildSubmissionItemGroups(folders = [], unfolderedItems = [], submission = {}) {
  const items = [...folders.flatMap((folder) => folder.items), ...unfolderedItems];
  const claimsByItem = new Map(
    formatSubmissionClaimItems(items, submission).map((item) => [itemKey(item), item]),
  );
  const withClaim = (item) => ({ ...item, ...claimsByItem.get(itemKey(item)) });
  const orderedFolders = folders
    .map((folder, index) => ({ ...folder, order: folderOrder(folder, index), index }))
    .sort((left, right) => left.order - right.order || left.index - right.index);
  const groups = orderedFolders.map((folder) => ({
    name: folder.name,
    items: folder.items.map(withClaim),
  }));

  if (unfolderedItems.length) {
    groups.push({ name: 'Not in a folder', items: unfolderedItems.map(withClaim) });
  }
  return groups;
}

export function countSubmissionItems(items) {
  const done = items.filter(isItemDone).length;
  const inProgress = items.filter((item) => !isItemDone(item) && item.status === 'in_progress').length;
  return { total: items.length, todo: items.length - done - inProgress, inProgress, done };
}

export function filterSubmissionItems(items, filter, currentUser) {
  if (filter === 'mine') return items.filter((item) => isItemClaimedByCurrentUser(item, currentUser));
  if (filter === 'unclaimed') {
    return items.filter((item) => !isItemDone(item) && !item.claimed_by && !item.assigned_group);
  }
  if (filter === 'done') return items.filter(isItemDone);
  return items;
}

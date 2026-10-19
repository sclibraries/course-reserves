import type { CourseReserve } from './types';

export interface SubmissionRefetchMerge {
  reserve: CourseReserve;
  hasRemoteItemsChanged: boolean;
}

export function mergeRefetchedSubmission(
  local: CourseReserve | undefined,
  server: CourseReserve,
  previousServer?: CourseReserve
): SubmissionRefetchMerge {
  if (!local || !hasLocalMaterialEdits(local, previousServer)) {
    return { reserve: server, hasRemoteItemsChanged: false };
  }

  return {
    reserve: {
      ...local,
      status: server.status,
      lastUpdated: server.lastUpdated,
      assigneeStaffUserId: server.assigneeStaffUserId,
      isLocked: server.isLocked,
      lockedAt: server.lockedAt,
      lockedBy: server.lockedBy,
      lockReason: server.lockReason,
      canEdit: server.canEdit,
      access: server.access,
      proxyCanEdit: server.proxyCanEdit,
    },
    hasRemoteItemsChanged: materialsDiffer(previousServer || local, server),
  };
}

export function hasLocalMaterialEdits(
  local: CourseReserve | undefined,
  serverSnapshot: CourseReserve | undefined
): boolean {
  return !!local && !!serverSnapshot && materialsDiffer(local, serverSnapshot);
}

function materialsDiffer(local: CourseReserve, server: CourseReserve): boolean {
  if (JSON.stringify(local.items) !== JSON.stringify(server.items)) return true;
  if (JSON.stringify(local.layout) !== JSON.stringify(server.layout)) return true;

  const localFolders = local.folders.map(({ isOpen: _isOpen, ...folder }) => folder);
  const serverFolders = server.folders.map(({ isOpen: _isOpen, ...folder }) => folder);
  return JSON.stringify(localFolders) !== JSON.stringify(serverFolders);
}

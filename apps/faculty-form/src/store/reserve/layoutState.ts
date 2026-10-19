import type { CourseReserve, CourseReservesState } from './types';
import { fromLegacy, type ListLayoutState } from '@/utils/listLayout';

export function getLayoutState(reserve: CourseReserve): ListLayoutState {
  if (reserve.layout && reserve.folders.every((folder) => Array.isArray(folder.itemIds))) {
    return reserve;
  }
  return fromLegacy(
    reserve.folders as unknown as Parameters<typeof fromLegacy>[0],
    reserve.items || []
  );
}

export function updateReserveLayout(
  state: CourseReservesState,
  reserveId: string,
  operation: (reserve: ListLayoutState) => ListLayoutState
): CourseReservesState | Pick<CourseReservesState, 'reserves'> {
  const reserve = state.reserves.find((entry) => entry.id === reserveId);
  if (!reserve) return state;

  const current = getLayoutState(reserve);
  const updated = operation(current);
  if (updated === current && current === reserve) return state;

  return {
    reserves: state.reserves.map((entry) => entry.id === reserveId
      ? {
          ...entry,
          ...updated,
          lastUpdated: updated === current ? entry.lastUpdated : new Date().toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          }),
        }
      : entry),
  };
}

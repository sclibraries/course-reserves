import type { CourseReserve, ListLayoutEntry } from '@/store/reserve/types';

export type LayoutEntry = ListLayoutEntry;
export type ListLayoutState = Pick<CourseReserve, 'layout' | 'folders' | 'items'>;

export type MoveTarget =
  | { before: string }
  | { after: string }
  | { intoFolder: string; index?: number }
  | { end: true };

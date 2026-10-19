import { describe, expect, it } from 'vitest';
import type { CourseReserve } from './types';
import { getLayoutState } from './layoutState';

describe('getLayoutState', () => {
  it('defaults missing folders and items to empty arrays', () => {
    const reserve = {
      folders: undefined,
      items: undefined,
      layout: undefined,
    } as unknown as CourseReserve;

    expect(getLayoutState(reserve)).toMatchObject({
      folders: [],
      items: [],
      layout: [],
    });
  });
});

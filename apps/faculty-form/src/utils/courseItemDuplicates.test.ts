import { describe, expect, it } from 'vitest';
import type { CourseItem } from '@/store/courseReservesStore';
import { findDuplicateCourseItem } from './courseItemDuplicates';

const baseItem = {
  id: 'item-1',
  title: 'Climate Change and Society',
  materialType: 'book',
  status: 'draft',
} satisfies CourseItem;

describe('findDuplicateCourseItem', () => {
  it('detects duplicate physical reserve items by barcode', () => {
    const existing = [{ ...baseItem, barcode: ' 39099012345678 ' }];
    const candidate = { title: 'Different title', barcode: '39099012345678' };

    expect(findDuplicateCourseItem(existing, candidate)?.matchField).toBe('barcode');
  });

  it('detects duplicate discovery items by DOI', () => {
    const existing = [{ ...baseItem, doi: '10.1000/ABC.Def' }];
    const candidate = { title: 'Different title', doi: 'https://doi.org/10.1000/abc.def' };

    expect(findDuplicateCourseItem(existing, candidate)?.matchField).toBe('doi');
  });

  it('does not treat title-only matches as duplicates when authors differ', () => {
    const existing = [{ ...baseItem, authors: 'Jane Smith' }];
    const candidate = { title: 'Climate Change and Society', authors: 'Riley Jones' };

    expect(findDuplicateCourseItem(existing, candidate)).toBeUndefined();
  });
});

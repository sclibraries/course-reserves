import { describe, expect, it } from 'vitest';
import { getDropZone } from './listDropZone';

describe('getDropZone', () => {
  const rect = { top: 100, bottom: 200 };

  it('splits a folder row into before, into, and after zones', () => {
    expect(getDropZone(rect, 124, 'folder')).toBe('before');
    expect(getDropZone(rect, 126, 'folder')).toBe('into');
    expect(getDropZone(rect, 174, 'folder')).toBe('into');
  });

  it('assigns exact folder edge ratios to before and after', () => {
    expect(getDropZone(rect, 125, 'folder')).toBe('before');
    expect(getDropZone(rect, 175, 'folder')).toBe('after');
  });

  it('splits an item row into before and after zones', () => {
    expect(getDropZone(rect, 149, 'item')).toBe('before');
    expect(getDropZone(rect, 150, 'item')).toBe('after');
  });
});

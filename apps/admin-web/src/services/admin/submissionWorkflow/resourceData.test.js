import { describe, expect, it } from 'vitest';
import { readResourceData } from './resourceData';

describe('readResourceData', () => {
  it.each([
    ['object', { title: 'Synthetic item' }, { title: 'Synthetic item' }],
    ['JSON string', '{"title":"Synthetic item"}', { title: 'Synthetic item' }],
    ['invalid string', 'not JSON', {}],
    ['missing data', undefined, {}],
  ])('reads %s resource data', (_label, resourceData, expected) => {
    expect(readResourceData(resourceData)).toEqual(expected);
  });
});

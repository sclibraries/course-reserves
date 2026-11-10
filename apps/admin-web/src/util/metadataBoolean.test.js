import { describe, expect, it } from 'vitest';
import { metadataBoolean } from './metadataBoolean';

describe('metadataBoolean', () => {
  it.each([
    ['Yes', true],
    ['1', true],
    ['true', true],
    ['No', false],
    ['0', false],
    ['false', false],
    ['TRUE', false],
    ['', false],
  ])('converts %j to %s', (value, expected) => {
    expect(metadataBoolean(value)).toBe(expected);
  });
});

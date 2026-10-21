import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges conflicting prefixed Tailwind utilities', () => {
    expect(cn('tw-px-2', 'tw-px-4')).toBe('tw-px-4');
  });
});

import { describe, expect, it } from 'vitest';
import { countReadiness, filterNotReadyItems, getReadinessStatus } from './submissionPageUtils';

describe('submission readiness', () => {
  it('counts in-progress items and keeps Not ready limited to missing and unknown', () => {
    const items = [
      { readiness: 'ready' },
      { readiness: 'in_progress' },
      { readiness: 'missing' },
      { readiness: 'unknown' },
    ];

    expect(getReadinessStatus(items[1])).toBe('in_progress');
    expect(countReadiness(items)).toEqual({ total: 4, ready: 1, in_progress: 1, missing: 1, unknown: 1 });
    expect(filterNotReadyItems(items)).toEqual([items[2], items[3]]);
  });
});

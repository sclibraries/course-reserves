import { describe, expect, it } from 'vitest';
import { isHitchcockVideoUrl } from './externalLinks';

const videoUrl = ['https:', '', 'ereserves.smith.edu/hitchcock/videos/test-video'].join('/');

describe('isHitchcockVideoUrl', () => {
  it('recognizes URLs under the Hitchcock video path', () => {
    expect(isHitchcockVideoUrl(videoUrl)).toBe(true);
  });

  it('rejects URLs outside the Hitchcock video path', () => {
    expect(isHitchcockVideoUrl('https://example.test/hitchcock/videos/test-video')).toBe(false);
    expect(isHitchcockVideoUrl('https://ereserves.smith.edu/hitchcock/other/test-video')).toBe(false);
  });

  it('returns false for null, undefined, and empty input', () => {
    expect(isHitchcockVideoUrl(null)).toBe(false);
    expect(isHitchcockVideoUrl(undefined)).toBe(false);
    expect(isHitchcockVideoUrl('')).toBe(false);
  });
});

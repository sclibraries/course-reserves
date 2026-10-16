import { describe, expect, it } from 'vitest';
import { formatAcademicPeriod, getCourseTermLabel } from './courseTermLabel';

describe('course term labels', () => {
  it('formats an ITS academic period as its roster semester', () => {
    expect(formatAcademicPeriod('AP_202702')).toBe('Spring 2027');
  });

  it('keeps an unrecognized academic period readable', () => {
    expect(getCourseTermLabel(null, 'Fall 2026')).toBe('Fall 2026');
    expect(formatAcademicPeriod('AP_202713')).toBe('AP_202713');
  });

  it('prefers the mapped FOLIO term when it exists', () => {
    expect(getCourseTermLabel('Fall 2026', 'AP_202702')).toBe('Fall 2026');
  });
});

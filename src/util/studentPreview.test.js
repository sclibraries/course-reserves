import { describe, expect, it } from 'vitest';
import {
  canBypassVisibility,
  isStudentPreview,
  withStudentPreview,
} from './studentPreview';

describe('student preview policy', () => {
  it('recognizes only the explicit student preview value', () => {
    expect(isStudentPreview('?preview=student')).toBe(true);
    expect(isStudentPreview('?preview=staff')).toBe(false);
    expect(isStudentPreview('')).toBe(false);
  });

  it('allows only non-preview authenticated sessions to bypass visibility', () => {
    expect(canBypassVisibility(true, false)).toBe(true);
    expect(canBypassVisibility(true, true)).toBe(false);
    expect(canBypassVisibility(false, false)).toBe(false);
    expect(canBypassVisibility(false, true)).toBe(false);
  });

  it('adds preview without losing existing parameters', () => {
    expect(withStudentPreview('?college=smith&section=01', true))
      .toBe('?college=smith&section=01&preview=student');
  });

  it('removes only preview when exiting', () => {
    expect(withStudentPreview('?college=smith&preview=student&section=01', false))
      .toBe('?college=smith&section=01');
  });
});

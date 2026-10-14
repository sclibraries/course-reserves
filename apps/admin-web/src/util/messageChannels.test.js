import { describe, expect, it } from 'vitest';
import { matchesCommunicationChannel } from './messageChannels';

describe('matchesCommunicationChannel', () => {
  it('matches faculty communication by sender, type, or visibility', () => {
    expect(matchesCommunicationChannel({ sender_type: 'faculty' }, 'faculty')).toBe(true);
    expect(matchesCommunicationChannel({ communication_type: 'faculty_to_staff' }, 'faculty')).toBe(true);
    expect(matchesCommunicationChannel({ visibility: 'faculty_visible' }, 'faculty')).toBe(true);
    expect(matchesCommunicationChannel({ sender_type: 'staff' }, 'faculty')).toBe(false);
  });

  it('matches notes by category or communication type', () => {
    expect(matchesCommunicationChannel({ category: 'note' }, 'notes')).toBe(true);
    expect(matchesCommunicationChannel({ communication_type: 'note' }, 'notes')).toBe(true);
    expect(matchesCommunicationChannel({ communication_type: 'internal_note' }, 'notes')).toBe(true);
    expect(matchesCommunicationChannel({ sender_type: 'staff' }, 'notes')).toBe(false);
  });

  it('excludes notes from staff communication', () => {
    expect(matchesCommunicationChannel({ sender_type: 'staff' }, 'staff')).toBe(true);
    expect(matchesCommunicationChannel({ communication_type: 'staff_to_staff' }, 'staff')).toBe(true);
    expect(matchesCommunicationChannel({ visibility: 'staff_only' }, 'staff')).toBe(true);
    expect(matchesCommunicationChannel({ category: 'note', sender_type: 'staff' }, 'staff')).toBe(false);
    expect(matchesCommunicationChannel({ visibility: 'faculty_visible' }, 'staff')).toBe(false);
  });
});

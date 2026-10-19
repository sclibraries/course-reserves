import { describe, expect, it } from 'vitest';
import {
  formatExpiry,
  formatSubmissionClaimItems,
  getClaimsErrorMessage,
  sortMyClaimedItems,
  sortQueueItems,
} from './claimsFormatters';

describe('claims formatters', () => {
  it('maps every claims error code to a staff message', () => {
    const cases = [
      ['already_claimed', { claimed_by_display: 'Test Staff' }, 'Already claimed by Test Staff.'],
      ['not_claimed_by_you', {}, 'You can release only items claimed by you.'],
      ['not_claimed', {}, 'This item is no longer claimed. Refresh and try again.'],
      ['reason_required', {}, 'Enter a reason to take over this item.'],
      ['not_group_member', {}, 'Only group members can claim this; use Take over with a reason.'],
      ['group_has_items', {}, 'Move or finish its items first.'],
      ['unknown_staff', {}, 'The selected staff member could not be found.'],
      ['submission_not_linked', {}, 'Link this submission before managing its item claims.'],
    ];

    cases.forEach(([errorCode, details, expected]) => {
      expect(getClaimsErrorMessage({ payload: { error_code: errorCode, ...details } })).toBe(expected);
    });
  });

  it('sorts queue items by submission then faculty position', () => {
    const items = [
      { id: 1, submission_id: 8, position: 2 },
      { id: 2, submission_id: 7, position: 3 },
      { id: 3, submission_id: 7, position: 1 },
    ];

    expect(sortQueueItems(items).map((item) => item.id)).toEqual([3, 2, 1]);
  });

  it('sorts my items by soonest expiry with undated claims last', () => {
    const items = [
      { id: 1, expires_at: '2026-10-20T12:00:00Z' },
      { id: 2, expires_at: null },
      { id: 3, expires_at: '2026-10-19T12:00:00Z' },
    ];

    expect(sortMyClaimedItems(items).map((item) => item.id)).toEqual([3, 1, 2]);
  });

  it('formats remaining expiry hours and warns below twelve hours', () => {
    const now = Date.parse('2026-10-19T12:00:00Z');

    expect(formatExpiry('2026-10-20T11:00:00Z', now)).toEqual({ label: 'Expires in 23 h', warning: false });
    expect(formatExpiry('2026-10-19T23:00:00Z', now)).toEqual({ label: 'Expires in 11 h', warning: true });
  });

  it('maps submission details into claim summaries ordered by faculty position', () => {
    const submission = { id: 54, uuid: 'synthetic-api078-submission', courseCode: 'TST 101', section: '01', term: '2026FA' };
    const items = [
      { id: 99907812, isReuse: true, title: 'Later item', materialType: 'book', displayOrder: 2, status: 'pending' },
      { id: 99907811, isReuse: false, title: 'First item', materialType: 'article', displayOrder: 1, status: 'pending', current_step_label: 'Check ownership' },
    ];

    expect(formatSubmissionClaimItems(items, submission)).toEqual([
      expect.objectContaining({
        kind: 'new', id: 99907811, submission_id: 54, submission_uuid: 'synthetic-api078-submission',
        course_code: 'TST 101', section: '01', term_code: '2026FA', title: 'First item',
        material_type: 'article', position: 1, claimed_by: null, assigned_group: null,
        current_step_label: 'Check ownership', finish_state: null,
      }),
      expect.objectContaining({ kind: 'reuse', id: 99907812, position: 2, title: 'Later item' }),
    ]);
  });

  it('preserves flow status fields returned on a submission item', () => {
    const items = [
      { id: 99907813, isReuse: true, displayOrder: 1, current_step_label: null, finish_state: 'on_reserve' },
    ];

    expect(formatSubmissionClaimItems(items)[0]).toEqual(expect.objectContaining({
      current_step_label: null,
      finish_state: 'on_reserve',
    }));
  });
});

import { describe, expect, it } from 'vitest';
import { getFlowErrorCode, getFlowErrorMessage } from './flowFormatters';

describe('workflow flow errors', () => {
  it.each([
    ['not_claimed_by_you', 'Claim this item to work on it'],
    ['stale_step', 'Someone else moved this item on'],
    ['unknown_outcome', 'This outcome is no longer available. Reload the item flow.'],
    ['reason_required', 'Enter a reason to continue.'],
    ['step_not_available_yet', 'FOLIO confirmation arrives in a later update'],
    ['unknown_flow', 'The selected flow could not be found.'],
    ['unknown_group', 'The destination group could not be found.'],
  ])('maps %s to its staff message', (code, message) => {
    const error = { payload: { error_code: code } };

    expect(getFlowErrorCode(error)).toBe(code);
    expect(getFlowErrorMessage(error)).toBe(message);
  });
});

import { describe, expect, it } from 'vitest';
import { buildStepResultBody, outcomeNeedsConfirmation } from './flowRules';

describe('workflow flow rules', () => {
  it('requires confirmation for outcomes with a reason or group hand-off', () => {
    expect(outcomeNeedsConfirmation({ reason_required: true })).toBe(true);
    expect(outcomeNeedsConfirmation({ next: { handoff_group: 'Acquisitions' } })).toBe(true);
    expect(outcomeNeedsConfirmation({ next: { step: 'available' } })).toBe(false);
  });

  it('builds a result body with trimmed action notes and required reasons only', () => {
    const actionStep = { key: 'recall', kind: 'action' };
    const needsReason = { key: 'cannot_get', reason_required: true };

    expect(buildStepResultBody(actionStep, needsReason, '  Recall placed  ', '  Order needed  ')).toEqual({
      step_key: 'recall', outcome_key: 'cannot_get', notes: 'Recall placed', reason: 'Order needed',
    });
    expect(buildStepResultBody({ key: 'own_it', kind: 'question' }, { key: 'yes' }, 'ignored', 'ignored')).toEqual({
      step_key: 'own_it', outcome_key: 'yes',
    });
  });
});

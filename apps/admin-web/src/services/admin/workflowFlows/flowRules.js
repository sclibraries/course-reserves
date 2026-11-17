export function outcomeNeedsConfirmation(outcome) {
  return Boolean(outcome?.reason_required || outcome?.next?.handoff_group);
}

export function buildStepResultBody(step, outcome, flowState, notes = '', reason = '') {
  const body = {
    run_id: flowState.run_id,
    result_seq: flowState.result_seq,
    step_key: step.key,
    outcome_key: outcome.key,
  };
  const actionNotes = String(notes || '').trim();
  const requiredReason = String(reason || '').trim();

  if (step.kind === 'action' && actionNotes) body.notes = actionNotes;
  if (outcome.reason_required && requiredReason) body.reason = requiredReason;
  return body;
}

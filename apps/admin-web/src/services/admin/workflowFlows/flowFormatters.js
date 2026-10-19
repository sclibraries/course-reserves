const flowErrorMessages = {
  not_claimed_by_you: 'Claim this item to work on it',
  stale_step: 'Someone else moved this item on',
  unknown_outcome: 'This outcome is no longer available. Reload the item flow.',
  reason_required: 'Enter a reason to continue.',
  step_not_available_yet: 'FOLIO confirmation arrives in a later update',
  unknown_flow: 'The selected flow could not be found.',
  unknown_group: 'The destination group could not be found.',
};

const finishStateLabels = {
  on_reserve: 'On reserve',
  available_online: 'Available online',
  unavailable: 'Unavailable',
  withdrawn: 'Withdrawn',
};

export function getFlowErrorCode(error) {
  return (error?.payload || error?.data)?.error_code || '';
}

export function getFlowErrorMessage(error) {
  return flowErrorMessages[getFlowErrorCode(error)]
    || error?.message
    || 'The item flow could not be updated. Check your connection and try again.';
}

export function formatFinishState(state) {
  return finishStateLabels[state]
    || String(state || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const HOUR_MS = 60 * 60 * 1000;

const errorMessages = {
  not_claimed_by_you: 'You can release only items claimed by you.',
  not_claimed: 'This item is no longer claimed. Refresh and try again.',
  reason_required: 'Enter a reason to take over this item.',
  not_group_member: 'Only group members can claim this; use Take over with a reason.',
  group_has_items: 'Move or finish its items first.',
  unknown_staff: 'The selected staff member could not be found.',
  submission_not_linked: 'Link this submission before managing its item claims.',
};

export function getClaimsErrorMessage(error) {
  const payload = error?.payload || error?.data;
  const code = payload?.error_code;
  if (code === 'already_claimed') {
    return `Already claimed by ${payload.claimed_by_display || 'another staff member'}.`;
  }
  return errorMessages[code] || error?.message || 'The request could not be completed. Check your connection and try again.';
}

export function sortQueueItems(items = []) {
  return [...items].sort((left, right) => (
    Number(left.submission_id) - Number(right.submission_id)
    || Number(left.position) - Number(right.position)
  ));
}

export function sortMyClaimedItems(items = []) {
  return [...items].sort((left, right) => {
    const leftExpiry = Date.parse(left.expires_at) || Number.POSITIVE_INFINITY;
    const rightExpiry = Date.parse(right.expires_at) || Number.POSITIVE_INFINITY;
    return leftExpiry - rightExpiry;
  });
}

export function formatExpiry(expiresAt, now = Date.now()) {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return { label: 'Expiry unavailable', warning: false };

  const remaining = expiry - now;
  if (remaining <= 0) return { label: 'Expired', warning: true };

  return {
    label: `Expires in ${Math.ceil(remaining / HOUR_MS)} h`,
    warning: remaining < 12 * HOUR_MS,
  };
}

export function formatSubmissionClaimItems(items = [], submission = {}) {
  return items.map((item, index) => {
    const position = item.position ?? item.claimPosition ?? item.displayOrder ?? index;
    return {
      kind: item.kind || (item.isReuse ? 'reuse' : 'new'),
      id: Number(item.id),
      submission_id: Number(item.submission_id ?? submission.id),
      submission_uuid: item.submission_uuid || submission.uuid,
      course_code: item.course_code || submission.courseCode,
      section: item.section ?? submission.section ?? '',
      term_code: item.term_code || submission.term,
      title: item.title,
      material_type: item.material_type || item.materialType,
      position: Number(position),
      status: item.status,
      claimed_by: item.claimedByUsername || item.claimed_by || item.claimedBy?.username || null,
      claimed_by_display: item.claimedByDisplay || item.claimed_by_display || item.claimedBy?.display_name || null,
      claimed_at: item.claimedAt || item.claimed_at || null,
      last_activity_at: item.lastActivityAt || item.last_activity_at || null,
      expires_at: item.expiresAt || item.expires_at || null,
      assigned_group: item.assignedGroup || item.assigned_group || null,
    };
  }).sort((left, right) => left.position - right.position);
}

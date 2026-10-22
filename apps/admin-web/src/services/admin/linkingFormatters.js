// Candidate field booleans come from the API's normalized match rule.
export function getCandidateFieldMatches(submission, candidate) {
  const fields = candidate?.fields || {};
  const courseNumber = Boolean(fields.course_number);
  const section = Boolean(fields.section);
  const term = submission?.rosterTermId ? Boolean(fields.term) : null;

  return { courseNumber, section, term };
}

export function formatWaitingTime(waitingHours) {
  const hours = Math.max(0, Number(waitingHours) || 0);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} waiting`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} waiting`;
}

export function formatCheckedAt(value) {
  if (!value) return 'Not checked';
  return `Last checked ${new Date(value).toLocaleString()}`;
}

export function getLinkingErrorMessage(error, action) {
  const payload = error?.payload;
  const code = payload?.error_code;

  if (code === 'folio_unavailable') {
    return [
      'FOLIO is temporarily unavailable. Try again in a moment.',
      payload.reference && `Reference: ${payload.reference}`,
    ].filter(Boolean).join(' ');
  }

  if (code === 'not_exact_match') {
    const fields = payload.fields || {};
    const names = [
      ['course_number', 'Course number'],
      ['section', 'Section'],
      ['term', 'Term'],
    ].filter(([field]) => fields[field] === false).map(([, name]) => name);
    return names.length
      ? `Cannot link: ${names.join(', ')} did not match. Re-check the FOLIO course or correct the submission.`
      : 'Cannot link because the FOLIO course is not an exact match.';
  }

  if (code === 'already_linked') {
    const linkedBy = payload.linked_by || 'another staff member';
    const correction = action === 'correct' ? ' Unlink first before correcting this submission.' : '';
    return `This submission is already linked by ${linkedBy}.${correction}`;
  }

  if (code === 'items_published') {
    return 'This submission cannot be unlinked after items have been published.';
  }

  return error?.message || 'The request could not be completed. Check your connection and try again.';
}

export function submissionHasPublishedItems(items) {
  return items.some((item) => Boolean(item.materializedAt) || item.status === 'available_online');
}

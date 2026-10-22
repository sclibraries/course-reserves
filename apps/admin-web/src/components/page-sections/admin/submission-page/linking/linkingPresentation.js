export function getCandidateMatchLabel(candidate, matches) {
  if (candidate.match === 'exact' && matches.courseNumber && matches.section && matches.term === true) return 'Exact match';
  if (!matches.courseNumber) return 'Course differs';
  if (!matches.section) return 'Section differs';
  if (matches.term === false) return 'Term differs';
  if (matches.term === null) return 'Term unverified';
  return 'Possible match';
}

export function formatCheckedRelative(value) {
  if (!value) return 'Not checked yet';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Checked just now';
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const [unit, size] = units.find(([, secondsPerUnit]) => seconds >= secondsPerUnit);
  const count = Math.floor(seconds / size);
  return `Checked ${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

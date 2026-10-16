import PropTypes from 'prop-types';
import { getCandidateFieldMatches } from '../../../../services/admin/linkingFormatters';

const fieldRows = [
  { key: 'courseNumber', label: 'Course number', rosterKey: 'courseCode' },
  { key: 'section', label: 'Section', rosterKey: 'section' },
  { key: 'term', label: 'Term', rosterKey: 'term' },
];

function candidateValue(candidate, key) {
  if (key === 'courseNumber') return candidate.courses?.map((course) => course.courseNumber).filter(Boolean).join(', ') || '—';
  if (key === 'section') return candidate.courses?.map((course) => course.sectionName).filter(Boolean).join(', ') || '—';
  return candidate.term?.name || candidate.term?.id || '—';
}

function LinkingComparison({ submission, candidate }) {
  const matches = getCandidateFieldMatches(submission, candidate);

  return (
    <div className="linking-comparison" aria-label="Roster and FOLIO course comparison">
      <div className="linking-comparison-heading"><strong>Roster request</strong><strong>FOLIO course</strong></div>
      {fieldRows.map(({ key, label, rosterKey }) => {
        const verified = matches[key];
        const marker = verified === null ? 'Term unverified' : `${label} ${verified ? '✓' : '×'}`;
        return (
          <div className="linking-comparison-row" key={key}>
            <span><strong>{label}</strong><span>{submission[rosterKey] || '—'}</span></span>
            <span><strong>{candidateValue(candidate, key)}</strong><span aria-label={marker}>{marker}</span></span>
          </div>
        );
      })}
    </div>
  );
}

LinkingComparison.propTypes = {
  submission: PropTypes.object.isRequired,
  candidate: PropTypes.object.isRequired,
};

export default LinkingComparison;

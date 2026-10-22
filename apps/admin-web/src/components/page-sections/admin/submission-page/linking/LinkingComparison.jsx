import PropTypes from 'prop-types';
import { getCandidateFieldMatches } from '../../../../../services/admin/linkingFormatters';

const rows = [
  {
    key: 'courseNumber',
    label: 'Course',
    submissionValue: (submission) => submission.courseCode || '—',
    candidateValue: (candidate) => candidate.courses?.map((course) => course.courseNumber).filter(Boolean).join(', ') || '—',
  },
  {
    key: 'section',
    label: 'Section',
    submissionValue: (submission) => submission.section || '—',
    candidateValue: (candidate) => candidate.courses?.map((course) => course.sectionName).filter(Boolean).join(', ') || '—',
  },
  {
    key: 'term',
    label: 'Term',
    submissionValue: (submission) => submission.termCode || submission.term || 'Term unverified',
    candidateValue: (candidate) => candidate.term?.name || candidate.term?.id || '—',
  },
];

function MatchStatus({ verified }) {
  return (
    <span className="tw-block tw-text-xs tw-text-muted-foreground">
      {verified === null ? 'Term unverified' : verified ? '✓ Match' : '× Does not match'}
    </span>
  );
}

MatchStatus.propTypes = { verified: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf([null])]).isRequired };

function LinkingComparison({ submission, candidate }) {
  const matches = getCandidateFieldMatches(submission, candidate);

  return (
    <div className="tw-min-w-0 tw-overflow-hidden tw-rounded-md tw-border" aria-label="Submission and FOLIO course comparison">
      <table className="tw-w-full tw-table-fixed tw-text-left tw-text-xs">
        <thead className="tw-bg-muted/50">
          <tr>
            <th scope="col" className="tw-w-[26%] tw-p-1.5 tw-font-medium">Field</th>
            <th scope="col" className="tw-p-1.5 tw-font-medium">Submission</th>
            <th scope="col" className="tw-p-1.5 tw-font-medium">FOLIO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const verified = matches[row.key];
            return (
              <tr key={row.key} className="tw-border-t">
                <th scope="row" className="tw-break-words tw-p-1.5 tw-align-top tw-font-medium">{row.label}</th>
                <td className="tw-break-words tw-p-1.5 tw-align-top">{row.submissionValue(submission)}</td>
                <td className="tw-break-words tw-p-1.5 tw-align-top">
                  {row.candidateValue(candidate)}
                  <MatchStatus verified={verified} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

LinkingComparison.propTypes = {
  submission: PropTypes.object.isRequired,
  candidate: PropTypes.object.isRequired,
};

export default LinkingComparison;

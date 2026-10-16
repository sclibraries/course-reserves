import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Badge, Button, Spinner, Table } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import { submissionWorkflowService } from '../../../../services/admin/submissionWorkflowService';
import { formatCheckedAt, formatWaitingTime } from '../../../../services/admin/linkingFormatters';
import './linking.css';

const suggestionLabels = {
  exact: { label: 'Exact match', color: 'success' },
  possible: { label: 'Possible match', color: 'warning' },
  none: { label: 'Not in FOLIO yet', color: 'secondary' },
};

function SuggestionBadge({ suggestion }) {
  const result = suggestionLabels[suggestion] || { label: 'Not checked', color: 'light' };
  return <Badge color={result.color}>{result.label}</Badge>;
}

SuggestionBadge.propTypes = { suggestion: PropTypes.string };

function NeedsLinkingList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await submissionWorkflowService.getNeedsLinking(1);
      setItems(result.items || []);
      setCount(result.count ?? result.items?.length ?? 0);
    } catch (requestError) {
      setError(requestError.message || 'Failed to load submissions needing a course link.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const oldestFirst = [...items].sort((left, right) => {
    const waitingDifference = Number(right.waiting_hours || 0) - Number(left.waiting_hours || 0);
    if (waitingDifference !== 0) return waitingDifference;
    return new Date(left.submitted_at || 0) - new Date(right.submitted_at || 0);
  });

  return (
    <section className="needs-linking-list" aria-labelledby="needs-linking-title">
      <div className="d-flex align-items-start justify-content-between mb-3">
        <div>
          <h1 id="needs-linking-title" className="h3 mb-1">Needs linking</h1>
          <p className="text-muted mb-0">{count} submission{count === 1 ? '' : 's'} waiting for a FOLIO course link</p>
        </div>
        <Button color="outline-primary" onClick={loadItems} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && <Alert color="danger" role="alert">{error}</Alert>}
      {loading && <div className="text-center py-5"><Spinner /><p className="mt-2">Loading submissions...</p></div>}
      {!loading && !error && oldestFirst.length === 0 && (
        <Alert color="success">All submitted courses are linked.</Alert>
      )}
      {!loading && oldestFirst.length > 0 && (
        <div className="table-responsive">
          <Table hover className="needs-linking-table">
            <thead>
              <tr><th>Faculty</th><th>Course</th><th>Term</th><th>Waiting</th><th>Suggestion</th><th>Last checked</th></tr>
            </thead>
            <tbody>
              {oldestFirst.map((item) => {
                const hasSubmissionId = Number.isInteger(item.submission_id);
                return (
                  <tr
                    key={item.submission_uuid}
                    data-submission-uuid={item.submission_uuid}
                    role={hasSubmissionId ? 'link' : undefined}
                    tabIndex={hasSubmissionId ? 0 : undefined}
                    aria-label={hasSubmissionId
                      ? `Open submission for ${item.faculty_display_name || 'faculty member'}`
                      : undefined}
                    onClick={hasSubmissionId
                      ? () => navigate(`/admin/submissions/${item.submission_id}`)
                      : undefined}
                    onKeyDown={hasSubmissionId
                      ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/admin/submissions/${item.submission_id}`);
                        }
                      }
                      : undefined}
                  >
                    <td>
                      <span className="text-primary text-decoration-underline">{item.faculty_display_name || 'Faculty member'}</span>
                    </td>
                    <td>
                      <strong>{item.course_code}</strong>{item.section ? `-${item.section}` : ''}
                      {item.course_title && <small className="d-block text-muted">{item.course_title}</small>}
                    </td>
                    <td>{item.term_code || 'Term unverified'}</td>
                    <td>{formatWaitingTime(item.waiting_hours)}</td>
                    <td><SuggestionBadge suggestion={item.suggestion} /></td>
                    <td>{formatCheckedAt(item.checked_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  );
}

export default NeedsLinkingList;

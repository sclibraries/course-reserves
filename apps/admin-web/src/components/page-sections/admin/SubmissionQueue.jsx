/**
 * @file SubmissionQueue.jsx
 * @description Component for displaying the queue of pending faculty submissions
 */

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, FormGroup, Input, Label, Spinner, Table } from 'reactstrap';
import { FaLock, FaEye, FaComments } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import useSubmissionWorkflowStore from '../../../store/submissionWorkflowStore';
import SubmissionStatusBadge from './submission/shared/SubmissionStatusBadge';
import { PriorityIndicator, ProgressBar } from './submission/queue/SubmissionQueueDisplay';
import SubmissionQueuePagination from './submission/queue/SubmissionQueuePagination';
import { formatSubmissionQueueDate } from './submission/queue/submissionQueueFormatters';
import '../../../css/SubmissionWorkflow.css';

/**
 * Main submission queue component
 */
function SubmissionQueue() {
  const navigate = useNavigate();
  const [showDrafts, setShowDrafts] = useState(true);
  const {
    submissions,
    loading,
    error,
    pagination,
    fetchPendingSubmissions,
    setPage,
    clearError
  } = useSubmissionWorkflowStore();
  const visibleSubmissions = showDrafts
    ? submissions
    : submissions.filter((submission) => submission.status !== 'draft');

  // Load submissions on mount
  useEffect(() => {
    fetchPendingSubmissions(1, 20);
  }, [fetchPendingSubmissions]);

  const handleViewSubmission = (submissionId) => {
    navigate(`/admin/submissions/${submissionId}`);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  return (
    <div className="submission-queue">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="h4 mb-1">Faculty Submissions</h2>
          <p className="text-muted mb-0">
            {pagination.totalCount} total submission{pagination.totalCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <FormGroup check className="mb-3">
        <Input
          id="show-drafts"
          name="show-drafts"
          type="checkbox"
          checked={showDrafts}
          onChange={(event) => setShowDrafts(event.target.checked)}
        />
        <Label check for="show-drafts">Show drafts</Label>
      </FormGroup>

      {/* Error Alert */}
      {error && (
        <Alert color="danger" toggle={clearError} className="mb-3">
          <strong>Error:</strong> {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-5">
          <Spinner color="primary" />
          <p className="mt-2 text-muted">Loading submissions...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && visibleSubmissions.length === 0 && (
        <Alert color="info">
          <h5 className="alert-heading">No Submissions Found</h5>
          <p className="mb-0">{showDrafts ? 'There are currently no pending faculty submissions to process.' : 'No submissions match the current filter.'}</p>
        </Alert>
      )}

      {/* Submissions Table */}
      {!loading && visibleSubmissions.length > 0 && (
        <>
          <div className="table-responsive">
            <Table hover className="submissions-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Course</th>
                  <th>Faculty</th>
                  <th>Term</th>
                  <th>Submitted</th>
                  <th>Items</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleSubmissions.map((sub) => (
                  <tr key={sub.submissionId} className={sub.isLocked ? 'locked-row' : ''}>
                    <td>
                      <PriorityIndicator priority={sub.priority} />
                    </td>
                    <td>
                      <div>
                        <strong>{sub.courseCode}</strong>
                        {sub.section && <span className="text-muted"> - {sub.section}</span>}
                      </div>
                      <div className="text-sm text-muted">{sub.courseTitle}</div>
                    </td>
                    <td>{sub.facultyName}</td>
                    <td>{sub.term}</td>
                    <td>
                      {sub.submittedAt ? (
                        <span title={new Date(sub.submittedAt).toLocaleString()}>
                          {formatSubmissionQueueDate(sub.submittedAt)}
                        </span>
                      ) : 'Not submitted'}
                    </td>
                    <td>
                      <Badge color="secondary" pill>
                        {sub.totalItems}
                      </Badge>
                    </td>
                    <td style={{ minWidth: '150px' }}>
                      <ProgressBar 
                        percentage={sub.completionPercentage}
                        completeItems={sub.completeItems}
                        totalItems={sub.totalItems}
                      />
                    </td>
                    <td>
                      <SubmissionStatusBadge status={sub.status} />
                    </td>
                    <td>
                      {sub.assignedTo ? (
                        <span>{sub.assignedTo}</span>
                      ) : (
                        <span className="text-muted">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <div className="d-flex gap-2 align-items-center">
                        <Button
                          size="sm"
                          color="primary"
                          onClick={() => handleViewSubmission(sub.submissionId)}
                        >
                          <FaEye className="me-1" />
                          View
                        </Button>
                        {sub.isLocked && (
                          <FaLock 
                            className="text-warning" 
                            title={`Locked by ${sub.lockedBy || 'staff'}`}
                          />
                        )}
                        {sub.communicationsCount > 0 && (
                          <span className="position-relative">
                            <FaComments 
                              className="text-info" 
                              title={`${sub.communicationsCount} message(s)`}
                            />
                            {sub.unreadCommunications > 0 && (
                              <Badge 
                                color="danger" 
                                pill 
                                className="position-absolute top-0 start-100 translate-middle"
                                style={{ fontSize: '0.6rem', padding: '0.15rem 0.35rem' }}
                              >
                                {sub.unreadCommunications}
                              </Badge>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.pageCount > 1 && (
            <SubmissionQueuePagination pagination={pagination} onPageChange={handlePageChange} />
          )}
        </>
      )}
    </div>
  );
}

export default SubmissionQueue;

/**
 * @file SubmissionQueue.jsx
 * @description Component for displaying the queue of pending faculty submissions
 */

import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { 
  Table, 
  Badge, 
  Button, 
  Spinner, 
  Alert,
  Progress,
  Pagination,
  PaginationItem,
  PaginationLink
} from 'reactstrap';
import { FaLock, FaEye, FaClock, FaExclamationTriangle, FaComments } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import useSubmissionWorkflowStore from '../../../store/submissionWorkflowStore';
import '../../../css/SubmissionWorkflow.css';

/**
 * Format date for display (e.g., "2 days ago")
 */
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
};

/**
 * Status badge component
 */
const StatusBadge = ({ status }) => {
  const statusConfig = {
    submitted: { color: 'info', text: 'Submitted' },
    in_progress: { color: 'warning', text: 'In Progress' },
    complete: { color: 'success', text: 'Complete' },
    unavailable: { color: 'danger', text: 'Unavailable' }
  };
  
  const config = statusConfig[status] || { color: 'secondary', text: status };
  
  return <Badge color={config.color}>{config.text}</Badge>;
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired
};

/**
 * Priority indicator component
 */
const PriorityIndicator = ({ priority }) => {
  const priorityConfig = {
    urgent: { color: 'danger', icon: FaExclamationTriangle, text: 'Urgent' },
    high: { color: 'warning', icon: FaClock, text: 'High' },
    normal: { color: 'secondary', icon: null, text: 'Normal' }
  };
  
  const config = priorityConfig[priority] || priorityConfig.normal;
  const Icon = config.icon;
  
  return (
    <span className={`priority-indicator priority-${priority}`}>
      {Icon && <Icon className="me-1" />}
      {config.text}
    </span>
  );
};

PriorityIndicator.propTypes = {
  priority: PropTypes.oneOf(['urgent', 'high', 'normal']).isRequired
};

/**
 * Progress bar component
 */
const ProgressBar = ({ percentage, completeItems, totalItems }) => {
  return (
    <div className="progress-wrapper">
      <Progress value={percentage} color={percentage === 100 ? 'success' : 'primary'}>
        {percentage}%
      </Progress>
      <small className="text-muted">{completeItems}/{totalItems}</small>
    </div>
  );
};

ProgressBar.propTypes = {
  percentage: PropTypes.number.isRequired,
  completeItems: PropTypes.number.isRequired,
  totalItems: PropTypes.number.isRequired
};

/**
 * Main submission queue component
 */
function SubmissionQueue() {
  const navigate = useNavigate();
  const {
    submissions,
    loading,
    error,
    pagination,
    fetchPendingSubmissions,
    setPage,
    clearError
  } = useSubmissionWorkflowStore();

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

  // Generate pagination items
  const renderPaginationItems = () => {
    const items = [];
    const { currentPage, pageCount } = pagination;
    
    for (let i = 1; i <= pageCount; i++) {
      // Show first, last, current, and adjacent pages
      if (
        i === 1 ||
        i === pageCount ||
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        items.push(
          <PaginationItem key={i} active={i === currentPage}>
            <PaginationLink onClick={() => handlePageChange(i)}>
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      } else if (
        i === currentPage - 2 ||
        i === currentPage + 2
      ) {
        items.push(
          <PaginationItem key={i} disabled>
            <PaginationLink>...</PaginationLink>
          </PaginationItem>
        );
      }
    }
    
    return items;
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
      {!loading && submissions.length === 0 && (
        <Alert color="info">
          <h5 className="alert-heading">No Submissions Found</h5>
          <p className="mb-0">There are currently no pending faculty submissions to process.</p>
        </Alert>
      )}

      {/* Submissions Table */}
      {!loading && submissions.length > 0 && (
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
                {submissions.map((sub) => (
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
                      <span title={new Date(sub.submittedAt).toLocaleString()}>
                        {formatDate(sub.submittedAt)}
                      </span>
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
                      <StatusBadge status={sub.status} />
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
            <div className="d-flex justify-content-center mt-4">
              <Pagination>
                <PaginationItem disabled={pagination.currentPage === 1}>
                  <PaginationLink 
                    previous 
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                  />
                </PaginationItem>
                
                {renderPaginationItems()}
                
                <PaginationItem disabled={pagination.currentPage === pagination.pageCount}>
                  <PaginationLink 
                    next 
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                  />
                </PaginationItem>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SubmissionQueue;

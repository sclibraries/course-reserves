/**
 * @file SubmissionDetail.jsx
 * @description Component for displaying detailed view of a single submission
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Alert, 
  Badge,
  Button,
  Card,
  CardBody,
  Spinner
} from 'reactstrap';
import { 
  FaLock, 
  FaUnlock, 
  FaArrowLeft, 
  FaFolder,
  FaBook,
  FaClock,
  FaCheckCircle,
  FaExclamationCircle,
  FaUser,
  FaHandPointRight,
  FaCog
} from 'react-icons/fa';
import useSubmissionWorkflowStore from '../../../store/submissionWorkflowStore';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import { toast } from 'react-toastify';
import '../../../css/SubmissionWorkflow.css';

/**
 * Statistics card component
 */
const StatCard = ({ label, value, color = 'primary', icon: Icon }) => (
  <div className="stat-card">
    <div className="stat-card-label">{label}</div>
    <div className={`stat-card-value text-${color}`}>
      {Icon && <Icon className="me-2" />}
      {value}
    </div>
  </div>
);

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string,
  icon: PropTypes.elementType
};

/**
 * Item card component for displaying individual resources (Browse Mode)
 */
const ItemCard = ({ 
  item, 
  displayNumber, 
  onClaim,
  onGoToWork,
  onReopen,
  currentUserId
}) => (
  <div className="item-card browse-mode">
    <div className="item-info">
      <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
        <div className="d-flex align-items-start gap-3 flex-grow-1">
          <div className="display-number">
            {displayNumber}
          </div>
          <div className="flex-grow-1">
            <div className="item-title">{item.title}</div>
          </div>
        </div>
        
        {/* Claim Status - READ ONLY */}
        <div>
          {!item.claimedBy ? (
            <Badge color="secondary">
              <FaClock className="me-1" />
              Unclaimed
            </Badge>
          ) : item.claimedBy.id === currentUserId ? (
            <Badge color="success">
              <FaUser className="me-1" />
              Claimed by You
            </Badge>
          ) : (
            <Badge color="info">
              <FaUser className="me-1" />
              {item.claimedBy.display_name || item.claimedBy.username}
            </Badge>
          )}
        </div>
      </div>
      
      {item.authors && <div className="item-authors">{item.authors}</div>}
      
      <div className="item-metadata">
        {item.barcode && (
          <span>
            <strong>Barcode:</strong> {item.barcode}
          </span>
        )}
        {item.callNumber && (
          <span>
            <strong>Call Number:</strong> {item.callNumber}
          </span>
        )}
        {item.url && (
          <span>
            <strong>URL:</strong>{' '}
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              Link
            </a>
          </span>
        )}
        <span>
          <strong>Type:</strong> {item.materialType}
        </span>
        {item.isReuse && (
          <Badge color="info" pill>Reuse</Badge>
        )}
      </div>
      
      {item.staffNotes && (
        <div className="mt-2 p-2 bg-light rounded">
          <small>
            <strong>Staff Notes:</strong> {item.staffNotes}
          </small>
        </div>
      )}
      
      {item.facultyNotes && (
        <div className="mt-2">
          <small className="text-muted">
            <strong>Faculty Notes:</strong> {item.facultyNotes}
          </small>
        </div>
      )}
      
      {item.hasCommunications && (
        <div className="mt-2">
          <Badge color="primary" className="me-2">
            {item.communications.length} message{item.communications.length !== 1 ? 's' : ''}
          </Badge>
          {item.unreadCommunications > 0 && (
            <Badge color="warning">
              {item.unreadCommunications} unread
            </Badge>
          )}
          <div className="mt-2">
            {item.communications.map(comm => (
              <div key={comm.id} className="communication-preview mb-2 p-2 border-start border-3">
                <div className="d-flex justify-content-between">
                  <strong>{comm.sender_name}</strong>
                  <small className="text-muted">
                    {new Date(comm.created_at).toLocaleString()}
                  </small>
                </div>
                {comm.subject && (
                  <div className="text-muted small">{comm.subject}</div>
                )}
                <div>{comm.message}</div>
                {!comm.is_read && (
                  <Badge color="warning" size="sm">Unread</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    
    <div className="item-actions browse-mode">
      <StatusBadge status={item.status} />
      <PriorityBadge priority={item.priority} />
      
      {/* Simple action based on status and claim status */}
      <div className="mt-2">
        {item.status === 'complete' ? (
          // Item is complete - show reopen button
          <div className="d-flex flex-column gap-2">
            <Badge color="success" className="w-100 p-2">
              <FaCheckCircle className="me-1" />
              Complete
            </Badge>
            <Button 
              color="warning" 
              size="sm" 
              outline
              onClick={() => onReopen(item.id)}
              className="w-100"
            >
              <FaExclamationCircle className="me-1" />
              Reopen for Processing
            </Button>
          </div>
        ) : !item.claimedBy ? (
          // Unclaimed and not complete - show claim button
          <Button 
            color="primary" 
            size="sm" 
            onClick={() => onClaim(item.id)}
            className="w-100"
          >
            <FaHandPointRight className="me-1" />
            Claim This Item
          </Button>
        ) : item.claimedBy.id === currentUserId ? (
          // Claimed by current user - show work button
          <Button 
            color="success" 
            size="sm" 
            onClick={() => onGoToWork(item.id)}
            className="w-100"
          >
            <FaCog className="me-1" />
            Work on This
          </Button>
        ) : (
          // Claimed by someone else
          <Badge color="secondary" className="w-100 p-2">
            Being handled by {item.claimedBy.display_name || item.claimedBy.username}
          </Badge>
        )}
      </div>
    </div>
  </div>
);

ItemCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    authors: PropTypes.string,
    barcode: PropTypes.string,
    callNumber: PropTypes.string,
    url: PropTypes.string,
    materialType: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    priority: PropTypes.string.isRequired,
    facultyNotes: PropTypes.string,
    staffNotes: PropTypes.string,
    isReuse: PropTypes.bool,
    hasCommunications: PropTypes.bool,
    communications: PropTypes.array,
    unreadCommunications: PropTypes.number,
    displayOrder: PropTypes.number,
    positionInFolder: PropTypes.number,
    claimedBy: PropTypes.shape({
      id: PropTypes.number,
      username: PropTypes.string,
      display_name: PropTypes.string
    })
  }).isRequired,
  displayNumber: PropTypes.string.isRequired,
  onClaim: PropTypes.func.isRequired,
  onGoToWork: PropTypes.func.isRequired,
  onReopen: PropTypes.func.isRequired,
  currentUserId: PropTypes.number.isRequired
};

/**
 * Status badge component
 */
const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending: { color: 'warning', text: 'Pending' },
    in_progress: { color: 'info', text: 'In Progress' },
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
 * Priority badge component
 */
const PriorityBadge = ({ priority }) => {
  const priorityConfig = {
    urgent: { color: 'danger', text: 'Urgent' },
    high: { color: 'warning', text: 'High' },
    medium: { color: 'info', text: 'Medium' },
    low: { color: 'secondary', text: 'Low' }
  };
  
  const config = priorityConfig[priority] || priorityConfig.medium;
  
  return (
    <Badge color={config.color} pill>
      {config.text}
    </Badge>
  );
};

PriorityBadge.propTypes = {
  priority: PropTypes.string.isRequired
};

/**
 * Main submission detail component
 */
function SubmissionDetail() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  
  const {
    selectedSubmission,
    loading,
    error,
    fetchSubmissionDetail,
    lockSubmission,
    unlockSubmission,
    clearError,
    claimItem,
    updateItemStatus
  } = useSubmissionWorkflowStore();

  const [currentUser, setCurrentUser] = useState(null);

  // Load submission detail on mount
  useEffect(() => {
    if (submissionId) {
      fetchSubmissionDetail(submissionId);
    }
  }, [submissionId, fetchSubmissionDetail]);
  
  // Load current user from backend (based on auth token)
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await submissionWorkflowService.getCurrentUser();
        console.log('Current user from backend:', user);
        console.log('User ID:', user.id, 'Type:', typeof user.id);
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load current user:', error);
        // Fallback to localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          console.log('Current user from localStorage (fallback):', user);
          setCurrentUser(user);
        }
      }
    };
    
    loadCurrentUser();
  }, []);

  const handleLockSubmission = async () => {
    if (selectedSubmission) {
      const result = await lockSubmission(
        selectedSubmission.submission.uuid,
        'Processing items'
      );
      if (result.success) {
        // Refresh the detail view
        await fetchSubmissionDetail(submissionId);
      }
    }
  };

  const handleUnlockSubmission = async () => {
    if (selectedSubmission) {
      const result = await unlockSubmission(selectedSubmission.submission.uuid);
      if (result.success) {
        // Refresh the detail view
        await fetchSubmissionDetail(submissionId);
      }
    }
  };
  
  const handleClaim = async (itemId) => {
    const result = await claimItem(itemId);
    if (result.success) {
      // Only show success toast and refresh if claim was actually successful
      toast.success(
        <div>
          Item claimed! 
          <button 
            onClick={() => navigate(`/admin?tab=my-work&item=${itemId}`)}
            style={{ marginLeft: '10px', textDecoration: 'underline', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
          >
            Go to My Work →
          </button>
        </div>,
        { autoClose: 5000 }
      );
      // Refresh the submission detail to show updated claim status
      await fetchSubmissionDetail(submissionId);
    } else {
      // Show the actual error message from the backend
      toast.error(result.error || 'Failed to claim item');
      // Still refresh to show current state
      await fetchSubmissionDetail(submissionId);
    }
  };
  
  const handleGoToWork = (itemId) => {
    // Navigate to My Work Queue tab with this item
    navigate(`/admin?tab=my-work&item=${itemId}`);
  };

  const handleReopen = async (itemId) => {
    if (confirm('Are you sure you want to reopen this item for processing? It will be moved back to "in progress" status.')) {
      const result = await updateItemStatus(itemId, 'in_progress');
      if (result.success) {
        toast.success('Item reopened for processing');
        // Refresh the submission detail to show updated status
        await fetchSubmissionDetail(submissionId);
      } else {
        toast.error(result.error || 'Failed to reopen item');
      }
    }
  };

  const handleBack = () => {
    navigate('/admin?tab=submissions');
  };

  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner color="primary" size="lg" />
        <p className="text-muted">Loading submission details...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="submission-detail">
        <Alert color="danger" toggle={clearError}>
          <h4 className="alert-heading">Error Loading Submission</h4>
          <p>{error}</p>
        </Alert>
        <Button color="secondary" onClick={handleBack}>
          <FaArrowLeft className="me-2" />
          Back to Queue
        </Button>
      </div>
    );
  }

  // No submission found
  if (!selectedSubmission) {
    return (
      <div className="submission-detail">
        <Alert color="warning">
          <h4 className="alert-heading">Submission Not Found</h4>
          <p>The requested submission could not be found.</p>
        </Alert>
        <Button color="secondary" onClick={handleBack}>
          <FaArrowLeft className="me-2" />
          Back to Queue
        </Button>
      </div>
    );
  }

  const { submission, folders, unfolderedItems, statistics } = selectedSubmission;

  // Calculate display numbers for all items
  let currentNumber = 1;
  const itemDisplayNumbers = {};
  
  // First, number all folders and their items
  folders.forEach((folder) => {
    const folderNumber = currentNumber;
    currentNumber++;
    
    folder.items.forEach((item, index) => {
      itemDisplayNumbers[item.id] = `${folderNumber}.${index + 1}`;
    });
  });
  
  // Then number unfoldered items
  unfolderedItems.forEach((item) => {
    itemDisplayNumbers[item.id] = `${currentNumber}`;
    currentNumber++;
  });

  return (
    <div className="submission-detail">
      {/* Back Button */}
      <Button color="link" onClick={handleBack} className="mb-3 ps-0">
        <FaArrowLeft className="me-2" />
        Back to Queue
      </Button>

      {/* Header */}
      <Card className="submission-header mb-4">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h1 className="h3 mb-2">
                {submission.courseCode}
                {submission.section && ` - ${submission.section}`}: {submission.courseTitle}
              </h1>
              <div className="submission-meta">
                <span>
                  <strong>Faculty:</strong> {submission.facultyName}
                </span>
                <span>
                  <strong>Term:</strong> {submission.term}
                </span>
                <span>
                  <strong>Submitted:</strong>{' '}
                  {new Date(submission.submittedAt).toLocaleDateString()}
                </span>
                <span>
                  <strong>Status:</strong> <StatusBadge status={submission.status} />
                </span>
              </div>
            </div>
          </div>

          {/* Lock Status */}
          {submission.isLocked && (
            <Alert color="warning" className="mb-3">
              <FaLock className="me-2" />
              This submission is currently locked
              {submission.lockedBy && ` by ${submission.lockedBy}`}
              {submission.lockedAt && 
                ` on ${new Date(submission.lockedAt).toLocaleString()}`}
              {submission.lockReason && (
                <div className="mt-1">
                  <small>Reason: {submission.lockReason}</small>
                </div>
              )}
            </Alert>
          )}

          {/* Actions */}
          <div className="submission-actions">
            {!submission.isLocked ? (
              <Button color="warning" onClick={handleLockSubmission}>
                <FaLock className="me-2" />
                Lock & Process
              </Button>
            ) : (
              <Button color="success" onClick={handleUnlockSubmission}>
                <FaUnlock className="me-2" />
                Unlock
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Statistics */}
      <div className="statistics mb-4">
        <StatCard 
          label="Total Items" 
          value={statistics.totalItems}
          icon={FaBook}
        />
        <StatCard 
          label="Pending" 
          value={statistics.byStatus.pending}
          color="warning"
          icon={FaClock}
        />
        <StatCard 
          label="In Progress" 
          value={statistics.byStatus.inProgress}
          color="info"
        />
        <StatCard 
          label="Complete" 
          value={statistics.byStatus.complete}
          color="success"
          icon={FaCheckCircle}
        />
        <StatCard 
          label="Unavailable" 
          value={statistics.byStatus.unavailable}
          color="danger"
          icon={FaExclamationCircle}
        />
        <StatCard 
          label="Progress" 
          value={`${statistics.completionPercentage}%`}
          color="primary"
        />
      </div>

      {/* Display Order Info */}
      <Alert color="info" className="mb-4">
        <small>
          <strong>Display Order Guide:</strong> Each item shows its position number (e.g., #0, #1, #2) 
          as submitted by faculty. Items in folders also show their position within that folder (Pos: 0, 1, 2).
        </small>
      </Alert>

      {/* Folders */}
      {folders.map((folder, folderIndex) => (
        <Card key={folder.name} className="folder-section mb-3">
          <CardBody>
            <div className="folder-header">
              <h3>
                <span className="folder-number">{folderIndex + 1}.</span>
                <FaFolder className="folder-icon ms-2" />
                {folder.name}
              </h3>
              <Badge color="secondary" pill>
                {folder.items.length} items
              </Badge>
            </div>
            <div className="item-list">
              {folder.items.map((item) => (
                <ItemCard 
                  key={item.id} 
                  item={item} 
                  displayNumber={itemDisplayNumbers[item.id]}
                  onClaim={handleClaim}
                  onGoToWork={handleGoToWork}
                  onReopen={handleReopen}
                  currentUserId={currentUser?.id || 0}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      ))}

      {/* Unfoldered Items */}
      {unfolderedItems.length > 0 && (
        <Card className="folder-section">
          <CardBody>
                        <div className="item-list">
              {unfolderedItems.map((item) => (
                <ItemCard 
                  key={item.id} 
                  item={item} 
                  displayNumber={itemDisplayNumbers[item.id]}
                  onClaim={handleClaim}
                  onGoToWork={handleGoToWork}
                  onReopen={handleReopen}
                  currentUserId={currentUser?.id || 0}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default SubmissionDetail;

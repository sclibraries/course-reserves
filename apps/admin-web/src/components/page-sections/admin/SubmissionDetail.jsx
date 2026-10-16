/**
 * @file SubmissionDetail.jsx
 * @description Component for displaying detailed view of a single submission
 */

import { useEffect, useState } from 'react';
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
  FaArrowLeft, 
  FaFolder,
  FaBook,
  FaClock,
  FaCheckCircle,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// Stores & Services
import useSubmissionWorkflowStore from '../../../store/submissionWorkflowStore';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import { buildProcessingHandoff, getProcessingBlockReason } from '../../../services/admin/processingHandoff';

// Styles
import '../../../css/SubmissionWorkflow.css';

// Components
import SubmissionHeader from './submission/SubmissionHeader';
import LinkingPanel from './linking/LinkingPanel';
import ItemCard from './submission/ItemCard';
import StatCard from './submission/shared/StatCard';

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


  // --- Load Data ---

  useEffect(() => {
    if (submissionId) {
      fetchSubmissionDetail(submissionId);
    }
  }, [submissionId, fetchSubmissionDetail]);
  
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await submissionWorkflowService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load current user:', error);
        const userStr = localStorage.getItem('user');
        if (userStr) setCurrentUser(JSON.parse(userStr));
      }
    };
    loadCurrentUser();
  }, []);



  // --- Submission Actions ---

  const handleLock = async () => {
    if (selectedSubmission) {
      const result = await lockSubmission(selectedSubmission.submission.uuid, 'Processing items');
      if (result.success) await fetchSubmissionDetail(submissionId);
    }
  };

  const handleUnlock = async () => {
    if (selectedSubmission) {
      const result = await unlockSubmission(selectedSubmission.submission.uuid);
      if (result.success) await fetchSubmissionDetail(submissionId);
    }
  };
  
  const handleClaim = async (itemId) => {
    const result = await claimItem(itemId);
    if (result.success) {
      toast.success('Item claimed!');
      await fetchSubmissionDetail(submissionId);
    } else {
      toast.error(result.error || 'Failed to claim item');
      await fetchSubmissionDetail(submissionId);
    }
  };
  
  const handleGoToWork = (item) => {
    const handoff = buildProcessingHandoff(item);

    if (!handoff) {
      toast.error(getProcessingBlockReason(item));
      return;
    }

    navigate(handoff.pathname, { state: handoff.state });
  };

  const handleReopen = async (itemId) => {
    if (confirm('Are you sure you want to reopen this item for processing?')) {
      const result = await updateItemStatus(itemId, 'in_progress');
      if (result.success) {
        toast.success('Item reopened');
        await fetchSubmissionDetail(submissionId);
      } else {
        toast.error(result.error || 'Failed to reopen item');
      }
    }
  };

  // --- Inline Component: Workflow Checklist ---
  // TODO: Extract this to src/components/page-sections/admin/submission/WorkflowChecklist.jsx


  // --- Render ---

  if (loading) {
    return (
      <div className="loading-container">
        <Spinner color="primary" size="lg" />
        <p className="text-muted">Loading submission details...</p>
      </div>
    );
  }

  if (error || !selectedSubmission) {
    return (
      <div className="submission-detail">
        <Alert color={error ? 'danger' : 'warning'} toggle={clearError}>
          <h4 className="alert-heading">{error ? 'Error' : 'Not Found'}</h4>
          <p>{error || 'The requested submission could not be found.'}</p>
        </Alert>
        <Button color="secondary" onClick={() => navigate('/admin?tab=submissions')}>
          <FaArrowLeft className="me-2" /> Back to Queue
        </Button>
      </div>
    );
  }

  const { submission, folders, unfolderedItems, statistics } = selectedSubmission;
  const isCourseLinked = submission.linkState === 'linked' || Boolean(submission.folioCourseListingId);
  const submissionItems = [...folders.flatMap(folder => folder.items), ...unfolderedItems];

  // Helper for numbering items
  let currentNumber = 1;
  const itemDisplayNumbers = {};
  folders.forEach(folder => {
    const fNum = currentNumber++;
    folder.items.forEach((item, idx) => itemDisplayNumbers[item.id] = `${fNum}.${idx + 1}`);
  });
  unfolderedItems.forEach(item => itemDisplayNumbers[item.id] = `${currentNumber++}`);

  return (
    <div className="submission-detail">
      <Button color="link" onClick={() => navigate('/admin?tab=submissions')} className="mb-3 ps-0">
        <FaArrowLeft className="me-2" /> Back to Queue
      </Button>

      <SubmissionHeader 
        submission={submission} 
        onLock={handleLock} 
        onUnlock={handleUnlock} 
      />

      <LinkingPanel
        submission={submission}
        items={submissionItems}
        onChanged={() => fetchSubmissionDetail(submissionId)}
      />

      {/* Course processing dashboard is available only after linking. */}
      {isCourseLinked && (
        <>


          <div className="statistics mb-4">
            <StatCard label="Total Items" value={statistics.totalItems} icon={FaBook} />
            <StatCard label="Pending" value={statistics.byStatus.pending} color="warning" icon={FaClock} />
            <StatCard label="In Progress" value={statistics.byStatus.inProgress} color="info" />
            <StatCard label="Complete" value={statistics.byStatus.complete} color="success" icon={FaCheckCircle} />
            <StatCard label="Progress" value={`${statistics.completionPercentage}%`} color="primary" />
          </div>

          {folders.map((folder, idx) => (
            <Card key={folder.name} className="folder-section mb-3">
              <CardBody>
                <div className="folder-header">
                  <h3><span className="folder-number">{idx + 1}.</span> <FaFolder className="ms-2"/> {folder.name}</h3>
                  <Badge pill>{folder.items.length} items</Badge>
                </div>
                <div className="item-list">
                  {folder.items.map(item => (
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

          {unfolderedItems.length > 0 && (
            <Card className="folder-section">
              <CardBody>
                <div className="item-list">
                  {unfolderedItems.map(item => (
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
        </>
      )}
    </div>
  );
}

export default SubmissionDetail;

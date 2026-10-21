import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Button, Spinner } from 'reactstrap';
import { toast } from 'react-toastify';
import useSubmissionWorkflowStore from '../../../store/submissionWorkflowStore';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import { buildProcessingHandoff, getProcessingBlockReason } from '../../../services/admin/processingHandoff';
import { Button as UiButton } from '../../ui/button';
import ClaimItemCard from './claims/ClaimItemCard';
import LinkingPanel from './linking/LinkingPanel';
import DraftSubmissionView from './submission/DraftSubmissionView';
import SubmissionPage from './submission-page/SubmissionPage';
import { isItemClaimedByCurrentUser } from './submission-page/submissionPageUtils';
import '../../../css/SubmissionWorkflow.css';

const submissionQueuePath = '/admin?tab=submissions';

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
  } = useSubmissionWorkflowStore();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (submissionId) fetchSubmissionDetail(submissionId);
  }, [submissionId, fetchSubmissionDetail]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        setCurrentUser(await submissionWorkflowService.getCurrentUser());
      } catch (userError) {
        console.error('Failed to load current user:', userError);
        const savedUser = localStorage.getItem('user');
        if (savedUser) setCurrentUser(JSON.parse(savedUser));
      }
    };
    loadCurrentUser();
  }, []);

  const refreshSubmission = () => fetchSubmissionDetail(submissionId);
  const handleLock = async () => {
    if (selectedSubmission) {
      const result = await lockSubmission(selectedSubmission.submission.uuid, 'Processing items');
      if (result.success) await refreshSubmission();
    }
  };
  const handleUnlock = async () => {
    if (selectedSubmission) {
      const result = await unlockSubmission(selectedSubmission.submission.uuid);
      if (result.success) await refreshSubmission();
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
        <Button color="secondary" onClick={() => navigate(submissionQueuePath)}>Back to Queue</Button>
      </div>
    );
  }

  const { submission, folders, unfolderedItems } = selectedSubmission;
  const items = [...folders.flatMap((folder) => folder.items), ...unfolderedItems];
  const currentUsername = currentUser?.username || currentUser?.user?.username || '';
  if (submission.status === 'draft') {
    return <DraftSubmissionView submission={submission} items={items} onBack={() => navigate(submissionQueuePath)} />;
  }

  return (
    <div className="submission-detail">
      <SubmissionPage
        submission={submission}
        folders={folders}
        unfolderedItems={unfolderedItems}
        currentUser={currentUser}
        onBack={() => navigate(submissionQueuePath)}
        onLock={handleLock}
        onUnlock={handleUnlock}
        onChanged={refreshSubmission}
        unlinkedContent={<LinkingPanel submission={submission} items={items} onChanged={refreshSubmission} />}
        renderSelectedItem={(item) => {
          const canWork = isItemClaimedByCurrentUser(item, currentUser);
          const blockedReason = getProcessingBlockReason(item);
          return (
            <div className="tw-space-y-3">
              {canWork && (blockedReason ? (
                <p className="tw-text-sm tw-text-muted-foreground">{blockedReason}</p>
              ) : (
                <UiButton variant="outline" size="sm" onClick={() => handleGoToWork(item)}>Work on This</UiButton>
              ))}
              <ClaimItemCard item={item} currentUsername={currentUsername} onChanged={refreshSubmission} />
            </div>
          );
        }}
      />
    </div>
  );
}

export default SubmissionDetail;

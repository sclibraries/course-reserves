import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import useSubmissionWorkflowStore from '../../../store/submissionWorkflowStore';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import { buildProcessingHandoff, getProcessingBlockReason } from '../../../services/admin/processingHandoff';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { Button } from '../../ui/button';
import useSubmissionLinking from '../../../hooks/admin/useSubmissionLinking';
import ClaimItemCard from './claims/ClaimItemCard';
import DraftSubmissionView from './submission/DraftSubmissionView';
import ItemCard from './submission/ItemCard';
import SubmissionPage from './submission-page/SubmissionPage';
import LinkingStep from './submission-page/linking/LinkingStep';
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
    updateItemStatus,
  } = useSubmissionWorkflowStore();
  const [currentUser, setCurrentUser] = useState(null);

  const refreshSubmission = useCallback(() => fetchSubmissionDetail(submissionId), [fetchSubmissionDetail, submissionId]);
  const submission = selectedSubmission?.submission;
  const folders = selectedSubmission?.folders || [];
  const unfolderedItems = selectedSubmission?.unfolderedItems || [];
  const items = [...folders.flatMap((folder) => folder.items), ...unfolderedItems];
  const linking = useSubmissionLinking(submission?.status === 'draft' ? null : submission, items, refreshSubmission);

  useEffect(() => {
    if (submissionId) fetchSubmissionDetail(submissionId);
  }, [submissionId, fetchSubmissionDetail]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        setCurrentUser(await submissionWorkflowService.getCurrentUser());
      } catch (userError) {
        console.error('Failed to load current user:', userError);
      }
    };
    loadCurrentUser();
  }, []);

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
  const handleReopen = async (itemId) => {
    if (confirm('Are you sure you want to reopen this item for processing?')) {
      const result = await updateItemStatus(itemId, 'in_progress');
      if (result.success) {
        toast.success('Item reopened');
        await refreshSubmission();
      } else {
        toast.error(result.error || 'Failed to reopen item');
      }
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
      <div className="tw-flex tw-items-center tw-gap-3 tw-py-8" role="status">
        <Loader2 className="tw-size-6 tw-animate-spin tw-text-primary" aria-hidden="true" />
        <span className="tw-text-muted-foreground">Loading submission details...</span>
      </div>
    );
  }

  if (error || !selectedSubmission) {
    return (
      <div className="tw-py-4">
        <Alert variant={error ? 'destructive' : 'default'} className="tw-mb-4">
          <AlertTitle className="tw-pr-8">{error ? 'Error' : 'Not Found'}</AlertTitle>
          <AlertDescription className="tw-pr-8">{error || 'The requested submission could not be found.'}</AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="tw-absolute tw-right-2 tw-top-2"
            aria-label="Dismiss message"
            onClick={clearError}
          >
            <X aria-hidden="true" />
          </Button>
        </Alert>
        <Button variant="outline" onClick={() => navigate(submissionQueuePath)}>Back to Queue</Button>
      </div>
    );
  }

  const currentUsername = currentUser?.username || '';
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
        linking={linking}
        unlinkedContent={<LinkingStep submission={submission} linking={linking} />}
        renderSelectedItem={(item) => {
          return (
            <div className="tw-space-y-3">
              <ClaimItemCard item={item} currentUsername={currentUsername} onChanged={refreshSubmission} />
              <ItemCard
                item={item}
                displayNumber={String(item.displayOrder)}
                onGoToWork={handleGoToWork}
                onReopen={handleReopen}
                currentUsername={currentUsername}
              />
            </div>
          );
        }}
      />
    </div>
  );
}

export default SubmissionDetail;

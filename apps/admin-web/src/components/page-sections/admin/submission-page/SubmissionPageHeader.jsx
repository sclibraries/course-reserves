import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import ChangeLinkedCourseDialog from './linking/ChangeLinkedCourseDialog';
import SubmissionActivitySheet from './linking/SubmissionActivitySheet';
import SubmissionSyllabusSheet from './SubmissionSyllabusSheet';

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Not submitted';
}

function formatLockNotice(submission) {
  return [
    submission.lockedBy && `Locked by ${submission.lockedBy}`,
    submission.lockedAt && new Date(submission.lockedAt).toLocaleString(),
    submission.lockReason && `Reason: ${submission.lockReason}`,
  ].filter(Boolean).join(' · ') || 'This submission is locked.';
}

function SubmissionPageHeader({ submission, counts, isLinked, onBack, onLock, onUnlock, linking }) {
  const [changeOpen, setChangeOpen] = useState(false);
  const changeTriggerRef = useRef(null);
  const course = `${submission.courseCode || 'Course'}${submission.section ? `-${submission.section}` : ''}`;
  const handleChangeOpen = (open) => {
    setChangeOpen(open);
    linking.clearError();
  };

  return (
    <header className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-gap-x-3 tw-gap-y-2 tw-rounded-lg tw-border tw-bg-card tw-p-3">
      <Button type="button" variant="ghost" size="icon" className="tw-h-8 tw-w-8 tw-shrink-0" aria-label="Back to Queue" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
      </Button>
      <div className="tw-flex tw-min-w-0 tw-flex-1 tw-flex-wrap tw-items-center tw-gap-x-3 tw-gap-y-1">
        <h1 className="tw-min-w-0 tw-break-words tw-text-lg tw-font-semibold">
          {course} · {submission.courseTitle || 'Untitled course'}
        </h1>
        <p className="tw-break-words tw-text-sm tw-text-muted-foreground">
          {[submission.term, submission.facultyName, formatDate(submission.submittedAt)].filter(Boolean).join(' · ')}
        </p>
        {isLinked ? (
          <Badge variant="secondary">Linked to FOLIO {course}</Badge>
        ) : (
          <Badge variant="outline">Needs linking</Badge>
        )}
        <Badge variant="outline" role="status" aria-label="Submission readiness">
          {counts.ready}/{counts.total} ready
        </Badge>
        {submission.isLocked && (
          <p role="status" className="tw-mt-1 tw-break-words tw-text-xs tw-text-muted-foreground">{formatLockNotice(submission)}</p>
        )}
      </div>
      <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-gap-2">
        <SubmissionActivitySheet linking={linking} />
        {isLinked && (
          <Button ref={changeTriggerRef} type="button" variant="outline" size="sm" onClick={() => handleChangeOpen(true)}>
            Change link
          </Button>
        )}
        <SubmissionSyllabusSheet submissionId={submission.id} />
        <Button type="button" variant="outline" size="sm" onClick={submission.isLocked ? onUnlock : onLock}>
          {submission.isLocked ? 'Unlock' : 'Lock & process'}
        </Button>
      </div>
      {isLinked && (
        <ChangeLinkedCourseDialog
          open={changeOpen}
          onOpenChange={handleChangeOpen}
          submission={submission}
          linking={linking}
          returnFocusRef={changeTriggerRef}
        />
      )}
    </header>
  );
}

SubmissionPageHeader.propTypes = {
  submission: PropTypes.object.isRequired,
  counts: PropTypes.shape({ total: PropTypes.number, ready: PropTypes.number }).isRequired,
  isLinked: PropTypes.bool.isRequired,
  onBack: PropTypes.func.isRequired,
  onLock: PropTypes.func.isRequired,
  onUnlock: PropTypes.func.isRequired,
  linking: PropTypes.object.isRequired,
};

export default SubmissionPageHeader;

import PropTypes from 'prop-types';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';

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

function SubmissionPageHeader({ submission, counts, isLinked, onBack, onLock, onUnlock, onChangeLink }) {
  const course = `${submission.courseCode || 'Course'}${submission.section ? `-${submission.section}` : ''}`;

  return (
    <header className="tw-mb-4 tw-rounded-lg tw-border tw-bg-card tw-p-5 tw-shadow-sm">
      <Button variant="link" className="tw-mb-2 tw-h-auto tw-p-0" onClick={onBack}>
        Back to Queue
      </Button>
      <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-4">
        <div className="tw-min-w-0">
          <h1 className="tw-text-2xl tw-font-semibold">
            {submission.courseCode} {submission.section && `· ${submission.section}`}: {submission.courseTitle}
          </h1>
          <dl className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-x-5 tw-gap-y-1 tw-text-sm tw-text-muted-foreground">
            <div><dt className="tw-inline tw-font-medium tw-text-foreground">Term: </dt><dd className="tw-inline">{submission.term}</dd></div>
            <div><dt className="tw-inline tw-font-medium tw-text-foreground">Section: </dt><dd className="tw-inline">{submission.section || '—'}</dd></div>
            <div><dt className="tw-inline tw-font-medium tw-text-foreground">Submitted: </dt><dd className="tw-inline">{formatDate(submission.submittedAt)}</dd></div>
            <div><dt className="tw-inline tw-font-medium tw-text-foreground">Faculty: </dt><dd className="tw-inline">{submission.facultyName}</dd></div>
          </dl>
        </div>
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
          {isLinked ? (
            <Badge variant="secondary" className="tw-bg-emerald-100 tw-text-emerald-800">
              ✓ Linked to FOLIO {course}
            </Badge>
          ) : (
            <Badge variant="secondary" className="tw-bg-amber-100 tw-text-amber-900">Needs linking</Badge>
          )}
          {isLinked && (
            <Button variant="link" className="tw-h-auto tw-p-0" onClick={onChangeLink}>Change</Button>
          )}
        </div>
      </div>
      <p className="tw-mt-4 tw-text-sm" aria-label="Submission item counts">
        {counts.total} items · {counts.todo} to do · {counts.inProgress} in progress · {counts.done} done
      </p>
      <div className="tw-mt-3 tw-flex tw-flex-wrap tw-items-center tw-gap-3">
        <Button variant="outline" size="sm" onClick={submission.isLocked ? onUnlock : onLock}>
          {submission.isLocked ? 'Unlock' : 'Lock & process'}
        </Button>
        {submission.isLocked && (
          <p role="status" className="tw-text-sm tw-text-muted-foreground">{formatLockNotice(submission)}</p>
        )}
      </div>
    </header>
  );
}

SubmissionPageHeader.propTypes = {
  submission: PropTypes.object.isRequired,
  counts: PropTypes.shape({ total: PropTypes.number, todo: PropTypes.number, inProgress: PropTypes.number, done: PropTypes.number }).isRequired,
  isLinked: PropTypes.bool.isRequired,
  onBack: PropTypes.func.isRequired,
  onLock: PropTypes.func.isRequired,
  onUnlock: PropTypes.func.isRequired,
  onChangeLink: PropTypes.func,
};

export default SubmissionPageHeader;

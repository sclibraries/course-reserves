import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { LockKeyhole, MessageSquareText, X } from 'lucide-react';
import { Alert } from '../../ui/alert';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import useSubmissionWorkflowStore from '../../../store/submissionWorkflowStore';
import { formatSubmissionCommunicationSummary } from '../../../services/admin/submissionWorkflow/submissionFormatters';
import { PriorityIndicator, ProgressBar, SubmissionStatusBadge } from './submission/queue/SubmissionQueueDisplay';
import SubmissionQueuePagination from './submission/queue/SubmissionQueuePagination';
import { formatSubmissionQueueDate } from './submission/queue/submissionQueueFormatters';

const gridColumns = 'md:tw-grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.6fr)]';

function SubmissionCell({ label, children }) {
  return (
    <div role="cell" className="tw-grid tw-min-w-0 tw-grid-cols-[5rem_minmax(0,1fr)] tw-gap-2 md:tw-block">
      <span className="tw-text-xs tw-font-medium tw-text-muted-foreground md:tw-sr-only">{label}</span>
      <div className="tw-min-w-0 tw-break-words">{children}</div>
    </div>
  );
}

SubmissionCell.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node.isRequired };

function SubmissionQueueRow({ submission }) {
  const fullDateTime = submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '';
  const courseLabel = submission.section ? `${submission.courseCode}-${submission.section}` : submission.courseCode;

  return (
    <div
      role="row"
      className={`tw-grid tw-min-w-0 tw-grid-cols-1 tw-gap-3 tw-rounded-lg tw-border tw-bg-card tw-p-3 hover:tw-bg-muted/40 md:tw-gap-0 md:tw-rounded-none md:tw-border-x-0 md:tw-border-t-0 md:tw-bg-transparent md:tw-px-3 md:tw-py-3 md:tw-border-b md:hover:tw-bg-muted/40 ${gridColumns}`}
    >
      <SubmissionCell label="Course">
        <Link
          to={`/admin/submissions/${submission.submissionId}`}
          className="tw-break-words tw-text-sm tw-font-semibold tw-text-primary tw-no-underline tw-underline-offset-4 hover:tw-underline focus-visible:tw-rounded-sm focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring"
        >
          {courseLabel}
        </Link>
        <span className="tw-ml-1 tw-text-xs tw-text-muted-foreground">· {submission.term}</span>
        <p className="tw-m-0 tw-mt-1 tw-break-words tw-text-xs tw-text-muted-foreground">{submission.courseTitle}</p>
      </SubmissionCell>
      <SubmissionCell label="Faculty"><span className="tw-text-sm">{submission.facultyName}</span></SubmissionCell>
      <SubmissionCell label="Submitted">
        {submission.submittedAt ? (
          <time className="tw-text-sm" dateTime={submission.submittedAt} title={fullDateTime} aria-label={fullDateTime}>
            {formatSubmissionQueueDate(submission.submittedAt)}
          </time>
        ) : <span className="tw-text-sm">Not submitted</span>}
      </SubmissionCell>
      <SubmissionCell label="Progress">
        <ProgressBar
          percentage={submission.completionPercentage}
          completeItems={submission.completeItems}
          totalItems={submission.totalItems}
        />
      </SubmissionCell>
      <SubmissionCell label="Status">
        <div className="tw-flex tw-min-w-0 tw-flex-col tw-items-start tw-gap-1.5">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
            <SubmissionStatusBadge status={submission.status} />
            <PriorityIndicator priority={submission.priority} />
          </div>
          <div className="tw-space-y-0.5 tw-break-words tw-text-xs tw-text-muted-foreground">
            <p className="tw-m-0 tw-break-words">
              {submission.assignedTo ? `Assigned to ${submission.assignedTo}` : 'Unassigned'}
            </p>
            {submission.isLocked && (
              <p className="tw-m-0 tw-flex tw-min-w-0 tw-items-center tw-gap-1 tw-break-words">
                <LockKeyhole aria-hidden="true" className="tw-h-3.5 tw-w-3.5 tw-shrink-0" />
                Locked by {submission.lockedBy || 'staff'}
              </p>
            )}
            {submission.communicationsCount > 0 && (
              <p className="tw-m-0 tw-flex tw-min-w-0 tw-items-center tw-gap-1 tw-break-words">
                <MessageSquareText aria-hidden="true" className="tw-h-3.5 tw-w-3.5 tw-shrink-0" />
                {formatSubmissionCommunicationSummary(submission.communicationsCount, submission.unreadCommunications)}
              </p>
            )}
          </div>
        </div>
      </SubmissionCell>
    </div>
  );
}

SubmissionQueueRow.propTypes = { submission: PropTypes.object.isRequired };

function SubmissionQueue() {
  const [showDrafts, setShowDrafts] = useState(true);
  const {
    submissions, loading, error, pagination, fetchPendingSubmissions, setPage, clearError,
  } = useSubmissionWorkflowStore();
  const visibleSubmissions = showDrafts
    ? submissions
    : submissions.filter((submission) => submission.status !== 'draft');

  useEffect(() => {
    fetchPendingSubmissions(1, 20);
  }, [fetchPendingSubmissions]);

  return (
    <section aria-labelledby="faculty-submissions-title" className="tw-min-w-0 tw-w-full tw-py-4 tw-text-sm">
      <div className="tw-overflow-hidden tw-rounded-lg tw-border tw-border-border tw-bg-card">
        <header className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-end tw-justify-between tw-gap-3 tw-border-b tw-border-border tw-px-4 tw-py-3">
          <div className="tw-min-w-0">
            <h2 id="faculty-submissions-title" className="tw-m-0 tw-text-lg tw-font-semibold">Faculty Submissions</h2>
            <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-muted-foreground">
              {pagination.totalCount} submission{pagination.totalCount !== 1 ? 's' : ''} · newest first
            </p>
          </div>
          <div className="tw-flex tw-min-h-10 tw-items-center tw-gap-2">
            <input
              id="show-drafts"
              name="show-drafts"
              type="checkbox"
              checked={showDrafts}
              onChange={(event) => setShowDrafts(event.target.checked)}
              className="tw-h-6 tw-w-6 tw-rounded tw-border-input tw-accent-primary focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring"
            />
            <Label htmlFor="show-drafts" className="tw-inline-flex tw-min-h-10 tw-cursor-pointer tw-items-center">Show drafts</Label>
          </div>
        </header>

        {error && (
          <Alert variant="destructive" className="tw-m-3 tw-flex tw-items-center tw-justify-between tw-gap-3">
            <p className="tw-m-0 tw-break-words">Could not load submissions. Please try again.</p>
            <Button type="button" variant="ghost" size="icon" aria-label="Dismiss error" onClick={clearError}>
              <X aria-hidden="true" />
            </Button>
          </Alert>
        )}

        {loading ? (
          <p role="status" aria-live="polite" className="tw-py-8 tw-text-center tw-text-muted-foreground">
            Loading submissions...
          </p>
        ) : visibleSubmissions.length === 0 ? (
          <div role="status" className="tw-rounded-lg tw-border tw-p-6 tw-text-center">
            <h3 className="tw-m-0 tw-text-sm tw-font-semibold">No submissions found</h3>
            <p className="tw-m-0 tw-mt-2 tw-text-xs tw-text-muted-foreground">
              {showDrafts
                ? 'There are currently no pending faculty submissions to process.'
                : 'No submissions match the current filter.'}
            </p>
          </div>
        ) : (
          <>
            <div role="table" aria-label="Faculty submissions" className="tw-min-w-0 tw-w-full tw-pb-1">
              <div role="rowgroup">
                <div role="row" className={`tw-sr-only ${gridColumns} md:tw-not-sr-only md:tw-grid md:tw-bg-muted md:tw-px-3 md:tw-py-2`}>
                  {['Course', 'Faculty', 'Submitted', 'Progress', 'Status'].map((heading) => (
                    <div key={heading} role="columnheader" className="tw-min-w-0 tw-break-words tw-text-xs tw-font-semibold tw-text-muted-foreground">
                      {heading}
                    </div>
                  ))}
                </div>
              </div>
              <div role="rowgroup" className="tw-grid tw-min-w-0 tw-gap-3 md:tw-gap-0">
                {visibleSubmissions.map((submission) => (
                  <SubmissionQueueRow key={submission.submissionId} submission={submission} />
                ))}
              </div>
            </div>
            {pagination.pageCount > 1 && (
              <SubmissionQueuePagination pagination={pagination} onPageChange={setPage} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default SubmissionQueue;

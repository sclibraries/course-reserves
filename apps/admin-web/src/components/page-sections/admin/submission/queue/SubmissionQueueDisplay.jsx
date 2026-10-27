import PropTypes from 'prop-types';
import { Badge } from '../../../../ui/badge';
import { formatSubmissionStatusLabel } from '../../../../../services/admin/submissionWorkflow/submissionFormatters';

const priorities = {
  urgent: { label: 'Urgent', className: 'tw-bg-priority-urgent/15 tw-text-priority-urgent-fg' },
  high: { label: 'High', className: 'tw-bg-priority-high/15 tw-text-priority-high-fg' },
  normal: { label: 'Normal', className: 'tw-bg-priority-normal/15 tw-text-priority-normal-fg' },
};

const submissionStatusClasses = {
  submitted: 'tw-bg-status-submitted/15 tw-text-status-submitted-fg',
  in_review: 'tw-bg-status-review/15 tw-text-status-review-fg',
  in_progress: 'tw-bg-status-review/15 tw-text-status-review-fg',
  partially_complete: 'tw-bg-status-partial/15 tw-text-status-partial-fg',
  complete: 'tw-bg-status-complete/15 tw-text-status-complete-fg',
  draft: 'tw-bg-status-draft/15 tw-text-status-draft-fg',
  canceled: 'tw-bg-status-canceled/15 tw-text-status-canceled-fg',
  pending: 'tw-bg-status-review/15 tw-text-status-review-fg',
  unavailable: 'tw-bg-muted tw-text-muted-foreground',
};

function SubmissionStatusBadge({ status }) {
  return (
    <Badge variant="outline" className={`tw-border-0 tw-px-2 tw-py-0.5 tw-text-xs tw-font-semibold tw-leading-[18px] ${submissionStatusClasses[status] || 'tw-bg-muted tw-text-muted-foreground'}`}>
      {formatSubmissionStatusLabel(status)}
    </Badge>
  );
}

SubmissionStatusBadge.propTypes = { status: PropTypes.string.isRequired };

function PriorityIndicator({ priority }) {
  const config = priorities[priority] || priorities.normal;
  return (
    <Badge variant="outline" className={`tw-border-0 tw-px-2 tw-py-0.5 tw-text-xs tw-font-semibold tw-leading-[18px] ${config.className}`}>
      {config.label}
    </Badge>
  );
}

PriorityIndicator.propTypes = { priority: PropTypes.oneOf(['urgent', 'high', 'normal']).isRequired };

function ProgressBar({ percentage, completeItems, totalItems }) {
  return (
    <div className="tw-min-w-0 tw-space-y-1">
      <div
        role="progressbar"
        aria-label={`${completeItems} of ${totalItems} items done`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percentage}
        className="tw-h-1.5 tw-w-full tw-overflow-hidden tw-rounded-full tw-bg-border-strong"
      >
        <div className="tw-h-full tw-rounded-full tw-bg-primary" style={{ width: `${percentage}%` }} />
      </div>
      <p className="tw-m-0 tw-text-xs tw-text-muted-foreground">{completeItems} of {totalItems} done</p>
    </div>
  );
}

ProgressBar.propTypes = {
  percentage: PropTypes.number.isRequired,
  completeItems: PropTypes.number.isRequired,
  totalItems: PropTypes.number.isRequired,
};

export { PriorityIndicator, ProgressBar, SubmissionStatusBadge };

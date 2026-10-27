import PropTypes from 'prop-types';
import { Clock3, TriangleAlert } from 'lucide-react';
import { Badge } from '../../../../ui/badge';

const priorities = {
  urgent: { icon: TriangleAlert, label: 'Urgent', variant: 'destructive' },
  high: { icon: Clock3, label: 'High', variant: 'secondary' },
  normal: { icon: null, label: 'Normal', variant: 'outline' },
};

function PriorityIndicator({ priority }) {
  const config = priorities[priority] || priorities.normal;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="tw-gap-1">
      {Icon && <Icon aria-hidden="true" className="tw-h-3.5 tw-w-3.5" />}
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
        className="tw-h-2 tw-w-full tw-overflow-hidden tw-rounded-full tw-bg-muted"
      >
        <div className="tw-h-full tw-rounded-full tw-bg-primary" style={{ width: `${percentage}%` }} />
      </div>
      <p className="tw-m-0 tw-text-sm">{completeItems} of {totalItems} done</p>
    </div>
  );
}

ProgressBar.propTypes = {
  percentage: PropTypes.number.isRequired,
  completeItems: PropTypes.number.isRequired,
  totalItems: PropTypes.number.isRequired,
};

export { PriorityIndicator, ProgressBar };

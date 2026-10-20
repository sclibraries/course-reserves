import PropTypes from 'prop-types';
import { Progress } from 'reactstrap';
import { FaClock, FaExclamationTriangle } from 'react-icons/fa';

function PriorityIndicator({ priority }) {
  const priorityConfig = {
    urgent: { icon: FaExclamationTriangle, text: 'Urgent' },
    high: { icon: FaClock, text: 'High' },
    normal: { icon: null, text: 'Normal' },
  };
  const config = priorityConfig[priority] || priorityConfig.normal;
  const Icon = config.icon;

  return (
    <span className={`priority-indicator priority-${priority}`}>
      {Icon && <Icon className="me-1" />}
      {config.text}
    </span>
  );
}

PriorityIndicator.propTypes = { priority: PropTypes.oneOf(['urgent', 'high', 'normal']).isRequired };

function ProgressBar({ percentage, completeItems, totalItems }) {
  return (
    <div className="progress-wrapper">
      <Progress value={percentage} color={percentage === 100 ? 'success' : 'primary'}>
        {percentage}%
      </Progress>
      <small className="text-muted">{completeItems}/{totalItems}</small>
    </div>
  );
}

ProgressBar.propTypes = {
  percentage: PropTypes.number.isRequired,
  completeItems: PropTypes.number.isRequired,
  totalItems: PropTypes.number.isRequired,
};

export { PriorityIndicator, ProgressBar };

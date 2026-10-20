import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';
import { formatSubmissionStatusLabel } from '../../../../../services/admin/submissionWorkflow/submissionFormatters';

const StatusBadge = ({ status }) => {
  const statusColors = {
    pending: 'warning',
    in_progress: 'info',
    complete: 'success',
    unavailable: 'danger',
    submitted: 'info',
    draft: 'secondary',
  };
  const color = statusColors[status] || 'secondary';
  return (
    <Badge color={color} className={color === 'warning' ? 'text-dark' : ''}>
      {formatSubmissionStatusLabel(status)}
    </Badge>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired
};

export default StatusBadge;

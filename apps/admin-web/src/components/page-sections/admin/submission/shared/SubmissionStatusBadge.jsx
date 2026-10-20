import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';
import { formatSubmissionStatusLabel } from '../../../../../services/admin/submissionWorkflow/submissionFormatters';

const submissionStatusColors = {
  draft: 'secondary',
  submitted: 'info',
  in_progress: 'warning',
  complete: 'success',
  unavailable: 'danger',
};

function SubmissionStatusBadge({ status }) {
  const color = submissionStatusColors[status] || 'secondary';
  return (
    <Badge color={color} className={color === 'warning' ? 'text-dark' : ''}>
      {formatSubmissionStatusLabel(status)}
    </Badge>
  );
}

SubmissionStatusBadge.propTypes = { status: PropTypes.string.isRequired };

export default SubmissionStatusBadge;

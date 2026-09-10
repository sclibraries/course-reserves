import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';

const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending: { color: 'warning', text: 'Pending' },
    in_progress: { color: 'info', text: 'In Progress' },
    complete: { color: 'success', text: 'Complete' },
    unavailable: { color: 'danger', text: 'Unavailable' },
    submitted: { color: 'info', text: 'Submitted' }
  };
  
  const config = statusConfig[status] || { color: 'secondary', text: status };
  
  return (
    <Badge color={config.color} className={config.color === 'warning' ? 'text-dark' : ''}>
      {config.text}
    </Badge>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired
};

export default StatusBadge;
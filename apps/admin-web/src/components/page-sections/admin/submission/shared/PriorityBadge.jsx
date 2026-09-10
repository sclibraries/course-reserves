import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';

const PriorityBadge = ({ priority }) => {
  const priorityConfig = {
    urgent: { color: 'danger', text: 'Urgent' },
    high: { color: 'warning', text: 'High' },
    medium: { color: 'info', text: 'Medium' },
    low: { color: 'secondary', text: 'Low' }
  };
  
  const config = priorityConfig[priority] || priorityConfig.medium;
  
  return (
    <Badge color={config.color} pill className={config.color === 'warning' ? 'text-dark' : ''}>
      {config.text}
    </Badge>
  );
};

PriorityBadge.propTypes = {
  priority: PropTypes.string.isRequired
};

export default PriorityBadge;
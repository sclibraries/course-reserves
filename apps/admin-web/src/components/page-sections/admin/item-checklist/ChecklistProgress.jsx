import PropTypes from 'prop-types';
import { Progress } from 'reactstrap';

function ChecklistProgress({ tasks, progress, requiredRemaining }) {
  return (
    <div className="mb-4">
      <Progress value={progress} color={progress === 100 ? 'success' : 'primary'} className="mb-2" />
      <div className="d-flex justify-content-between text-muted small">
        <span>{tasks.filter(task => task.completed).length} of {tasks.length} tasks completed</span>
        {requiredRemaining > 0 && (
          <span className="text-warning">
            {requiredRemaining} required {requiredRemaining === 1 ? 'task' : 'tasks'} remaining
          </span>
        )}
      </div>
    </div>
  );
}

ChecklistProgress.propTypes = {
  tasks: PropTypes.arrayOf(PropTypes.object).isRequired,
  progress: PropTypes.number.isRequired,
  requiredRemaining: PropTypes.number.isRequired
};

export default ChecklistProgress;

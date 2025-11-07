import PropTypes from 'prop-types';
import {
  Card,
  CardBody,
  Alert
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

/**
 * ConditionBuilder - Build conditional logic for workflow branching
 * (Simplified initial version)
 */
function ConditionBuilder({ conditions, steps, onUpdateConditions }) {
  
  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-1">Conditions</h5>
          <p className="text-muted small mb-0">
            Define conditional logic for workflow branching (Optional)
          </p>
        </div>
      </div>

      {/* Empty State */}
      <Card className="bg-light">
        <CardBody className="text-center py-5">
          <FontAwesomeIcon
            icon="fa-solid fa-code-branch"
            size="3x"
            className="text-muted mb-3"
          />
          <h5>Conditions (Optional)</h5>
          <p className="text-muted">
            Conditions allow your workflow to branch based on data or decisions.<br />
            This feature is available for advanced workflow configurations.
          </p>
          <Alert color="info" className="mt-3">
            <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-2" />
            Conditional workflows can be configured through the backend API or will be available in a future update.
          </Alert>
        </CardBody>
      </Card>
    </div>
  );
}

ConditionBuilder.propTypes = {
  conditions: PropTypes.array.isRequired,
  steps: PropTypes.array.isRequired,
  onUpdateConditions: PropTypes.func.isRequired
};

export default ConditionBuilder;

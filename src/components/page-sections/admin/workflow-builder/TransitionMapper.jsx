import PropTypes from 'prop-types';
import {
  Card,
  CardBody,
  Button,
  Alert
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

/**
 * TransitionMapper - Visual workflow transition mapping
 * (Simplified initial version with auto-generation)
 */
function TransitionMapper({ steps, conditions, transitions, onUpdateTransitions }) {

  // Automatically generate default sequential transitions
  const generateDefaultTransitions = () => {
    const newTransitions = [];
    for (let i = 0; i < steps.length - 1; i++) {
      const fromId = steps[i].id || steps[i].step_order;
      const toId = steps[i + 1].id || steps[i + 1].step_order;
      
      // Check if transition already exists
      const exists = transitions.some(
        t => t.from_step_id === fromId && t.to_step_id === toId
      );
      
      if (!exists) {
        newTransitions.push({
          from_step_id: fromId,
          to_step_id: toId,
          condition_id: null,
          transition_type: 'sequential'
        });
      }
    }
    
    if (newTransitions.length > 0) {
      onUpdateTransitions([...transitions, ...newTransitions]);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-1">Workflow Flow</h5>
          <p className="text-muted small mb-0">
            Define how steps connect and transition
          </p>
        </div>
        <Button
          color="primary"
          size="sm"
          onClick={generateDefaultTransitions}
          disabled={steps.length < 2}>
          <FontAwesomeIcon icon="fa-solid fa-magic" className="me-2" />
          Auto-Generate Sequential Flow
        </Button>
      </div>

      {steps.length < 2 ? (
        <Alert color="info">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-2" />
          Add at least 2 steps before creating transitions
        </Alert>
      ) : transitions.length === 0 ? (
        <Card className="bg-light">
          <CardBody className="text-center py-5">
            <FontAwesomeIcon
              icon="fa-solid fa-diagram-project"
              size="3x"
              className="text-muted mb-3"
            />
            <h5>No Transitions Yet</h5>
            <p className="text-muted">
              Transitions define how workflow moves from one step to the next.<br />
              Click "Auto-Generate" to create sequential transitions automatically.
            </p>
            <Button color="primary" onClick={generateDefaultTransitions}>
              <FontAwesomeIcon icon="fa-solid fa-magic" className="me-2" />
              Auto-Generate Sequential Flow
            </Button>
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Visual Flow Diagram */}
          <Card className="mb-3">
            <CardBody>
              <h6 className="mb-3">
                <FontAwesomeIcon icon="fa-solid fa-sitemap" className="me-2" />
                Visual Flow
              </h6>
              <div className="workflow-flow-diagram">
                {steps.map((step, index) => {
                  const outgoingTransitions = transitions.filter(
                    t => t.from_step_id === (step.id || step.step_order)
                  );
                  
                  return (
                    <div key={index} className="mb-3">
                      {/* Step Node */}
                      <div className="d-flex align-items-center">
                        <div
                          className="bg-primary text-white rounded px-3 py-2 d-inline-block"
                          style={{ minWidth: '200px' }}>
                          <FontAwesomeIcon icon="fa-solid fa-circle" className="me-2" size="xs" />
                          <strong>Step {step.step_order}:</strong> {step.step_name}
                        </div>
                        
                        {/* Outgoing Arrows */}
                        {outgoingTransitions.length > 0 && (
                          <div className="ms-3">
                            {outgoingTransitions.map((trans, tIndex) => {
                              const toStep = steps.find(s => (s.id || s.step_order) === trans.to_step_id);
                              
                              return (
                                <div key={tIndex} className="d-flex align-items-center mb-1">
                                  <FontAwesomeIcon
                                    icon="fa-solid fa-arrow-right"
                                    className="text-primary"
                                    size="lg"
                                  />
                                  <span className="ms-2 small text-muted">
                                    to Step {toStep?.step_order}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Alert color="success">
            <FontAwesomeIcon icon="fa-solid fa-check-circle" className="me-2" />
            <strong>{transitions.length} transition(s) configured.</strong> Your workflow will execute steps in sequential order.
          </Alert>
        </>
      )}

      {/* Help Text */}
      <div className="mt-3 p-3 bg-light rounded">
        <h6 className="mb-2">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-2 text-info" />
          About Transitions
        </h6>
        <p className="small mb-0">
          Sequential transitions connect steps in order. For advanced conditional branching and parallel execution,
          additional configuration can be done through the backend API or will be available in future updates.
        </p>
      </div>
    </div>
  );
}

TransitionMapper.propTypes = {
  steps: PropTypes.array.isRequired,
  conditions: PropTypes.array.isRequired,
  transitions: PropTypes.array.isRequired,
  onUpdateTransitions: PropTypes.func.isRequired
};

export default TransitionMapper;

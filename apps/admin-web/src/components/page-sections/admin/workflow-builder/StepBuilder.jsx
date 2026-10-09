import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDrag, useDrop } from 'react-dnd';
import {
  Card,
  CardBody,
  Button,
  Badge,
  UncontrolledTooltip
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import StepConfigModal from './StepConfigModal';

const ITEM_TYPE = 'WORKFLOW_STEP';

/**
 * DraggableStepCard - Individual draggable step card
 */
function DraggableStepCard({ step, index, steps, onEdit, onDelete, moveStep }) {
  const ref = useRef(null);

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const [{ isOver }, drop] = useDrop({
    accept: ITEM_TYPE,
    hover: (draggedItem) => {
      if (draggedItem.index !== index) {
        moveStep(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  });

  drag(drop(ref));

  const stepNumber = step.sequence_order ?? step.step_order ?? (index + 1);
  const isGate = step.is_gate === 1 || step.is_gate === true;
  const isAutomated = step.is_automated === 1 || step.is_automated === true;

  const dependencyLabels = (Array.isArray(step.depends_on) ? step.depends_on : [])
    .map((dep) => {
      const target = steps.find((candidate, candidateIndex) => {
        const candidateId = candidate.id ?? candidate.local_id ?? candidate.sequence_order ?? (candidateIndex + 1);
        return candidateId === dep;
      });
      if (!target) return null;
      const targetNumber = target.sequence_order ?? target.step_order ?? (steps.indexOf(target) + 1);
      return `Step ${targetNumber}: ${target.step_name}`;
    })
    .filter(Boolean);

  const getStepTypeBadge = (type) => {
    const config = {
      'action': { color: 'primary', icon: 'fa-solid fa-play' },
      'decision': { color: 'warning', icon: 'fa-solid fa-code-branch' },
      'notification': { color: 'info', icon: 'fa-solid fa-bell' },
      'assignment': { color: 'success', icon: 'fa-solid fa-user-check' },
      'approval': { color: 'danger', icon: 'fa-solid fa-check-circle' }
    };
    const { color, icon } = config[type] || config['action'];
    return (
      <Badge color={color} className="me-2">
        <FontAwesomeIcon icon={icon} className="me-1" />
        {type}
      </Badge>
    );
  };

  return (
    <div
      ref={ref}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
        borderLeft: isOver ? '3px solid #007bff' : '3px solid transparent',
        transition: 'all 0.2s'
      }}>
      <Card className="mb-2">
        <CardBody className="p-3">
          <div className="d-flex align-items-start">
            {/* Drag Handle */}
            <div className="me-3 text-muted" style={{ cursor: 'grab' }}>
              <FontAwesomeIcon icon="fa-solid fa-grip-vertical" size="lg" />
            </div>

            {/* Step Number */}
            <div className="me-3">
              <div
                className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle"
                style={{ width: '32px', height: '32px', fontWeight: 'bold' }}>
                {stepNumber}
              </div>
            </div>

            {/* Step Info */}
            <div className="flex-grow-1">
              <div className="d-flex align-items-center mb-2">
                <h6 className="mb-0 me-2">{step.step_name}</h6>
                {getStepTypeBadge(step.step_type)}
                {step.is_required && (
                  <Badge color="danger" pill className="ms-1">
                    Required
                  </Badge>
                )}
                {isGate && (
                  <Badge color="dark" pill className="ms-1">
                    Gate
                  </Badge>
                )}
                {isAutomated && (
                  <Badge color="info" pill className="ms-1">
                    Automated
                  </Badge>
                )}
                {step.due_date_offset && (
                  <>
                    <Badge color="light" className="text-dark ms-1" id={`due-${index}`}>
                      <FontAwesomeIcon icon="fa-solid fa-clock" className="me-1" />
                      {step.due_date_offset} days
                    </Badge>
                    <UncontrolledTooltip target={`due-${index}`}>
                      Due date offset from workflow start
                    </UncontrolledTooltip>
                  </>
                )}
              </div>
              {step.description && (
                <p className="text-muted small mb-0">{step.description}</p>
              )}
              {dependencyLabels.length > 0 && (
                <p className="text-muted small mb-0 mt-2">
                  <FontAwesomeIcon icon="fa-solid fa-link" className="me-1" />
                  Depends on {dependencyLabels.join(', ')}
                </p>
              )}
              {step.automation_handler && (
                <p className="text-muted small mb-0 mt-2">
                  <FontAwesomeIcon icon="fa-solid fa-robot" className="me-1" />
                  Automation Handler: <code>{step.automation_handler}</code>
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="ms-3">
              <Button
                color="link"
                size="sm"
                className="p-1 me-1"
                onClick={() => onEdit(index)}
                title="Edit step">
                <FontAwesomeIcon icon="fa-solid fa-edit" />
              </Button>
              <Button
                color="link"
                size="sm"
                className="p-1 text-danger"
                onClick={() => onDelete(index)}
                title="Delete step">
                <FontAwesomeIcon icon="fa-solid fa-trash" />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

DraggableStepCard.propTypes = {
  step: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  steps: PropTypes.array.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  moveStep: PropTypes.func.isRequired
};

/**
 * StepBuilder - Main component for building workflow steps with drag-and-drop
 */
function StepBuilder({ steps, onAddStep, onUpdateStep, onDeleteStep, onReorderSteps }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const moveStep = (fromIndex, toIndex) => {
    const newSteps = [...steps];
    const [movedStep] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, movedStep);
    onReorderSteps(newSteps);
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setModalOpen(true);
  };

  const handleDelete = (index) => {
    if (window.confirm(`Delete step "${steps[index].step_name}"?`)) {
      onDeleteStep(index);
    }
  };

  const handleSaveStep = (updatedStep) => {
    onUpdateStep(editingIndex, updatedStep);
    setModalOpen(false);
    setEditingIndex(null);
  };

  const handleAddNew = () => {
    onAddStep();
    // Open editor for the new step
    setEditingIndex(steps.length);
    setModalOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-1">Workflow Steps</h5>
          <p className="text-muted small mb-0">
            Drag steps to reorder. Click edit to configure step details.
          </p>
        </div>
        <Button color="primary" size="sm" onClick={handleAddNew}>
          <FontAwesomeIcon icon="fa-solid fa-plus" className="me-2" />
          Add Step
        </Button>
      </div>

      {/* Steps List */}
      {steps.length === 0 ? (
        <Card className="bg-light">
          <CardBody className="text-center py-5">
            <FontAwesomeIcon
              icon="fa-solid fa-list-check"
              size="3x"
              className="text-muted mb-3"
            />
            <h5>No Steps Yet</h5>
            <p className="text-muted">
              Click &ldquo;Add Step&rdquo; to create your first workflow step
            </p>
            <Button color="primary" onClick={handleAddNew}>
              <FontAwesomeIcon icon="fa-solid fa-plus" className="me-2" />
              Add First Step
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div>
          {steps.map((step, index) => (
            <DraggableStepCard
              key={index}
              step={step}
              index={index}
              steps={steps}
              onEdit={handleEdit}
              onDelete={handleDelete}
              moveStep={moveStep}
            />
          ))}
        </div>
      )}

      {/* Step Config Modal */}
      {modalOpen && editingIndex !== null && steps[editingIndex] && (
        <StepConfigModal
          isOpen={modalOpen}
          step={steps[editingIndex]}
          allSteps={steps}
          currentIndex={editingIndex}
          onSave={handleSaveStep}
          onClose={() => {
            setModalOpen(false);
            setEditingIndex(null);
          }}
        />
      )}

      {/* Help Text */}
      {steps.length > 0 && (
        <div className="mt-3 p-3 bg-light rounded">
          <h6 className="mb-2">
            <FontAwesomeIcon icon="fa-solid fa-lightbulb" className="me-2 text-warning" />
            Tips
          </h6>
          <ul className="small mb-0">
            <li>Steps execute in order from top to bottom</li>
            <li>Use the grip icon to drag and reorder steps</li>
            <li>Mark critical steps as &ldquo;Required&rdquo; to prevent skipping</li>
            <li>Set due date offsets to track deadlines</li>
            <li>Use Decision steps to create branching workflows</li>
          </ul>
        </div>
      )}
    </div>
  );
}

StepBuilder.propTypes = {
  steps: PropTypes.array.isRequired,
  onAddStep: PropTypes.func.isRequired,
  onUpdateStep: PropTypes.func.isRequired,
  onDeleteStep: PropTypes.func.isRequired,
  onReorderSteps: PropTypes.func.isRequired
};

export default StepBuilder;

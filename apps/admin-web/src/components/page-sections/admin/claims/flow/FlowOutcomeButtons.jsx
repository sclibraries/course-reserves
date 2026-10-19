import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label } from 'reactstrap';

function FlowOutcomeButtons({
  item, step, canAct, pending, switchPending, selectedOutcome, notes, reason,
  onNotesChange, onReasonChange, onOutcomeClick, onConfirm, onCancel,
}) {
  return (
    <>
      {!canAct && <p className="text-warning mb-2" role="status">Claim this item to work on it</p>}
      {step.kind === 'action' && (
        <FormGroup>
          <Label for={`flow-notes-${item.kind}-${item.id}`}>Action notes</Label>
          <Input id={`flow-notes-${item.kind}-${item.id}`} type="textarea" name="flow-notes" value={notes} onChange={onNotesChange} />
        </FormGroup>
      )}
      <div className="d-flex flex-wrap gap-2">
        {(step.outcomes || []).map((outcome) => (
          <Button
            key={outcome.key}
            color="primary"
            data-outcome-key={outcome.key}
            disabled={!canAct || pending || switchPending}
            onClick={() => onOutcomeClick(outcome)}
          >
            {outcome.label}
          </Button>
        ))}
      </div>
      {selectedOutcome && (
        <div className="mt-3">
          {selectedOutcome.next?.handoff_group && (
            <p className="text-warning" role="status">This hands the item to {selectedOutcome.next.handoff_group}</p>
          )}
          {selectedOutcome.reason_required && (
            <FormGroup>
              <Label for={`flow-reason-${item.kind}-${item.id}`}>Reason (required)</Label>
              <Input id={`flow-reason-${item.kind}-${item.id}`} type="textarea" name="flow-reason" value={reason} onChange={onReasonChange} />
            </FormGroup>
          )}
          <Button data-action="confirm-outcome" disabled={!canAct || pending || (selectedOutcome.reason_required && !reason.trim())} onClick={onConfirm}>
            Confirm outcome
          </Button>
          <Button color="link" onClick={onCancel}>Cancel</Button>
        </div>
      )}
    </>
  );
}

FlowOutcomeButtons.propTypes = {
  item: PropTypes.object.isRequired,
  step: PropTypes.object.isRequired,
  canAct: PropTypes.bool.isRequired,
  pending: PropTypes.bool.isRequired,
  switchPending: PropTypes.bool.isRequired,
  selectedOutcome: PropTypes.object,
  notes: PropTypes.string.isRequired,
  reason: PropTypes.string.isRequired,
  onNotesChange: PropTypes.func.isRequired,
  onReasonChange: PropTypes.func.isRequired,
  onOutcomeClick: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default FlowOutcomeButtons;

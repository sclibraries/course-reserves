import PropTypes from 'prop-types';
import { Button, Form, FormGroup, Input, Label, Spinner } from 'reactstrap';

function SwitchFlowForm({
  item, open, loading, flows, selectedFlow, reason, pending, canAct, flowPending,
  onOpen, onFlowChange, onReasonChange, onSubmit,
}) {
  return (
    <div className="mt-3">
      <Button color="outline-primary" data-action="open-switch-flow" onClick={onOpen} disabled={flowPending || pending}>
        Switch flow
      </Button>
      {open && (
        <Form className="border rounded p-3 mt-2" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
          {loading ? <Spinner size="sm" aria-label="Loading available flows" /> : (
            <>
              <FormGroup>
                <Label for={`switch-flow-${item.kind}-${item.id}`}>Flow</Label>
                <Input id={`switch-flow-${item.kind}-${item.id}`} type="select" name="flow-id" value={selectedFlow} onChange={onFlowChange}>
                  <option value="">Choose a flow</option>
                  {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
                </Input>
              </FormGroup>
              <FormGroup>
                <Label for={`switch-reason-${item.kind}-${item.id}`}>Reason for switching (required)</Label>
                <Input id={`switch-reason-${item.kind}-${item.id}`} type="textarea" name="switch-reason" value={reason} onChange={onReasonChange} required />
              </FormGroup>
              {!canAct && <p className="text-warning" role="status">Claim this item to work on it</p>}
              <Button type="submit" data-action="switch-flow" disabled={!canAct || !selectedFlow || !reason.trim() || pending}>
                {pending ? 'Switching…' : 'Switch flow'}
              </Button>
            </>
          )}
        </Form>
      )}
    </div>
  );
}

SwitchFlowForm.propTypes = {
  item: PropTypes.object.isRequired,
  open: PropTypes.bool.isRequired,
  loading: PropTypes.bool.isRequired,
  flows: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedFlow: PropTypes.string.isRequired,
  reason: PropTypes.string.isRequired,
  pending: PropTypes.bool.isRequired,
  canAct: PropTypes.bool.isRequired,
  flowPending: PropTypes.bool.isRequired,
  onOpen: PropTypes.func.isRequired,
  onFlowChange: PropTypes.func.isRequired,
  onReasonChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default SwitchFlowForm;

import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Form, FormGroup, Input, Label, Spinner } from 'reactstrap';
import { getFlowErrorCode, getFlowErrorMessage, formatFinishState } from '../../../../services/admin/workflowFlows/flowFormatters';
import { workflowFlowsApi } from '../../../../services/admin/workflowFlows/workflowFlowsApi';

function ItemFlowHistory({ history }) {
  return (
    <section aria-label="Item flow history" className="mt-3">
      <h4 className="h6">Item flow history</h4>
      {!history.length && <p className="text-muted mb-0">No item flow history yet.</p>}
      <ol className="list-unstyled mb-0">
        {history.map((entry, index) => (
          <li className="border-top py-2" key={`${entry.created_at}-${entry.step_key}-${index}`}>
            <strong>{entry.step_label}</strong>{entry.outcome_label && ` · ${entry.outcome_label}`}
            {entry.notes && <p className="mb-0">Notes: {entry.notes}</p>}
            {entry.reason && <p className="mb-0">Reason: {entry.reason}</p>}
            <p className="small text-muted mb-0">
              {entry.actor_display || 'Staff member'} · {entry.created_at ? new Date(entry.created_at).toLocaleString() : 'Time unavailable'}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

ItemFlowHistory.propTypes = { history: PropTypes.arrayOf(PropTypes.object).isRequired };

function parseFlowId(value) {
  const numericId = Number(value);
  return Number.isFinite(numericId) ? numericId : value;
}

function ItemFlowPanel({ item, onChanged }) {
  const [flowState, setFlowState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchFlows, setSwitchFlows] = useState([]);
  const [switchFlowId, setSwitchFlowId] = useState('');
  const [switchReason, setSwitchReason] = useState('');
  const [switchPending, setSwitchPending] = useState(false);
  const step = flowState?.current_step?.step;
  const canAct = Boolean(flowState?.can_act);

  const loadFlow = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setFlowState(await workflowFlowsApi.getItemFlow(item.kind, item.id));
    } catch (requestError) {
      setError(getFlowErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [item.kind, item.id]);

  useEffect(() => { loadFlow(); }, [loadFlow]);

  const submitOutcome = async (outcome) => {
    if (!step || !canAct) return;
    setPending(true);
    setError('');
    setNotice('');
    const body = { step_key: step.key, outcome_key: outcome.key };
    if (step.kind === 'action' && notes.trim()) body.notes = notes.trim();
    if (outcome.reason_required && reason.trim()) body.reason = reason.trim();
    try {
      setFlowState(await workflowFlowsApi.submitStepResult(item.kind, item.id, body));
      setSelectedOutcome(null);
      setNotes('');
      setReason('');
      await onChanged?.();
    } catch (requestError) {
      const code = getFlowErrorCode(requestError);
      const message = getFlowErrorMessage(requestError);
      if (code === 'stale_step') {
        setSelectedOutcome(null);
        setNotes('');
        setReason('');
        setNotice(message);
        await loadFlow();
      } else if (code === 'step_not_available_yet') {
        setNotice(message);
      } else {
        setError(message);
      }
    } finally {
      setPending(false);
    }
  };

  const handleOutcome = (outcome) => {
    if (!canAct) return;
    setError('');
    setNotice('');
    if (outcome.reason_required || outcome.next?.handoff_group) {
      setSelectedOutcome(outcome);
      setReason('');
      return;
    }
    submitOutcome(outcome);
  };

  const openSwitchFlow = async () => {
    setSwitchOpen(true);
    setError('');
    if (switchFlows.length || switchLoading) return;
    setSwitchLoading(true);
    try {
      const result = await workflowFlowsApi.getFlows();
      setSwitchFlows(result?.flows || []);
    } catch (requestError) {
      setError(getFlowErrorMessage(requestError));
    } finally {
      setSwitchLoading(false);
    }
  };

  const submitSwitchFlow = async (event) => {
    event.preventDefault();
    if (!switchFlowId || !switchReason.trim() || !canAct) return;
    setSwitchPending(true);
    setError('');
    try {
      setFlowState(await workflowFlowsApi.switchFlow(item.kind, item.id, {
        flow_id: parseFlowId(switchFlowId), reason: switchReason.trim(),
      }));
      setSwitchOpen(false);
      setSwitchReason('');
      await onChanged?.();
    } catch (requestError) {
      setError(getFlowErrorMessage(requestError));
    } finally {
      setSwitchPending(false);
    }
  };

  if (loading && !flowState) return <div className="py-2"><Spinner size="sm" aria-label="Loading item flow" /></div>;

  return (
    <section className="border rounded p-3" aria-label={`Item flow: ${item.title || item.id}`}>
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div>
          {flowState?.flow && <h3 className="h5 mb-1">{flowState.flow.name} · version {flowState.flow.version}</h3>}
          {step && <h4 className="h6 mb-1">{step.label}</h4>}
          {step?.help_text && <p className="text-muted mb-2">{step.help_text}</p>}
        </div>
        <Button color="outline-secondary" size="sm" aria-label="Reload item flow" onClick={() => { setNotice(''); loadFlow(); }} disabled={loading}>
          Reload
        </Button>
      </div>

      {error && <Alert color="danger" role="alert">{error}</Alert>}
      {notice && <p className="text-info mb-2" role="status">{notice}</p>}
      {flowState?.flow === null && <p className="mb-2">No flow is set for this material type.</p>}
      {flowState?.finished && (
        <div className="mb-2">
          <p className="mb-1"><strong>Finished: {formatFinishState(flowState.finished.finish_state)}</strong></p>
          {flowState.finished.reason && <p className="mb-0">Reason: {flowState.finished.reason}</p>}
        </div>
      )}

      {step && !flowState?.finished && step.kind !== 'finish' && (
        <>
          {!canAct && <p className="text-warning mb-2" role="status">Claim this item to work on it</p>}
          {step.kind === 'action' && (
            <FormGroup>
              <Label for={`flow-notes-${item.kind}-${item.id}`}>Action notes</Label>
              <Input id={`flow-notes-${item.kind}-${item.id}`} type="textarea" name="flow-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </FormGroup>
          )}
          <div className="d-flex flex-wrap gap-2">
            {(step.outcomes || []).map((outcome) => (
              <Button
                key={outcome.key}
                color="primary"
                data-outcome-key={outcome.key}
                disabled={!canAct || pending || switchPending}
                onClick={() => handleOutcome(outcome)}
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
                  <Input id={`flow-reason-${item.kind}-${item.id}`} type="textarea" name="flow-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
                </FormGroup>
              )}
              <Button data-action="confirm-outcome" disabled={!canAct || pending || (selectedOutcome.reason_required && !reason.trim())} onClick={() => submitOutcome(selectedOutcome)}>
                Confirm outcome
              </Button>
              <Button color="link" onClick={() => setSelectedOutcome(null)}>Cancel</Button>
            </div>
          )}
        </>
      )}

      <div className="mt-3">
        <Button color="outline-primary" data-action="open-switch-flow" onClick={openSwitchFlow} disabled={pending || switchPending}>
          Switch flow
        </Button>
        {switchOpen && (
          <Form className="border rounded p-3 mt-2" onSubmit={submitSwitchFlow}>
            {switchLoading ? <Spinner size="sm" aria-label="Loading available flows" /> : (
              <>
                <FormGroup>
                  <Label for={`switch-flow-${item.kind}-${item.id}`}>Flow</Label>
                  <Input id={`switch-flow-${item.kind}-${item.id}`} type="select" name="flow-id" value={switchFlowId} onChange={(event) => setSwitchFlowId(event.target.value)}>
                    <option value="">Choose a flow</option>
                    {switchFlows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
                  </Input>
                </FormGroup>
                <FormGroup>
                  <Label for={`switch-reason-${item.kind}-${item.id}`}>Reason for switching (required)</Label>
                  <Input id={`switch-reason-${item.kind}-${item.id}`} type="textarea" name="switch-reason" value={switchReason} onChange={(event) => setSwitchReason(event.target.value)} required />
                </FormGroup>
                {!canAct && <p className="text-warning" role="status">Claim this item to work on it</p>}
                <Button type="submit" data-action="switch-flow" disabled={!canAct || !switchFlowId || !switchReason.trim() || switchPending}>
                  {switchPending ? 'Switching…' : 'Switch flow'}
                </Button>
              </>
            )}
          </Form>
        )}
      </div>

      <ItemFlowHistory history={flowState?.history || []} />
    </section>
  );
}

ItemFlowPanel.propTypes = { item: PropTypes.object.isRequired, onChanged: PropTypes.func };

export default ItemFlowPanel;

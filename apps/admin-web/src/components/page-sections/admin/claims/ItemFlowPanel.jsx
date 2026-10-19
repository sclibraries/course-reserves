import PropTypes from 'prop-types';
import { Alert, Button, Spinner } from 'reactstrap';
import { formatFinishState } from '../../../../services/admin/workflowFlows/flowFormatters';
import useItemFlow from '../../../../hooks/admin/useItemFlow';
import useSwitchFlow from '../../../../hooks/admin/useSwitchFlow';
import FlowOutcomeButtons from './flow/FlowOutcomeButtons';
import ItemFlowHistory from './flow/ItemFlowHistory';
import SwitchFlowForm from './flow/SwitchFlowForm';

function ItemFlowPanel({ item, onChanged }) {
  const flow = useItemFlow({ item, onChanged });
  const step = flow.flowState?.current_step?.step;
  const canAct = Boolean(flow.flowState?.can_act);
  const switchFlow = useSwitchFlow({
    item, canAct, onFlowStateChange: flow.replaceFlowState, onChanged, clearItemError: flow.clearError,
  });

  if (flow.loading && !flow.flowState) return <div className="py-2"><Spinner size="sm" aria-label="Loading item flow" /></div>;

  const handleReload = () => {
    flow.clearNotice();
    switchFlow.clearError();
    flow.loadFlow();
  };
  const handleOutcome = (outcome) => {
    switchFlow.clearError();
    flow.handleOutcome(outcome);
  };
  const handleConfirm = () => {
    switchFlow.clearError();
    flow.confirmOutcome();
  };

  return (
    <section className="border rounded p-3" aria-label={`Item flow: ${item.title || item.id}`}>
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div>
          {flow.flowState?.flow && <h3 className="h5 mb-1">{flow.flowState.flow.name} · version {flow.flowState.flow.version}</h3>}
          {step && <h4 className="h6 mb-1">{step.label}</h4>}
          {step?.help_text && <p className="text-muted mb-2">{step.help_text}</p>}
        </div>
        <Button color="outline-secondary" size="sm" aria-label="Reload item flow" onClick={handleReload} disabled={flow.loading}>
          Reload
        </Button>
      </div>

      {(flow.error || switchFlow.error) && <Alert color="danger" role="alert">{flow.error || switchFlow.error}</Alert>}
      {flow.notice && <p className="text-info mb-2" role="status">{flow.notice}</p>}
      {flow.flowState?.flow === null && <p className="mb-2">No flow is set for this material type.</p>}
      {flow.flowState?.finished && (
        <div className="mb-2">
          <p className="mb-1"><strong>Finished: {formatFinishState(flow.flowState.finished.finish_state)}</strong></p>
          {flow.flowState.finished.reason && <p className="mb-0">Reason: {flow.flowState.finished.reason}</p>}
        </div>
      )}

      {step && !flow.flowState?.finished && step.kind !== 'finish' && (
        <FlowOutcomeButtons
          item={item} step={step} canAct={canAct} pending={flow.pending} switchPending={switchFlow.pending}
          selectedOutcome={flow.selectedOutcome} notes={flow.notes} reason={flow.reason}
          onNotesChange={(event) => flow.setNotes(event.target.value)}
          onReasonChange={(event) => flow.setReason(event.target.value)}
          onOutcomeClick={handleOutcome} onConfirm={handleConfirm} onCancel={flow.cancelOutcome}
        />
      )}

      <SwitchFlowForm
        item={item} open={switchFlow.open} loading={switchFlow.loading} flows={switchFlow.flows}
        selectedFlow={switchFlow.selectedFlow} reason={switchFlow.reason} pending={switchFlow.pending}
        canAct={canAct} flowPending={flow.pending} onOpen={switchFlow.openSwitchFlow}
        onFlowChange={(event) => switchFlow.setSelectedFlow(event.target.value)}
        onReasonChange={(event) => switchFlow.setReason(event.target.value)} onSubmit={switchFlow.submitSwitchFlow}
      />
      <ItemFlowHistory history={flow.flowState?.history || []} />
    </section>
  );
}

ItemFlowPanel.propTypes = { item: PropTypes.object.isRequired, onChanged: PropTypes.func };

export default ItemFlowPanel;

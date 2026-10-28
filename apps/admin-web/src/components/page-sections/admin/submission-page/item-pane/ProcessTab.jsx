import PropTypes from 'prop-types';
import { RotateCw } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { formatFinishState } from '../../../../../services/admin/workflowFlows/flowFormatters';
import { getProcessingBlockReason } from '../../../../../services/admin/processingHandoff';
import SwitchFlowDialog from './SwitchFlowDialog';
import AccessPathSection from './AccessPathSection';

function ProcessAction({ item, canWork, onGoToWork, onReopen }) {
  if (item.status === 'complete') {
    return (
      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-border-t tw-pt-3">
        <p className="tw-text-sm tw-font-medium">Complete</p>
        <Button variant="outline" size="sm" onClick={() => onReopen(item.id)}>Reopen for Processing</Button>
      </div>
    );
  }
  if (!canWork) return null;
  const blockReason = getProcessingBlockReason(item);
  if (blockReason) return <p className="tw-border-t tw-pt-3 tw-text-sm tw-text-muted-foreground" role="status">{blockReason}</p>;
  return (
    <div className="tw-border-t tw-pt-3">
      <Button variant="outline" size="sm" onClick={() => onGoToWork(item)}>Work on This</Button>
    </div>
  );
}

ProcessAction.propTypes = {
  item: PropTypes.object.isRequired,
  canWork: PropTypes.bool.isRequired,
  onGoToWork: PropTypes.func.isRequired,
  onReopen: PropTypes.func.isRequired,
};

function ProcessTab({ item, claims, flow, switchFlow, onGoToWork, onReopen, onChanged }) {
  const step = flow.flowState?.current_step?.step;
  const canAct = Boolean(flow.flowState?.can_act);
  const canWork = claims.isMine;
  const claimedByDisplay = item.claimed_by_display || item.assigned_group?.name || item.claimed_by;
  const claimMessage = item.assigned_group?.name
    ? `Assigned to ${item.assigned_group.name}. Claim this item to work on it`
    : 'Claim this item to work on it';

  const reload = () => {
    flow.clearNotice();
    switchFlow.clearError();
    flow.loadFlow();
  };

  return (
    <section className="tw-min-w-0 tw-space-y-4" aria-label={`Process ${item.title}`}>
      {!canWork && item.status !== 'complete' && (
        <div className="tw-space-y-2 tw-rounded-md tw-border tw-bg-muted/30 tw-p-3">
          <div role="status" className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-justify-between tw-gap-3">
            <p className="tw-text-sm tw-font-medium">
              {item.claimed_by ? `Being handled by ${claimedByDisplay || 'another staff member'}` : claimMessage}
            </p>
            {!item.claimed_by && (
              <Button variant="outline" size="sm" disabled={claims.pending} onClick={claims.claim}>
                Claim item
              </Button>
            )}
          </div>
          {!item.claimed_by && claims.error && <p className="tw-text-sm tw-text-destructive" role="alert">{claims.error}</p>}
        </div>
      )}
      <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3">
        <div className="tw-min-w-0">
          {flow.flowState?.flow && (
            <p className="tw-text-sm tw-font-medium">{flow.flowState.flow.name} · version {flow.flowState.flow.version}</p>
          )}
          {step && step.kind !== 'finish' && <h3 className="tw-mt-1 tw-break-words tw-text-lg tw-font-semibold">{step.label}</h3>}
          {step?.help_text && <p className="tw-mt-1 tw-break-words tw-text-sm tw-text-muted-foreground">{step.help_text}</p>}
        </div>
        <Button variant="ghost" size="sm" aria-label="Reload item flow" onClick={reload} disabled={flow.loading}>
          <RotateCw aria-hidden="true" /> Reload
        </Button>
      </div>

      {flow.loading && !flow.flowState && <p className="tw-text-sm tw-text-muted-foreground" role="status">Loading item flow...</p>}
      {(flow.error || switchFlow.error) && <p className="tw-text-sm tw-text-destructive" role="alert">{flow.error || switchFlow.error}</p>}
      {flow.notice && <p className="tw-text-sm tw-text-muted-foreground" role="status">{flow.notice}</p>}

      {flow.flowState?.flow === null && <p className="tw-text-sm">No flow is set for this material type.</p>}
      {flow.flowState?.finished && (
        <div className="tw-space-y-1">
          <p className="tw-text-sm"><strong>Finished: {formatFinishState(flow.flowState.finished.finish_state)}</strong></p>
          {flow.flowState.finished.reason && <p className="tw-break-words tw-text-sm">Reason: {flow.flowState.finished.reason}</p>}
        </div>
      )}
      {flow.flowState?.flow && !flow.flowState.finished && !step && (
        <p className="tw-text-sm"><strong>Not started.</strong> Select a flow to begin processing.</p>
      )}

      {canWork && step && step.kind === 'action' && !flow.flowState?.finished && (
        <div className="tw-space-y-2">
          <Label htmlFor={`flow-notes-${item.kind}-${item.id}`}>Action notes</Label>
          <Textarea
            id={`flow-notes-${item.kind}-${item.id}`}
            value={flow.notes}
            onChange={(event) => flow.setNotes(event.target.value)}
          />
        </div>
      )}
      {canWork && step && step.kind !== 'finish' && !flow.flowState?.finished && (
        <>
          <div className="tw-flex tw-flex-wrap tw-gap-2">
            {(step.outcomes || []).map((outcome, index) => (
              <Button
                key={outcome.key}
                variant={!flow.selectedOutcome && index === 0 ? 'default' : 'outline'}
                disabled={!canAct || flow.pending || switchFlow.pending}
                onClick={() => { switchFlow.clearError(); flow.handleOutcome(outcome); }}
              >
                {outcome.label}
              </Button>
            ))}
          </div>
          {flow.selectedOutcome && (
            <div className="tw-space-y-3 tw-rounded-md tw-border tw-p-3">
              {flow.selectedOutcome.next?.handoff_group && (
                <p className="tw-text-sm" role="status">This hands the item to {flow.selectedOutcome.next.handoff_group}</p>
              )}
              {flow.selectedOutcome.reason_required && (
                <div className="tw-space-y-2">
                  <Label htmlFor={`flow-reason-${item.kind}-${item.id}`}>Reason (required)</Label>
                  <Textarea
                    id={`flow-reason-${item.kind}-${item.id}`}
                    value={flow.reason}
                    onChange={(event) => flow.setReason(event.target.value)}
                    required
                  />
                </div>
              )}
              <div className="tw-flex tw-flex-wrap tw-gap-2">
                <Button
                  disabled={!canAct || flow.pending || (flow.selectedOutcome.reason_required && !flow.reason.trim())}
                  onClick={() => { switchFlow.clearError(); flow.confirmOutcome(); }}
                >
                  Confirm outcome
                </Button>
                <Button variant="outline" onClick={flow.cancelOutcome}>Cancel</Button>
              </div>
            </div>
          )}
        </>
      )}

      <AccessPathSection item={item} canSetPath={canWork} flow={flow} onChanged={onChanged} />

      <div className="tw-border-t tw-pt-3">
        <Button variant="link" className="tw-h-auto tw-p-0" onClick={switchFlow.openSwitchFlow} disabled={flow.pending || switchFlow.pending}>
          Switch flow
        </Button>
      </div>
      <ProcessAction item={item} canWork={canWork} onGoToWork={onGoToWork} onReopen={onReopen} />
      <SwitchFlowDialog item={item} switchFlow={switchFlow} flowPending={flow.pending} />
    </section>
  );
}

ProcessTab.propTypes = {
  item: PropTypes.object.isRequired,
  claims: PropTypes.object.isRequired,
  flow: PropTypes.object.isRequired,
  switchFlow: PropTypes.object.isRequired,
  onGoToWork: PropTypes.func.isRequired,
  onReopen: PropTypes.func.isRequired,
  onChanged: PropTypes.func,
};

export default ProcessTab;

import PropTypes from 'prop-types';
import { Button } from '../../../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';

function SwitchFlowDialog({ item, switchFlow, flowPending }) {
  const submit = (event) => {
    event.preventDefault();
    switchFlow.submitSwitchFlow();
  };

  return (
    <Dialog open={switchFlow.open} onOpenChange={(open) => { if (!open) switchFlow.closeSwitchFlow(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch flow</DialogTitle>
          <DialogDescription>Choose a workflow and explain why it fits this item.</DialogDescription>
        </DialogHeader>
        <form className="tw-space-y-4" onSubmit={submit}>
          {switchFlow.loading ? (
            <p className="tw-text-sm tw-text-muted-foreground" role="status">Loading available flows...</p>
          ) : (
            <>
              <div className="tw-space-y-2">
                <Label htmlFor="switch-flow-select">Flow</Label>
                <select
                  id="switch-flow-select"
                  className="tw-flex tw-h-10 tw-w-full tw-rounded-md tw-border tw-border-input tw-bg-background tw-px-3 tw-py-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-ring focus:tw-ring-offset-2"
                  value={switchFlow.selectedFlow}
                  onChange={(event) => switchFlow.setSelectedFlow(event.target.value)}
                >
                  <option value="">Choose a flow</option>
                  {switchFlow.flows.map((flow) => <option key={flow.id} value={String(flow.id)}>{flow.name}</option>)}
                </select>
              </div>
              <div className="tw-space-y-2">
                <Label htmlFor={`switch-reason-${item.kind}-${item.id}`}>Reason for switching (required)</Label>
                <Textarea
                  id={`switch-reason-${item.kind}-${item.id}`}
                  value={switchFlow.reason}
                  onChange={(event) => switchFlow.setReason(event.target.value)}
                  required
                />
              </div>
            </>
          )}
          {switchFlow.error && <p className="tw-text-sm tw-text-destructive" role="alert">{switchFlow.error}</p>}
          {!switchFlow.canAct && <p className="tw-text-sm tw-text-muted-foreground" role="status">Claim this item to work on it.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={switchFlow.closeSwitchFlow}>Cancel</Button>
            <Button type="submit" disabled={flowPending || switchFlow.pending || switchFlow.loading || !switchFlow.canAct || !switchFlow.selectedFlow || !switchFlow.reason.trim()}>
              {switchFlow.pending ? 'Switching…' : 'Switch flow'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

SwitchFlowDialog.propTypes = {
  item: PropTypes.object.isRequired,
  switchFlow: PropTypes.object.isRequired,
  flowPending: PropTypes.bool.isRequired,
};

export default SwitchFlowDialog;

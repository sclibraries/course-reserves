import PropTypes from 'prop-types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Label } from '../../../../ui/label';
import NativeSelect from '../../../../ui/native-select';
import RequiredReasonForm from '../RequiredReasonForm';

function SwitchFlowDialog({ item, switchFlow, flowPending }) {
  return (
    <Dialog open={switchFlow.open} onOpenChange={(open) => { if (!open) switchFlow.closeSwitchFlow(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch flow</DialogTitle>
          <DialogDescription>Choose a workflow and explain why it fits this item.</DialogDescription>
        </DialogHeader>
        <RequiredReasonForm
          open={switchFlow.open}
          onCancel={switchFlow.closeSwitchFlow}
          onSuccess={switchFlow.closeSwitchFlow}
          onConfirm={switchFlow.submitSwitchFlow}
          saving={flowPending || switchFlow.pending || switchFlow.loading || !switchFlow.canAct || !switchFlow.selectedFlow}
          reasonId={`switch-reason-${item.kind}-${item.id}`}
          reasonLabel="Reason for switching (required)"
          error={switchFlow.error}
          showReason={!switchFlow.loading}
          submitLabel={switchFlow.pending ? 'Switching…' : 'Switch flow'}
        >
          {switchFlow.loading ? (
            <p className="tw-text-sm tw-text-muted-foreground" role="status">Loading available flows...</p>
          ) : (
            <div className="tw-space-y-2">
              <Label htmlFor="switch-flow-select">Flow</Label>
              <NativeSelect
                id="switch-flow-select"
                value={switchFlow.selectedFlow}
                onChange={(event) => switchFlow.setSelectedFlow(event.target.value)}
              >
                <option value="">Choose a flow</option>
                {switchFlow.flows.map((flow) => <option key={flow.id} value={String(flow.id)}>{flow.name}</option>)}
              </NativeSelect>
            </div>
          )}
          {!switchFlow.canAct && <p className="tw-text-sm tw-text-muted-foreground" role="status">Claim this item to work on it.</p>}
        </RequiredReasonForm>
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

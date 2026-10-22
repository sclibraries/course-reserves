import PropTypes from 'prop-types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import RequiredReasonForm from '../RequiredReasonForm';

function TakeoverDialog({ claims, title }) {
  return (
    <Dialog open={claims.takeoverOpen} onOpenChange={(open) => { if (!open) claims.closeTakeover(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take over {title}</DialogTitle>
          <DialogDescription>Enter a reason so the current assignee can see why you took over this item.</DialogDescription>
        </DialogHeader>
        <RequiredReasonForm
          open={claims.takeoverOpen}
          onCancel={claims.closeTakeover}
          onSuccess={claims.closeTakeover}
          onConfirm={claims.submitTakeover}
          saving={claims.pending}
          reasonId="takeover-reason"
          reasonLabel="Reason for taking over (required)"
          error={claims.error}
          submitLabel="Take over item"
        />
      </DialogContent>
    </Dialog>
  );
}

TakeoverDialog.propTypes = {
  claims: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
};

export default TakeoverDialog;

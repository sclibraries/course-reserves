import PropTypes from 'prop-types';
import { Button } from '../../../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';

function TakeoverDialog({ claims, title }) {
  const submit = (event) => {
    event.preventDefault();
    claims.submitTakeover();
  };

  return (
    <Dialog open={claims.takeoverOpen} onOpenChange={(open) => { if (!open) claims.closeTakeover(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take over {title}</DialogTitle>
          <DialogDescription>Enter a reason so the current assignee can see why you took over this item.</DialogDescription>
        </DialogHeader>
        <form className="tw-space-y-4" onSubmit={submit}>
          <div className="tw-space-y-2">
            <Label htmlFor="takeover-reason">Reason for taking over (required)</Label>
            <Textarea
              id="takeover-reason"
              value={claims.takeoverReason}
              onChange={(event) => claims.setTakeoverReason(event.target.value)}
              required
            />
          </div>
          {claims.error && <p className="tw-text-sm tw-text-destructive" role="alert">{claims.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={claims.closeTakeover}>Cancel</Button>
            <Button type="submit" disabled={claims.pending || !claims.takeoverReason.trim()}>Take over item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

TakeoverDialog.propTypes = {
  claims: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
};

export default TakeoverDialog;

import PropTypes from 'prop-types';
import { Button } from '../../../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Label } from '../../../../ui/label';
import NativeSelect from '../../../../ui/native-select';

function HandoffDialog({ claims, title }) {
  const submit = (event) => {
    event.preventDefault();
    claims.submitHandoff();
  };

  return (
    <Dialog open={claims.handoffOpen} onOpenChange={(open) => { if (!open) claims.closeHandoff(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hand off {title}</DialogTitle>
          <DialogDescription>Choose a staff member or group to receive this item.</DialogDescription>
        </DialogHeader>
        <form className="tw-space-y-4" onSubmit={submit}>
          <div className="tw-space-y-2">
            <Label htmlFor="handoff-recipient-type">Recipient type</Label>
            <NativeSelect
              id="handoff-recipient-type"
              value={claims.handoffTargetType}
              onChange={(event) => claims.changeHandoffTargetType(event.target.value)}
            >
              <option value="person">A person</option>
              <option value="group">A group</option>
            </NativeSelect>
          </div>
          {claims.handoffTargetType === 'person' ? (
            <div className="tw-space-y-2">
              <Label htmlFor="handoff-staff">Staff member</Label>
              {claims.staff.loading ? (
                <p className="tw-text-sm tw-text-muted-foreground" role="status">Loading staff...</p>
              ) : (
                <NativeSelect
                  id="handoff-staff"
                  value={claims.toUsername}
                  onChange={(event) => claims.setToUsername(event.target.value)}
                >
                  <option value="">Choose staff</option>
                  {claims.staff.data.map((staff) => <option key={staff.username} value={staff.username}>{staff.display_name}</option>)}
                </NativeSelect>
              )}
            </div>
          ) : (
            <div className="tw-space-y-2">
              <Label htmlFor="handoff-group">Staff group</Label>
              {claims.groups.loading ? (
                <p className="tw-text-sm tw-text-muted-foreground" role="status">Loading groups...</p>
              ) : (
                <NativeSelect
                  id="handoff-group"
                  value={claims.toGroupId}
                  onChange={(event) => claims.setToGroupId(event.target.value)}
                >
                  <option value="">Choose group</option>
                  {claims.groups.data.map((group) => <option key={group.id} value={String(group.id)}>{group.name}</option>)}
                </NativeSelect>
              )}
            </div>
          )}
          {claims.error && <p className="tw-text-sm tw-text-destructive" role="alert">{claims.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={claims.closeHandoff}>Cancel</Button>
            <Button type="submit" disabled={claims.pending || !(claims.handoffTargetType === 'group' ? claims.toGroupId : claims.toUsername)}>
              Send handoff
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

HandoffDialog.propTypes = {
  claims: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
};

export default HandoffDialog;

import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { notify } from '../../../../../services/notify';

export const ApplyItemDatesButton = ({
  sourceType,
  hasItemDates,
  customWindowCount,
  linkCount,
  onApply,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState('');
  const buttonRef = useRef(null);
  let disabledReason = null;
  if (sourceType === 'reuse') disabledReason = 'Item dates cannot be applied while reusing a resource.';
  else if (!hasItemDates) disabledReason = 'Set at least one item date before applying dates to additional links.';

  const applyDates = () => {
    onApply();
    const message = `Item dates applied to ${linkCount} ${linkCount === 1 ? 'link' : 'links'}`;
    setStatus(message);
    notify.success(message);
    setIsOpen(false);
  };
  const handleClick = () => {
    if (customWindowCount) setIsOpen(true);
    else applyDates();
  };

  return (
    <div className="tw-space-y-2">
      <Button
        ref={buttonRef}
        type="button"
        disabled={Boolean(disabledReason)}
        aria-describedby={disabledReason ? 'apply-item-dates-reason' : undefined}
        onClick={handleClick}
      >
        Apply item dates to additional links
      </Button>
      {disabledReason && <p id="apply-item-dates-reason" className="tw-text-sm tw-text-muted-foreground">{disabledReason}</p>}
      {status && <p role="status" className="tw-text-sm">{status}</p>}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent onCloseAutoFocus={(event) => {
          event.preventDefault();
          buttonRef.current?.focus();
        }}>
          <DialogHeader>
            <DialogTitle>Apply item dates to additional links?</DialogTitle>
            <DialogDescription>
              This will overwrite {customWindowCount} custom date window{customWindowCount === 1 ? '' : 's'}
              {' '}and update all {linkCount} additional links.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="button" onClick={applyDates}>Apply dates</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

ApplyItemDatesButton.propTypes = {
  sourceType: PropTypes.string.isRequired,
  hasItemDates: PropTypes.bool.isRequired,
  customWindowCount: PropTypes.number.isRequired,
  linkCount: PropTypes.number.isRequired,
  onApply: PropTypes.func.isRequired,
};

export default ApplyItemDatesButton;

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../../../ui/button';
import { DialogFooter } from '../../../ui/dialog';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';

function RequiredReasonForm({
  open,
  onCancel,
  onSuccess = onCancel,
  onConfirm,
  saving,
  reasonId,
  reasonLabel,
  error,
  showReason = true,
  helpText,
  submitLabel,
  submitVariant = 'default',
  cancelLabel = 'Cancel',
  multiline = true,
  className = 'tw-space-y-4',
  children,
}) {
  const [reason, setReason] = useState('');
  const ReasonInput = multiline ? Textarea : Input;

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason || saving) return;
    if (await onConfirm(trimmedReason)) onSuccess();
  };

  if (!open) return null;

  return (
    <form onSubmit={submit} className={className}>
      {children}
      {showReason && (
        <div className="tw-space-y-2">
          <Label htmlFor={reasonId}>{reasonLabel}</Label>
          <ReasonInput
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            aria-describedby={[
              helpText && `${reasonId}-help`,
              error && `${reasonId}-error`,
            ].filter(Boolean).join(' ') || undefined}
          />
          {helpText && <p id={`${reasonId}-help`} className="tw-text-sm tw-text-muted-foreground">{helpText}</p>}
        </div>
      )}
      {error && <p id={`${reasonId}-error`} className="tw-text-sm tw-text-destructive" role="alert">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button>
        <Button type="submit" variant={submitVariant} disabled={saving || !reason.trim()}>{submitLabel}</Button>
      </DialogFooter>
    </form>
  );
}

RequiredReasonForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  onConfirm: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  reasonId: PropTypes.string.isRequired,
  reasonLabel: PropTypes.string.isRequired,
  error: PropTypes.node,
  showReason: PropTypes.bool,
  helpText: PropTypes.string,
  submitLabel: PropTypes.string.isRequired,
  submitVariant: PropTypes.oneOf(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']),
  cancelLabel: PropTypes.string,
  multiline: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default RequiredReasonForm;

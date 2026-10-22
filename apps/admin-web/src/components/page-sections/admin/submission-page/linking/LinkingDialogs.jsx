import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert } from '../../../../ui/alert';
import { Button } from '../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';

function MismatchLinkDialog({ open, onOpenChange, candidate, error, saving, onConfirm, returnFocusRef }) {
  const [reason, setReason] = useState('');
  const candidateName = candidate?.courses?.map((course) => course.name || course.courseNumber).filter(Boolean).join(' / ');

  useEffect(() => { if (!open) setReason(''); }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) return;
    if (await onConfirm(reason.trim())) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw-max-w-lg" onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocusRef.current?.focus();
      }}>
        <DialogHeader>
          <DialogTitle>Link with mismatch</DialogTitle>
          <DialogDescription>
            {candidateName ? `Explain why ${candidateName} should be linked to this submission.` : 'Explain why this FOLIO course should be linked to this submission.'}
          </DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive">{error}</Alert>}
        <form onSubmit={submit} className="tw-space-y-4">
          <div className="tw-space-y-2">
            <Label htmlFor="mismatch-link-reason">Reason for linking with a mismatch (required)</Label>
            <Textarea
              id="mismatch-link-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              aria-describedby="mismatch-link-reason-help"
            />
            <p id="mismatch-link-reason-help" className="tw-text-sm tw-text-muted-foreground">
              Record why this course is the right match despite the differences.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !reason.trim()}>Confirm link</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

MismatchLinkDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  candidate: PropTypes.object,
  error: PropTypes.string,
  saving: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  returnFocusRef: PropTypes.object.isRequired,
};

function CorrectSubmissionDialog({ open, onOpenChange, submission, error, saving, onConfirm, returnFocusRef }) {
  const [courseCode, setCourseCode] = useState(submission.courseCode || '');
  const [section, setSection] = useState(submission.section || '');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setCourseCode(submission.courseCode || '');
    setSection(submission.section || '');
    setReason('');
  }, [open, submission.courseCode, submission.section]);

  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) return;
    if (await onConfirm(courseCode, section, reason.trim())) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw-max-w-lg" onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocusRef.current?.focus();
      }}>
        <DialogHeader>
          <DialogTitle>Correct submission</DialogTitle>
          <DialogDescription>Update the roster course details. The term comes from the roster and cannot be changed here.</DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive">{error}</Alert>}
        <form onSubmit={submit} className="tw-space-y-4">
          <div className="tw-space-y-2">
            <Label htmlFor="correct-course-code">Course number</Label>
            <Input id="correct-course-code" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} />
          </div>
          <div className="tw-space-y-2">
            <Label htmlFor="correct-section">Section</Label>
            <Input id="correct-section" value={section} onChange={(event) => setSection(event.target.value)} />
          </div>
          <div className="tw-space-y-2">
            <Label htmlFor="correct-reason">Reason (required)</Label>
            <Textarea id="correct-reason" value={reason} onChange={(event) => setReason(event.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !reason.trim()}>Save correction</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

CorrectSubmissionDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  submission: PropTypes.object.isRequired,
  error: PropTypes.string,
  saving: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  returnFocusRef: PropTypes.object.isRequired,
};

export { CorrectSubmissionDialog, MismatchLinkDialog };

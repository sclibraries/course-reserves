import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert } from '../../../../ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import RequiredReasonForm from './RequiredReasonForm';

function MismatchLinkDialog({ open, onOpenChange, candidate, error, saving, onConfirm, returnFocusRef }) {
  const candidateName = candidate?.courses?.map((course) => course.name || course.courseNumber).filter(Boolean).join(' / ');

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
        <RequiredReasonForm
          open={open}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
          saving={saving}
          reasonId="mismatch-link-reason"
          reasonLabel="Reason for linking with a mismatch (required)"
          helpText="Record why this course is the right match despite the differences."
          submitLabel="Confirm link"
        />
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

  useEffect(() => {
    if (!open) return;
    setCourseCode(submission.courseCode || '');
    setSection(submission.section || '');
  }, [open, submission.courseCode, submission.section]);

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
        <RequiredReasonForm
          open={open}
          onCancel={() => onOpenChange(false)}
          onConfirm={(reason) => onConfirm(courseCode, section, reason)}
          saving={saving}
          reasonId="correct-reason"
          reasonLabel="Reason (required)"
          submitLabel="Save correction"
        >
          <div className="tw-space-y-2">
            <Label htmlFor="correct-course-code">Course number</Label>
            <Input id="correct-course-code" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} />
          </div>
          <div className="tw-space-y-2">
            <Label htmlFor="correct-section">Section</Label>
            <Input id="correct-section" value={section} onChange={(event) => setSection(event.target.value)} />
          </div>
        </RequiredReasonForm>
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

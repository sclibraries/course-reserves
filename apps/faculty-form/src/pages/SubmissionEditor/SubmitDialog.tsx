import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSubmissionEditorContext } from './SubmissionEditorContext';

interface SubmitDialogProps {
  showSubmitDialog: boolean;
  setShowSubmitDialog: (v: boolean) => void;
  emailConfirmation: boolean;
  setEmailConfirmation: (v: boolean) => void;
}

export default function SubmitDialog({
  showSubmitDialog,
  setShowSubmitDialog,
  emailConfirmation,
  setEmailConfirmation,
}: SubmitDialogProps) {
  const { reserve, isEditingSubmission, submissionHandlers, isReadOnly, submitButtonRef } = useSubmissionEditorContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (showSubmitDialog) setSubmitError(null);
  }, [showSubmitDialog]);

  const handleSubmit = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isSubmitting || isReadOnly) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submissionHandlers.confirmSubmit(emailConfirmation);
      if (result.success) setShowSubmitDialog(false);
      else setSubmitError(result.message);
    } catch {
      setSubmitError("Couldn't submit this reserve request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={showSubmitDialog}
      onOpenChange={(open) => { if (!isSubmitting) setShowSubmitDialog(open); }}
    >
      <AlertDialogContent onCloseAutoFocus={(event) => {
        event.preventDefault();
        submitButtonRef.current?.focus();
      }}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isEditingSubmission ? 'Update Submission?' : 'Submit to Library?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isEditingSubmission ? (
              <>
                You are updating your submission for {reserve.courseCode} · {reserve.term}. This will replace
                the current submission with {reserve.items.length} items
                {reserve.folders.length > 0 &&
                  ` organized in ${reserve.folders.length} folder${reserve.folders.length > 1 ? 's' : ''}`}
                .
              </>
            ) : (
              <>
                You are submitting {reserve.items.length} items for {reserve.courseCode} · {reserve.term}.
                You will be able to edit your course until a staff member locks the course for processing.
              </>
            )}
          </AlertDialogDescription>
          {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
          {!isEditingSubmission && (
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="email"
                checked={emailConfirmation}
                onCheckedChange={(checked) => setEmailConfirmation(checked as boolean)}
              />
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email me a confirmation
              </label>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isReadOnly || isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? 'Submitting...' : isEditingSubmission ? 'Update' : 'Submit'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
  const { reserve, isEditingSubmission, submissionHandlers, isReadOnly } = useSubmissionEditorContext();

  return (
    <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
      <AlertDialogContent>
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
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isReadOnly} onClick={() => submissionHandlers.confirmSubmit(emailConfirmation)}>
            {isEditingSubmission ? 'Update' : 'Submit'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

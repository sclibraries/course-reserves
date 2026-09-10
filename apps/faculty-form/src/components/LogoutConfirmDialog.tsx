import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LogoutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmLogout: () => void;
  onSaveAndLogout: () => Promise<void>;
  hasUnsavedChanges: boolean;
  isSaving?: boolean;
}

export function LogoutConfirmDialog({
  open,
  onOpenChange,
  onConfirmLogout,
  onSaveAndLogout,
  hasUnsavedChanges,
  isSaving = false,
}: LogoutConfirmDialogProps) {
  if (!hasUnsavedChanges) {
    // If no unsaved changes, just show simple confirmation
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmLogout}>
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // If there are unsaved changes, show warning with save option
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You have unsaved changes in your course reserves. 
              If you log out without saving, these changes will be lost.
            </p>
            <p className="font-medium text-foreground">
              What would you like to do?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmLogout}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Logout Without Saving
          </AlertDialogAction>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              await onSaveAndLogout();
            }}
            disabled={isSaving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSaving ? 'Saving...' : 'Save & Logout'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

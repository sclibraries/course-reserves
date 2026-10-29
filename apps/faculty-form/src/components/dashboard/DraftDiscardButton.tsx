import { useState } from 'react';
import { getSafeErrorFeedback, notify } from '@/services/notify';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { discardDraft } from '@/services/api/facultyDraftApi';
import { useDraftStore } from '@/store/draftStore';
import { useReserveStore } from '@/store/useReserveStore';

export function DraftDiscardButton({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const handleDiscard = async (event: React.MouseEvent) => {
    event.preventDefault();
    setIsDiscarding(true);
    const reserve = useReserveStore.getState().getReserveById(submissionId);
    const uuid = reserve?.submissionUuid || (!submissionId.startsWith('reserve-') ? submissionId : undefined);

    try {
      if (uuid) await discardDraft(uuid);
      useReserveStore.getState().deleteReserve(submissionId);
      useDraftStore.getState().deleteDraft(submissionId);
      notify.success('Draft discarded');
      setOpen(false);
    } catch (error) {
      console.error('Failed to discard faculty draft:', error);
      const feedback = getSafeErrorFeedback(error, "Couldn't discard this draft");
      notify.error(feedback.message, { reference: feedback.reference });
    } finally {
      setIsDiscarding(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">Discard draft</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the draft and its saved materials from your course reserves.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDiscarding}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isDiscarding} onClick={(event) => void handleDiscard(event)}>
            {isDiscarding ? 'Discarding…' : 'Discard draft'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

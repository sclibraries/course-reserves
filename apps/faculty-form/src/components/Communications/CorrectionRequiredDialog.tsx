import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CommunicationsAPI } from '@/services/api/communications';
import { buildCorrectionSummary } from '@/services/submissionUpdateErrors';
import { useEditorUIStore } from '@/store/useEditorUIStore';

const CorrectionRequiredDialog = () => {
  const open = useEditorUIStore((state) => state.correctionRequiredDialogOpen);
  const detail = useEditorUIStore((state) => state.correctionRequiredDetail);
  const closeDialog = useEditorUIStore((state) => state.closeCorrectionRequiredDialog);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const summary = detail ? buildCorrectionSummary(detail) : '';

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSendError(null);
      closeDialog();
    }
  };

  const handleSend = async () => {
    if (!detail || detail.itemIds.length === 0) return;
    setSending(true);
    setSendError(null);
    try {
      const result = await new CommunicationsAPI().createMessage(detail.submissionUuid, {
        subject: 'Requested correction to processed reserve item',
        category: 'issue',
        priority: 'normal',
        resource_id: detail.itemIds[0],
        message: summary,
      });
      if (!result.success) throw new Error('Message was not saved.');
      toast.success('Correction request sent to library staff.');
      closeDialog();
    } catch {
      setSendError('Your correction request could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact library staff about your changes</DialogTitle>
          <DialogDescription>
            These reserve items have already been processed and must be corrected by library staff.
          </DialogDescription>
        </DialogHeader>
        <p className="whitespace-pre-line rounded-md bg-muted p-3 text-sm">{summary}</p>
        {sendError && <p role="alert" className="text-sm text-destructive">{sendError}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
            Close
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending || !detail || detail.itemIds.length === 0}>
            {sending ? 'Sending…' : 'Send to library staff'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CorrectionRequiredDialog;

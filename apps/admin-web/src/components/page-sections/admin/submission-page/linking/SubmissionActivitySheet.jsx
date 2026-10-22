import { useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../../../../ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../../ui/sheet';
import WorkflowTimeline from '../../linking/WorkflowTimeline';

function SubmissionActivitySheet({ linking }) {
  const [open, setOpen] = useState(false);
  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) linking.loadTimeline();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="link" className="tw-h-auto tw-p-0">Activity</Button>
      </SheetTrigger>
      <SheetContent side="right" className="tw-w-full tw-overflow-y-auto sm:tw-max-w-xl">
        <SheetHeader>
          <SheetTitle>Submission activity</SheetTitle>
          <SheetDescription>Workflow changes recorded for this submission.</SheetDescription>
        </SheetHeader>
        <div className="tw-mt-6">
          {linking.timelineLoading ? (
            <p role="status" className="tw-text-sm tw-text-muted-foreground">Loading activity…</p>
          ) : (
            <WorkflowTimeline events={linking.timeline} error={linking.timelineError} title="Activity timeline" id="submission-activity-timeline" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

SubmissionActivitySheet.propTypes = { linking: PropTypes.object.isRequired };

export default SubmissionActivitySheet;

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Alert } from '../../../../ui/alert';
import { Button } from '../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import LinkingComparison from './LinkingComparison';
import RequiredReasonForm from '../RequiredReasonForm';

function ChangeLinkedCourseDialog({ open, onOpenChange, submission, linking, returnFocusRef }) {
  const { clearError } = linking;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState(submission.courseCode || '');
  const [unlinkOpen, setUnlinkOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearchText(submission.courseCode || '');
    setUnlinkOpen(false);
    setSearchOpen(false);
    clearError();
  }, [clearError, open, submission.courseCode]);

  const submitSearch = (event) => {
    event.preventDefault();
    linking.searchCandidates(searchText);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="tw-max-h-[90vh] tw-max-w-2xl tw-overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Change linked course</DialogTitle>
          <DialogDescription>Review the linked FOLIO course, re-check its match, search, or unlink it with a reason.</DialogDescription>
        </DialogHeader>

        {linking.error && <Alert variant="destructive">{linking.error}</Alert>}
        {linking.currentCandidate ? (
          <LinkingComparison submission={submission} candidate={linking.currentCandidate} />
        ) : (
          <p className="tw-text-sm tw-text-muted-foreground">Linked FOLIO course details are not in the current results. Search to load course details.</p>
        )}

        <div className="tw-flex tw-flex-wrap tw-gap-2">
          <Button variant="outline" disabled={linking.saving} onClick={linking.actions.recheck}>Re-check</Button>
          <Button variant="ghost" disabled={linking.saving} onClick={() => setSearchOpen((value) => !value)}>Search FOLIO</Button>
          {submission.folioCourseListingId && (
            <Button asChild variant="link" className="tw-h-auto tw-px-2">
              <Link to={`/admin/electronic/${submission.folioCourseListingId}`}>Open course page</Link>
            </Button>
          )}
        </div>

        {searchOpen && (
          <form onSubmit={submitSearch} className="tw-space-y-2 tw-rounded-md tw-border tw-p-3">
            <Label htmlFor="linked-folio-course-query">Search FOLIO by course number or title</Label>
            <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-gap-2">
              <Input id="linked-folio-course-query" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
              <Button type="submit" variant="outline" disabled={linking.candidateLoading}>Search</Button>
            </div>
          </form>
        )}

        {linking.isPublished ? (
          <p role="status" className="tw-text-sm tw-text-muted-foreground">Unlink is unavailable after items have been published.</p>
        ) : (
          <div className="tw-space-y-3">
            {!unlinkOpen ? (
              <Button variant="ghost" disabled={linking.saving} onClick={() => setUnlinkOpen(true)}>Unlink</Button>
            ) : (
              <RequiredReasonForm
                open={unlinkOpen}
                onCancel={() => setUnlinkOpen(false)}
                onSuccess={() => onOpenChange(false)}
                onConfirm={linking.actions.unlink}
                saving={linking.saving}
                reasonId="unlink-reason"
                reasonLabel="Reason for unlinking (required)"
                submitLabel="Confirm unlink"
                submitVariant="destructive"
                multiline={false}
                className="tw-space-y-3 tw-rounded-md tw-border tw-p-3"
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

ChangeLinkedCourseDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  submission: PropTypes.object.isRequired,
  linking: PropTypes.object.isRequired,
  returnFocusRef: PropTypes.object.isRequired,
};

export default ChangeLinkedCourseDialog;

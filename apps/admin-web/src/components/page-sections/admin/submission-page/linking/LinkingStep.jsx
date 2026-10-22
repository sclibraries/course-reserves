import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Card } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Alert } from '../../../../ui/alert';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { getCandidateFieldMatches } from '../../../../../services/admin/linkingFormatters';
import LinkingComparison from './LinkingComparison';
import { CorrectSubmissionDialog, MismatchLinkDialog } from './LinkingDialogs';
import { formatCheckedRelative, getCandidateMatchLabel } from './linkingPresentation';

function CandidateCard({ candidate, selected, onSelect, matches }) {
  const courseNames = candidate.courses?.map((course) => course.name || course.courseNumber).filter(Boolean);
  const courseNumbers = candidate.courses?.map((course) => [course.courseNumber, course.sectionName].filter(Boolean).join(' · ')).filter(Boolean);
  const matchLabel = getCandidateMatchLabel(candidate, matches);

  return (
    <Card className={selected ? 'tw-border-primary tw-bg-accent/40' : ''}>
      <button
        type="button"
        aria-pressed={selected}
        className="tw-flex tw-min-h-16 tw-w-full tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-rounded-lg tw-p-3 tw-text-left focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring focus-visible:tw-ring-offset-2"
        onClick={onSelect}
      >
        <span className="tw-min-w-0 tw-break-words">
          <span className="tw-block tw-font-medium">{courseNames?.join(' / ') || candidate.folio_course_listing_id}</span>
          <span className="tw-block tw-text-sm tw-text-muted-foreground">
            {[courseNumbers?.join(' / '), candidate.term?.name].filter(Boolean).join(' · ') || 'Course details unavailable'}
          </span>
        </span>
        <Badge variant={matchLabel === 'Exact match' ? 'default' : 'secondary'}>{matchLabel}</Badge>
      </button>
    </Card>
  );
}

CandidateCard.propTypes = {
  candidate: PropTypes.object.isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  matches: PropTypes.object.isRequired,
};

function LinkingStep({ submission, linking }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState(submission.courseCode || '');
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const overrideTriggerRef = useRef(null);
  const correctTriggerRef = useRef(null);

  useEffect(() => { setSearchText(submission.courseCode || ''); }, [submission.courseCode]);

  const submitSearch = (event) => {
    event.preventDefault();
    linking.searchCandidates(searchText);
  };
  const openDialog = (setOpen) => {
    linking.clearError();
    setOpen(true);
  };
  const closeDialog = (setOpen) => (open) => {
    setOpen(open);
    if (!open) linking.clearError();
  };
  const exactMatch = linking.canLink;
  const showError = !overrideOpen && !correctOpen;

  return (
    <div className="tw-min-w-0 tw-space-y-5">
      <div>
        <p className="tw-text-sm tw-font-medium tw-text-primary">Step 1 · Link the course</p>
        <h2 className="tw-mt-1 tw-text-xl tw-font-semibold">Choose the FOLIO course for this submission</h2>
      </div>

      {showError && linking.error && <Alert variant="destructive">{linking.error}</Alert>}
      {linking.candidateLoading && <p role="status" className="tw-text-sm tw-text-muted-foreground">Loading FOLIO candidates…</p>}

      {linking.selectedCandidate && (
        <section aria-labelledby="linking-comparison-title" className="tw-min-w-0 tw-space-y-2">
          <h3 id="linking-comparison-title" className="tw-text-base tw-font-medium">Course comparison</h3>
          <LinkingComparison submission={submission} candidate={linking.selectedCandidate} />
        </section>
      )}

      <section aria-labelledby="folio-candidates-title" className="tw-min-w-0 tw-space-y-2">
        <h3 id="folio-candidates-title" className="tw-text-base tw-font-medium">FOLIO candidates</h3>
        {linking.candidates.length > 0 ? (
          <ul className="tw-grid tw-min-w-0 tw-gap-2">
            {linking.candidates.map((candidate) => {
              const matches = getCandidateFieldMatches(submission, candidate);
              return (
                <li key={candidate.folio_course_listing_id}>
                  <CandidateCard
                    candidate={candidate}
                    matches={matches}
                    selected={String(candidate.folio_course_listing_id) === linking.selectedId}
                    onSelect={() => linking.selectCandidate(String(candidate.folio_course_listing_id))}
                  />
                </li>
              );
            })}
          </ul>
        ) : !linking.candidateLoading ? (
          <p className="tw-text-sm tw-text-muted-foreground">No FOLIO courses found. Search again or correct the submission.</p>
        ) : null}
      </section>

      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
        <Button
          ref={overrideTriggerRef}
          disabled={!linking.selectedCandidate || linking.saving || linking.candidateLoading}
          onClick={() => (exactMatch ? linking.actions.link() : openDialog(setOverrideOpen))}
        >
          {exactMatch ? 'Link course' : 'Link with mismatch'}
        </Button>
        <Button variant="ghost" disabled={linking.saving} onClick={() => setSearchOpen((open) => !open)}>Search FOLIO</Button>
        <Button ref={correctTriggerRef} variant="ghost" disabled={linking.saving} onClick={() => openDialog(setCorrectOpen)}>Correct submission</Button>
      </div>

      {searchOpen && (
        <form onSubmit={submitSearch} className="tw-space-y-2 tw-rounded-md tw-border tw-p-3">
          <Label htmlFor="folio-course-query">Search FOLIO by course number or title</Label>
          <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-gap-2">
            <Input id="folio-course-query" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
            <Button type="submit" variant="outline" disabled={linking.candidateLoading}>Search</Button>
          </div>
        </form>
      )}

      <p className="tw-flex tw-flex-wrap tw-items-center tw-gap-1 tw-text-sm tw-text-muted-foreground">
        <span>{formatCheckedRelative(linking.checkedAt)}</span>
        <span aria-hidden="true">·</span>
        <Button variant="link" className="tw-h-auto tw-p-0" disabled={linking.saving} onClick={linking.actions.recheck}>Re-check</Button>
      </p>

      <MismatchLinkDialog
        open={overrideOpen}
        onOpenChange={closeDialog(setOverrideOpen)}
        candidate={linking.selectedCandidate}
        error={linking.error}
        saving={linking.saving}
        onConfirm={linking.actions.override}
        returnFocusRef={overrideTriggerRef}
      />
      <CorrectSubmissionDialog
        open={correctOpen}
        onOpenChange={closeDialog(setCorrectOpen)}
        submission={submission}
        error={linking.error}
        saving={linking.saving}
        onConfirm={linking.actions.correct}
        returnFocusRef={correctTriggerRef}
      />
    </div>
  );
}

LinkingStep.propTypes = {
  submission: PropTypes.object.isRequired,
  linking: PropTypes.object.isRequired,
};

export default LinkingStep;

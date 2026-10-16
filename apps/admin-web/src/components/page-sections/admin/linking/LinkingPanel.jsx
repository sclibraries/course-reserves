import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card, CardBody, Form, Input, Label, Spinner } from 'reactstrap';
import { submissionWorkflowService } from '../../../../services/admin/submissionWorkflowService';
import {
  getCandidateFieldMatches,
  getLinkingErrorMessage,
  submissionHasPublishedItems,
} from '../../../../services/admin/linkingFormatters';
import LinkingComparison from './LinkingComparison';
import WorkflowTimeline from './WorkflowTimeline';
import './linking.css';

const candidateId = (candidate) => candidate.folio_course_listing_id;
const candidateMatches = {
  exact: { label: 'Exact', color: 'success' },
  possible: { label: 'Possible', color: 'warning' },
  none: { label: 'Mismatch', color: 'secondary' },
};

function LinkingPanel({ submission, items = [], onChanged = () => {} }) {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [checkedAt, setCheckedAt] = useState(null);
  const [events, setEvents] = useState([]);
  const [candidateLoading, setCandidateLoading] = useState(true);
  const [timelineError, setTimelineError] = useState('');
  const [candidateError, setCandidateError] = useState('');
  const [actionError, setActionError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState(submission.courseCode || '');
  const [activeQuery, setActiveQuery] = useState('');
  const [correctOpen, setCorrectOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [courseCode, setCourseCode] = useState(submission.courseCode || '');
  const [section, setSection] = useState(submission.section || '');
  const [correctReason, setCorrectReason] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [unlinkReason, setUnlinkReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCandidates = useCallback(async (query = '') => {
    setCandidateLoading(true);
    setCandidateError('');
    try {
      const result = await submissionWorkflowService.getCandidates(submission.uuid, query || undefined);
      const found = result.items || [];
      setCandidates(found);
      setCheckedAt(result.checked_at || null);
      setSelectedId((previous) => found.some((item) => candidateId(item) === previous)
        ? previous
        : candidateId(found.find((item) => item.match === 'exact') || found[0] || {}));
    } catch (error) {
      setCandidateError(error.message || 'Could not load FOLIO candidates.');
    } finally {
      setCandidateLoading(false);
    }
  }, [submission.uuid]);

  const loadTimeline = useCallback(async () => {
    setTimelineError('');
    try {
      const result = await submissionWorkflowService.getTimeline(submission.uuid);
      setEvents(result.items || []);
    } catch (error) {
      setTimelineError(error.message || 'Could not load the workflow timeline.');
    }
  }, [submission.uuid]);

  useEffect(() => {
    loadCandidates();
    loadTimeline();
  }, [loadCandidates, loadTimeline]);

  const selectedCandidate = candidates.find((candidate) => candidateId(candidate) === selectedId) || null;
  const fieldMatches = selectedCandidate ? getCandidateFieldMatches(submission, selectedCandidate) : null;
  const canLink = Boolean(selectedCandidate
    && selectedCandidate.match === 'exact'
    && fieldMatches?.courseNumber
    && fieldMatches?.section
    && fieldMatches?.term === true);
  const isLinked = Boolean(submission.linkState === 'linked' || submission.folioCourseListingId);
  const isPublished = submissionHasPublishedItems(items);

  const runAction = async (action, request) => {
    setActionError('');
    setSaving(true);
    try {
      await request();
      await Promise.all([loadCandidates(activeQuery), loadTimeline()]);
      await onChanged();
    } catch (error) {
      setActionError(getLinkingErrorMessage(error, action));
    } finally {
      setSaving(false);
    }
  };

  const handleLink = () => runAction('link', () => submissionWorkflowService.linkSubmission(
    submission.uuid,
    { folio_course_listing_id: candidateId(selectedCandidate) },
  ));

  const handleCorrect = (event) => {
    event.preventDefault();
    if (!correctReason.trim()) return;
    runAction('correct', () => submissionWorkflowService.correctSubmission(submission.uuid, {
      course_code: courseCode.trim(),
      section: section.trim(),
      reason: correctReason.trim(),
    }));
  };

  const handleOverride = (event) => {
    event.preventDefault();
    if (!selectedCandidate || !overrideReason.trim()) return;
    runAction('override', () => submissionWorkflowService.overrideSubmissionLink(submission.uuid, {
      folio_course_listing_id: candidateId(selectedCandidate),
      reason: overrideReason.trim(),
    }));
  };

  const handleUnlink = (event) => {
    event.preventDefault();
    if (!unlinkReason.trim()) return;
    runAction('unlink', () => submissionWorkflowService.unlinkSubmission(submission.uuid, {
      reason: unlinkReason.trim(),
    }));
  };

  const handleRecheck = () => runAction('recheck', () => submissionWorkflowService.recheckSubmission(submission.uuid));
  const handleSearch = () => {
    setActiveQuery(searchText.trim());
    loadCandidates(searchText.trim());
  };
  const termText = submission.termCode || submission.term || '';
  const currentCandidate = candidates.find(
    (candidate) => candidateId(candidate) === submission.folioCourseListingId,
  );

  return (
    <Card className="linking-panel mb-4 shadow-sm">
      <CardBody>
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h2 className="h4 mb-1">Course linking</h2>
            <p className="text-muted mb-0">Confirm the roster course against its FOLIO course listing.</p>
          </div>
          {isLinked && (
            <div className="d-flex flex-wrap gap-2">
              {submission.linkFlag === 'mismatch_override'
                ? <Badge color="warning" className="text-dark">Linked with mismatch</Badge>
                : <Badge color="success">Linked</Badge>}
              <Button
                color="outline-primary"
                size="sm"
                onClick={() => navigate(`/admin/electronic/${submission.folioCourseListingId}`)}
                disabled={!submission.folioCourseListingId}
              >
                Open course page
              </Button>
            </div>
          )}
        </div>

        {submission.linkedBy && <p className="small text-muted">Linked by {submission.linkedBy}{submission.linkedAt ? ` on ${new Date(submission.linkedAt).toLocaleString()}` : ''}</p>}
        {candidateError && <Alert color="danger" role="alert">{candidateError}</Alert>}
        {actionError && <Alert color="danger" role="alert">{actionError}</Alert>}
        {candidateLoading && <div className="py-3"><Spinner size="sm" className="me-2" />Loading FOLIO candidates...</div>}

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <h3 className="h6">Roster course</h3>
            <dl className="row mb-0">
              <dt className="col-sm-4">Course</dt><dd className="col-sm-8">{submission.courseCode || '—'}</dd>
              <dt className="col-sm-4">Section</dt><dd className="col-sm-8">{submission.section || '—'}</dd>
              <dt className="col-sm-4">Term</dt><dd className="col-sm-8">{termText || 'Term unverified'}</dd>
            </dl>
          </div>
          <div className="col-md-6">
            <h3 className="h6">Selected FOLIO candidate</h3>
            {selectedCandidate
              ? <p className="mb-0">{selectedCandidate.courses?.map((course) => course.name || course.courseNumber).filter(Boolean).join(' / ') || candidateId(selectedCandidate)}<br />{selectedCandidate.term?.name || 'Term unavailable'}</p>
              : <p className="text-muted mb-0">No candidate selected</p>}
          </div>
        </div>

        {selectedCandidate && <LinkingComparison submission={submission} candidate={selectedCandidate} />}
        {currentCandidate && isLinked && currentCandidate.match !== 'exact' && (
          <Alert color="warning" className="mt-3">This course is linked with a mismatch.</Alert>
        )}

        <div className="d-flex flex-wrap gap-2 mt-3">
          {!isLinked && (
            <Button color="primary" disabled={!canLink || saving || candidateLoading} onClick={handleLink}>Link</Button>
          )}
          <Button color="outline-secondary" disabled={saving} onClick={handleRecheck}>Re-check</Button>
          <Button color="outline-secondary" disabled={saving} onClick={() => setSearchOpen((open) => !open)}>Search FOLIO</Button>
          {!isLinked && (
            <Button color="outline-secondary" disabled={saving} onClick={() => setCorrectOpen((open) => !open)}>Correct submission</Button>
          )}
          {!isLinked && selectedCandidate && !canLink && (
            <Button color="outline-warning" disabled={saving} onClick={() => setOverrideOpen((open) => !open)}>Link anyway</Button>
          )}
          {isLinked && (
            <Button color="outline-danger" disabled={saving || isPublished} title={isPublished ? 'Unlink is unavailable after items are published.' : ''} onClick={() => setUnlinkOpen((open) => !open)}>Unlink</Button>
          )}
        </div>
        {isLinked && isPublished && (
          <Alert color="warning" className="mt-2 mb-0">Unlink is unavailable after items are published.</Alert>
        )}

        {searchOpen && (
          <Form className="border rounded p-3 mt-3" onSubmit={(event) => { event.preventDefault(); handleSearch(); }}>
            <Label for="folio-course-query">Search by course number or title</Label>
            <div className="d-flex gap-2">
              <Input id="folio-course-query" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
              <Button type="submit" color="secondary" disabled={candidateLoading}>Search</Button>
            </div>
            <div className="mt-2">
              <Label for="folio-course-term">Term (pre-filled)</Label>
              <Input id="folio-course-term" value={termText || 'Term unverified'} readOnly />
            </div>
          </Form>
        )}

        {candidates.length > 0 && !candidateLoading && (
          <fieldset className="mt-3">
            <legend className="h6">FOLIO candidates</legend>
            {candidates.map((candidate) => {
              const match = candidateMatches[candidate.match] || candidateMatches.none;
              return (
                <Label key={candidateId(candidate)} className="linking-candidate d-flex align-items-center gap-2 border rounded p-2 mb-2">
                  <Input
                    type="radio"
                    name="folio-candidate"
                    value={candidateId(candidate)}
                    checked={selectedId === candidateId(candidate)}
                    onChange={() => setSelectedId(candidateId(candidate))}
                  />
                  <span className="flex-grow-1">
                    {candidate.courses?.map((course) => `${course.courseNumber || ''}${course.sectionName ? `-${course.sectionName}` : ''}`).join(' / ')}
                    {candidate.term?.name ? ` · ${candidate.term.name}` : ''}
                  </span>
                  <Badge color={match.color}>{match.label}</Badge>
                </Label>
              );
            })}
          </fieldset>
        )}
        <p className="small text-muted mt-2 mb-0">{checkedAt ? `Last checked ${new Date(checkedAt).toLocaleString()}` : 'Not checked yet'}</p>

        {correctOpen && !isLinked && (
          <Form data-testid="correct-submission-form" className="border rounded p-3 mt-3" onSubmit={handleCorrect}>
            <h3 className="h6">Correct roster course</h3>
            <Label for="correct-course-code">Course number</Label>
            <Input id="correct-course-code" name="course_code" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} />
            <Label for="correct-section" className="mt-2">Section</Label>
            <Input id="correct-section" name="section" value={section} onChange={(event) => setSection(event.target.value)} />
            <Label for="correct-reason" className="mt-2">Reason (required)</Label>
            <Input id="correct-reason" name="reason" value={correctReason} onChange={(event) => setCorrectReason(event.target.value)} required />
            <Button className="mt-3" type="submit" color="primary" disabled={saving || !correctReason.trim()}>Save correction</Button>
          </Form>
        )}

        {overrideOpen && !isLinked && selectedCandidate && (
          <Form className="border rounded p-3 mt-3" onSubmit={handleOverride}>
            <Label for="override-reason">Reason for linking with a mismatch (required)</Label>
            <Input id="override-reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} required />
            <Button className="mt-3" type="submit" color="warning" disabled={saving || !overrideReason.trim()}>Link with mismatch</Button>
          </Form>
        )}

        {unlinkOpen && isLinked && (
          <Form className="border rounded p-3 mt-3" onSubmit={handleUnlink}>
            {isPublished && <Alert color="warning">Unlink is unavailable after items are published.</Alert>}
            <Label for="unlink-reason">Reason for unlinking (required)</Label>
            <Input id="unlink-reason" value={unlinkReason} onChange={(event) => setUnlinkReason(event.target.value)} required disabled={isPublished} />
            <Button className="mt-3" type="submit" color="danger" disabled={saving || isPublished || !unlinkReason.trim()}>Confirm unlink</Button>
          </Form>
        )}

        <hr className="my-4" />
        <WorkflowTimeline events={events} error={timelineError} />
      </CardBody>
    </Card>
  );
}

LinkingPanel.propTypes = {
  submission: PropTypes.object.isRequired,
  items: PropTypes.arrayOf(PropTypes.object),
  onChanged: PropTypes.func,
};

export default LinkingPanel;

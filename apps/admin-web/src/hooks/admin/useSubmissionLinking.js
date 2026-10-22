import { useCallback, useEffect, useMemo, useState } from 'react';
import { submissionWorkflowService } from '../../services/admin/submissionWorkflowService';
import {
  getCandidateFieldMatches,
  getLinkingErrorMessage,
  submissionHasPublishedItems,
} from '../../services/admin/linkingFormatters';

const candidateId = (candidate) => String(candidate.folio_course_listing_id);

export default function useSubmissionLinking(submission, items = [], onChanged = () => {}) {
  const uuid = submission?.uuid;
  const linkedId = submission?.folioCourseListingId;
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [checkedAt, setCheckedAt] = useState(null);
  const [candidateLoading, setCandidateLoading] = useState(Boolean(uuid));
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineLoaded, setTimelineLoaded] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeQuery, setActiveQuery] = useState('');
  const clearError = useCallback(() => setError(''), []);

  const loadCandidates = useCallback(async (query = '') => {
    if (!uuid) return;
    setCandidateLoading(true);
    setError('');
    try {
      const result = await submissionWorkflowService.getCandidates(uuid, query || undefined);
      const found = result.items;
      setCandidates(found);
      setCheckedAt(result.checked_at || null);
      setSelectedId((previous) => {
        if (found.some((candidate) => candidateId(candidate) === previous)) return previous;
        const preferred = found.find((candidate) => candidateId(candidate) === String(linkedId));
        return candidateId(preferred || found.find((candidate) => candidate.match === 'exact') || found[0] || { folio_course_listing_id: '' });
      });
    } catch (requestError) {
      setError(getLinkingErrorMessage(requestError, 'search'));
    } finally {
      setCandidateLoading(false);
    }
  }, [linkedId, uuid]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  const refreshTimeline = useCallback(async (force = false) => {
    if (!uuid || (timelineLoaded && !force)) return;
    setTimelineLoading(true);
    setTimelineError('');
    try {
      const result = await submissionWorkflowService.getTimeline(uuid);
      setTimeline(result.items);
      setTimelineLoaded(true);
    } catch (requestError) {
      setTimelineError(getLinkingErrorMessage(requestError, 'timeline'));
    } finally {
      setTimelineLoading(false);
    }
  }, [timelineLoaded, uuid]);

  const runAction = useCallback(async (action, request) => {
    setError('');
    setSaving(true);
    try {
      await request();
      await loadCandidates(activeQuery);
      if (timelineLoaded) await refreshTimeline(true);
      await onChanged();
      return true;
    } catch (requestError) {
      setError(getLinkingErrorMessage(requestError, action));
      return false;
    } finally {
      setSaving(false);
    }
  }, [activeQuery, loadCandidates, onChanged, refreshTimeline, timelineLoaded]);

  const searchCandidates = useCallback((query) => {
    const normalized = query.trim();
    setActiveQuery(normalized);
    return loadCandidates(normalized);
  }, [loadCandidates]);

  const selectedCandidate = candidates.find((candidate) => candidateId(candidate) === selectedId) || null;
  const currentCandidate = candidates.find((candidate) => candidateId(candidate) === String(linkedId)) || null;
  const selectedMatches = selectedCandidate ? getCandidateFieldMatches(submission, selectedCandidate) : null;
  const canLink = Boolean(selectedCandidate
    && selectedCandidate.match === 'exact'
    && selectedMatches?.courseNumber
    && selectedMatches?.section
    && selectedMatches?.term === true);

  const actions = useMemo(() => ({
    link: () => selectedCandidate && runAction('link', () => submissionWorkflowService.linkSubmission(uuid, {
      folio_course_listing_id: selectedCandidate.folio_course_listing_id,
    })),
    override: (reason) => selectedCandidate && runAction('override', () => submissionWorkflowService.overrideSubmissionLink(uuid, {
      folio_course_listing_id: selectedCandidate.folio_course_listing_id,
      reason,
    })),
    correct: (courseCode, section, reason) => runAction('correct', () => submissionWorkflowService.correctSubmission(uuid, {
      course_code: courseCode.trim(),
      section: section.trim(),
      reason,
    })),
    unlink: (reason) => runAction('unlink', () => submissionWorkflowService.unlinkSubmission(uuid, { reason })),
    recheck: () => runAction('recheck', () => submissionWorkflowService.recheckSubmission(uuid)),
  }), [runAction, selectedCandidate, uuid]);

  return {
    candidates,
    selectedId,
    selectedCandidate,
    currentCandidate,
    canLink,
    isPublished: submissionHasPublishedItems(items),
    candidateLoading,
    checkedAt,
    error,
    clearError,
    saving,
    selectCandidate: setSelectedId,
    searchCandidates,
    actions,
    timeline,
    timelineLoading,
    timelineError,
    loadTimeline: refreshTimeline,
  };
}

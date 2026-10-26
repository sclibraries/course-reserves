import { useMemo, useState } from 'react';
import { extractCitationsFromSyllabus, findCitationBestMatch } from '@course-reserves/citations';
import {
  createStaffSyllabusSubmission,
  getGoogleDocText,
  readSyllabusFile,
  searchSyllabusEntries,
} from '../../services/admin/staffSyllabusRequestService';
import { buildStaffSyllabusPayload, groupSyllabusEntries } from '../../pages/staffSyllabusRequestUtils';

export function useStaffSyllabusRequest(course) {
  const [source, setSource] = useState('google');
  const [googleDocUrl, setGoogleDocUrl] = useState('');
  const [file, setFile] = useState(null);
  const [syllabus, setSyllabus] = useState(null);
  const [groups, setGroups] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [instructorName, setInstructorName] = useState('');
  const [instructorUsername, setInstructorUsername] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [submissionId, setSubmissionId] = useState(null);
  const [busy, setBusy] = useState(false);

  const groupedEntries = useMemo(() => groupSyllabusEntries(groups), [groups]);
  const entriesResolved = groupedEntries.length > 0
    && groupedEntries.every(({ entries }) => entries.every((entry) => decisions[entry.id]?.action));
  const hasIncludedEntries = groupedEntries.some(({ entries }) => entries.some((entry) => decisions[entry.id]?.action && decisions[entry.id].action !== 'drop'));
  const canSubmit = entriesResolved
    && hasIncludedEntries
    && instructorName.trim()
    && instructorUsername.trim();

  async function extractAndSearch() {
    setBusy(true);
    setError('');
    setSubmissionId(null);
    try {
      const sourceResult = source === 'google'
        ? { text: await getGoogleDocText(googleDocUrl), syllabus: { google_doc_url: googleDocUrl } }
        : await readSyllabusFile(file);
      const extracted = extractCitationsFromSyllabus(sourceResult.text);
      const entries = extracted.entries.map((entry, index) => ({ ...entry, id: `syllabus-entry-${index + 1}` }));
      if (!entries.length) throw new Error('No readable citations, links, or media entries were found in this syllabus.');
      const citations = entries.filter((entry) => entry.type === 'citation');
      setProgress(`Searching 0 of ${citations.length} citations…`);
      const results = await searchSyllabusEntries(citations, (completed, total) => {
        setProgress(`Searching ${completed} of ${total} citations…`);
      });
      const byEntry = Object.fromEntries(results.map((result) => [result.id, result]));
      const initialDecisions = Object.fromEntries(entries.map((entry) => {
        const group = byEntry[entry.id];
        const best = group ? findCitationBestMatch(entry.text, group.results).best : undefined;
        return [entry.id, { action: null, best, results: group?.results || [] }];
      }));
      setGroups(entries);
      setDecisions(initialDecisions);
      setSyllabus(source === 'google' ? sourceResult.syllabus : sourceResult.attachment);
      setProgress('Matching complete. Review each syllabus entry below.');
    } catch (reason) {
      setError(reason.message || 'Could not read this syllabus. Check the source and try again.');
      setProgress('');
    } finally {
      setBusy(false);
    }
  }

  function choose(entryId, action, result) {
    setDecisions((current) => ({ ...current, [entryId]: { ...current[entryId], action, result } }));
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const body = buildStaffSyllabusPayload({
        course, instructorName, instructorUsername, groups: groupedEntries, decisions, syllabus,
      });
      const response = await createStaffSyllabusSubmission(body);
      setSubmissionId(response.submission_id);
    } catch (reason) {
      const payload = reason.payload || {};
      setError(payload.error_code === 'instructor_draft_exists'
        ? 'This instructor already has a draft for this course; ask them to submit it, or add these items to it'
        : `Could not create the request. Reference: ${payload.reference_id || 'unavailable'}`);
    } finally {
      setBusy(false);
    }
  }

  return {
    source, setSource, googleDocUrl, setGoogleDocUrl, file, setFile,
    groups: groupedEntries, decisions, choose, instructorName, setInstructorName,
    instructorUsername, setInstructorUsername, progress, error, submissionId, busy,
    entriesResolved, hasIncludedEntries, canSubmit: Boolean(canSubmit) && !busy, extractAndSearch, submit,
  };
}

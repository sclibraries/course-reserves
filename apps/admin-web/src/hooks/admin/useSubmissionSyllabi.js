import { useEffect, useState } from 'react';
import {
  getSubmissionSyllabusError,
  submissionSyllabiService,
} from '../../services/admin/submissionSyllabiService';

export default function useSubmissionSyllabi(submissionId) {
  const [syllabi, setSyllabi] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setSyllabi([]);
    setError('');
    if (!submissionId) return () => { current = false; };

    submissionSyllabiService.getSyllabi(submissionId)
      .then((result) => { if (current) setSyllabi(result); })
      .catch((requestError) => {
        if (current) setError(getSubmissionSyllabusError(requestError, 'load'));
      });

    return () => { current = false; };
  }, [submissionId]);

  return { syllabi, error };
}

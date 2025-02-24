import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch all terms from the backend and
 * auto-detect the current term ID by picking the one with
 * the latest startDate if overlapping. Also returns the full
 * list of terms for a dropdown.
 *
 * @param {string} [termsApiUrl] - The URL for fetching terms.
 * @returns {{
 *   termId: string | null,
 *   terms: Array<object>,
 *   loading: boolean,
 *   error: string | null
 * }}
 */
export function useCurrentTermId(termsApiUrl) {
  const [termId, setTermId] = useState(null);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const DEFAULT_URL = 'https://libtools2.smith.edu/folio/web/search/search-terms';

  useEffect(() => {
    async function fetchTerms() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(termsApiUrl || DEFAULT_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch terms: ${response.status}`);
        }
        const data = await response.json();
        const allTerms = data?.data?.terms || [];
        setTerms(allTerms);

        // Auto-detect current term
        const currentDate = new Date();
        const sorted = allTerms.sort(
          (a, b) => new Date(a.startDate) - new Date(b.startDate)
        );
        const activeTerms = sorted.filter((term) => {
          const start = new Date(term.startDate);
          const end = new Date(term.endDate);
          return currentDate >= start && currentDate <= end;
        });

        let chosenTerm = null;
        if (activeTerms.length === 1) {
          chosenTerm = activeTerms[0];
        } else if (activeTerms.length > 1) {
          // Pick the term with the latest startDate
          chosenTerm = activeTerms.reduce((latest, term) =>
            new Date(term.startDate) > new Date(latest.startDate) ? term : latest
          );
        }

        console.log("useCurrentTermId: auto-detected termId (chosenTerm?.id)", chosenTerm?.id);
        setTermId(chosenTerm?.id || null);
      } catch (err) {
        setError(err.message);
        setTermId(null);
      } finally {
        setLoading(false);
      }
    }
    fetchTerms();
  }, [termsApiUrl]);


  return { termId, terms, loading, error };
}
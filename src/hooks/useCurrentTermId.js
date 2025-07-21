import { useState, useEffect } from 'react';
import { config } from '../config';
import { sortTerms } from '../utils/termSorting';
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

  const TERMS_API_URL = `${config.api.urls.folio}/search/search-terms`;

  useEffect(() => {
    async function fetchTerms() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(termsApiUrl || TERMS_API_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch terms: ${response.status}`);
        }
        const data = await response.json();
        
        // Sort terms using utility function
        const allTerms = sortTerms(data?.data?.terms || []);
        
        console.log("useCurrentTermId: allTerms", allTerms);
        setTerms(allTerms);
        
        const currentDate = new Date();
        const sorted = allTerms.slice().sort(
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
          chosenTerm = activeTerms.reduce((latest, term) =>
            new Date(term.startDate) > new Date(latest.startDate) ? term : latest
          );
        }

        setTermId(chosenTerm?.id || null);
      } catch (err) {
        setError(err.message);
        setTermId(null);
      } finally {
        setLoading(false);
      }
    }
    fetchTerms();
  }, [termsApiUrl, TERMS_API_URL]);


  return { termId, terms, loading, error };
}
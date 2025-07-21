// src/hooks/useAdminSearch.js
import { useState } from 'react';
import { useBuildQuery } from '../useBuildQuery';
import { adminCourseService } from '../../services/admin/adminCourseService';
import useAdminSearchStore from '../../store/adminSearchStore';

/**
 * useAdminSearch
 * ----------------
 * Custom hook that encapsulates common admin search logic.
 */
export function useAdminSearch() {
  // Get shared search parameters from the store
  const { college, type, query, department, sortOption, termId } = useAdminSearchStore();

  // Local state for search results and status
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Build the CQL query using the shared state values
  const cqlQuery = useBuildQuery(college, type, query, department, sortOption, termId);

  const fetchResults = async () => {
    try {
      setLoading(true);
      // Assume adminCourseService.searchCourses is available to perform the search.
      const data = await adminCourseService.searchCourses(cqlQuery);
      setResults(data);
      setLoading(false);
    } catch (err) {
      setError(err);
      setLoading(false);
      throw err;
    }
  };

  return { results, loading, error, fetchResults, cqlQuery };
}

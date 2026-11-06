import { useCallback, useState } from 'react';
import { adminCourseService } from '../../services/admin/adminCourseService';
import { getEdsSearchErrorMessage } from '../../services/admin/course/resourceApi';
import { hitchcockService } from '../../services/admin/hitchcockService';
import { notify } from '../../services/notify';
import { ResourceFormType } from '../../components/admin/forms/constants/formTypes';

function getEdsRecords(data) {
  if (data.status !== 'success' || data.code !== 200) {
    const error = new Error(getEdsSearchErrorMessage(data.code, data.error_code, data.reference));
    error.reference = data.reference;
    throw error;
  }
  return data.data?.records || [];
}

export function useResourceSearch(formType) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [totalHits, setTotalHits] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const [ebscoQueryString, setEbscoQueryString] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const search = async () => {
    const query = searchTerm.trim();
    if (!query) return;

    setLoading(true);
    setHasSearched(false);
    try {
      let results;
      if (formType === ResourceFormType.EDS) {
        const data = await adminCourseService.searchEDS(query);
        results = getEdsRecords(data);
        setTotalHits(data.data?.statistics?.TotalHits || 0);
        setSearchTime(data.data?.statistics?.TotalSearchTime || 0);
        setEbscoQueryString(data.data?.request?.QueryString || '');
        setCurrentPage(1);
      } else if (formType === ResourceFormType.REUSE) {
        const data = await adminCourseService.searchResources(query);
        results = data.resources || [];
      } else {
        const response = await hitchcockService.searchResources(query);
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          const error = new Error(`Search failed with status ${response.status}`);
          error.reference = details.reference || details.reference_id;
          throw error;
        }
        results = await response.json();
      }

      setSearchResults(results);
      setHasSearched(true);
    } catch (error) {
      setSearchResults([]);
      setTotalHits(0);
      notify.fromError(error, "Couldn't search resources");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loading || !ebscoQueryString) return;

    const nextPage = currentPage + 1;
    setLoading(true);
    try {
      const data = await adminCourseService.searchEDSPage(ebscoQueryString, nextPage);
      setSearchResults((results) => [...results, ...getEdsRecords(data)]);
      setCurrentPage(nextPage);
    } catch (error) {
      notify.fromError(error, "Couldn't load more library results");
    } finally {
      setLoading(false);
    }
  };

  const reset = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
    setLoading(false);
    setTotalHits(0);
    setSearchTime(0);
    setEbscoQueryString('');
    setCurrentPage(1);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    hasSearched,
    loading,
    totalHits,
    searchTime,
    hasMore: formType === ResourceFormType.EDS && searchResults.length < totalHits,
    search,
    loadMore,
    reset,
  };
}

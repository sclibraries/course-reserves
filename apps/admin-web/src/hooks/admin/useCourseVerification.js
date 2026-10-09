import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { adminCourseService } from '../../services/admin/adminCourseService';

/**
 * Custom hook to manage the Course Verification Gate logic
 */
export const verifyCourseSelection = async ({
  submission,
  selectedCourse,
  linkCourseOffering,
  fetchSubmissionDetail,
  setVerifyingCourseId,
  toastSuccess,
  toastError,
}) => {
  if (!selectedCourse || !selectedCourse.id) {
    toastError('Invalid course selected.');
    return;
  }

  setVerifyingCourseId(selectedCourse.id);

  try {
    await linkCourseOffering(submission.id, selectedCourse);
    toastSuccess('FOLIO course verified and linked.');
    await fetchSubmissionDetail(submission.id);
  } catch (error) {
    console.error('Failed to verify course:', error);
    toastError(error.message || 'Failed to verify course');
  } finally {
    setVerifyingCourseId(null);
  }
};

export const shouldRunAutoSearch = ({
  submission,
  searchResults,
  isSearching,
  attemptedAutoSearchQuery,
  sanitizeQuery,
}) => {
  if (!submission || submission.folioCourseListingId || !submission.courseCode || isSearching) {
    return false;
  }

  if (searchResults.length > 0) {
    return false;
  }

  const initialQuery = sanitizeQuery(submission.courseCode);
  return Boolean(initialQuery) && attemptedAutoSearchQuery !== initialQuery;
};

export const useCourseVerification = (submission, fetchSubmissionDetail) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [verifyingCourseId, setVerifyingCourseId] = useState(null);
  const [attemptedAutoSearchQuery, setAttemptedAutoSearchQuery] = useState(null);

  // Helper to sanitize search input for FOLIO CQL
  const sanitizeQuery = useCallback((input) => {
    if (!input) return '';
    // Trim whitespace and strictly remove leading asterisks
    return input.trim().replace(/^\*+/, '');
  }, []);

  const handleSearch = useCallback(async (overrideQuery = null) => {
    const queryToSanitize = overrideQuery !== null ? overrideQuery : searchQuery;
    const sanitizedQuery = sanitizeQuery(queryToSanitize);
    
    if (!sanitizedQuery) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const results = await adminCourseService.searchCoursesByQuery(sanitizedQuery);
      setSearchResults(results);
      if (results.length === 0) {
        toast.info("No courses found matching your query.");
      }
    } catch (error) {
      console.error("Search failed:", error);
      // Don't show toast on auto-search failure to avoid spamming
      if (overrideQuery === null) {
        toast.error("Failed to search courses. Please try a different term.");
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, sanitizeQuery]);

  const handleVerify = async (selectedCourse) => verifyCourseSelection({
    submission,
    selectedCourse,
    linkCourseOffering: adminCourseService.linkCourseOffering,
    fetchSubmissionDetail,
    setVerifyingCourseId,
    toastSuccess: toast.success,
    toastError: toast.error,
  });

  // Auto-search logic
  useEffect(() => {
    if (shouldRunAutoSearch({
      submission,
      searchResults,
      isSearching,
      attemptedAutoSearchQuery,
      sanitizeQuery,
    })) {
      const initialQuery = sanitizeQuery(submission.courseCode);
      setAttemptedAutoSearchQuery(initialQuery);
      setSearchQuery(initialQuery);
      handleSearch(initialQuery);
    }
  }, [submission, isSearching, searchResults, attemptedAutoSearchQuery, sanitizeQuery, handleSearch]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    verifyingCourseId,
    handleSearch,
    handleVerify
  };
};

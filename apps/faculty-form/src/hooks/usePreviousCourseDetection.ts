import { useState, useEffect, useRef } from "react";
import { API_ENDPOINTS } from "@/config/endpoints";

interface PreviousCourseDetectionState {
  showCloneSuggestion: boolean;
  setShowCloneSuggestion: (show: boolean) => void;
  hasExactMatchCourses: boolean;
  checkingForPreviousCourses: boolean;
}

/**
 * Hook to detect and manage previous course versions
 */
export const usePreviousCourseDetection = (
  reserveId: string | undefined,
  courseCode: string | undefined,
  itemsLength: number,
  foldersLength: number,
  userName: string | undefined
): PreviousCourseDetectionState => {
  const [showCloneSuggestion, setShowCloneSuggestion] = useState(false);
  const [hasExactMatchCourses, setHasExactMatchCourses] = useState(false);
  const [checkingForPreviousCourses, setCheckingForPreviousCourses] = useState(false);
  
  // Track if we've already checked for this course to prevent infinite loop
  const hasCheckedForPreviousCourses = useRef(false);
  
  // Reset the check flag when course ID changes
  useEffect(() => {
    hasCheckedForPreviousCourses.current = false;
  }, [reserveId]);
  
  // Check for previous versions of this course on page load
  useEffect(() => {
    const checkForPreviousCourses = async () => {
      if (!courseCode || !userName) return;
      
      // Only check once per course load
      if (hasCheckedForPreviousCourses.current) return;
      
      // Mark as checked to prevent re-running
      hasCheckedForPreviousCourses.current = true;
      setCheckingForPreviousCourses(true);
      
      try {
        // Build query using API_ENDPOINTS
        const query = `(courseNumber=="${courseCode}" and department.name=="SC*" and courseListing.instructorObjects="${userName}*") sortby courseListing.termObject.name/sort.descending`;
        const searchUrl = `${API_ENDPOINTS.FOLIO.BASE_URL}${API_ENDPOINTS.FOLIO.SEARCH_COURSES}?query=${encodeURIComponent(query)}`;
        
        const coursesRes = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          mode: 'cors',
          credentials: 'omit'
        });
        
        if (coursesRes.ok) {
          const coursesData = await coursesRes.json();
          const courses = coursesData.data?.courses || [];
          
          // Check if we found any previous versions of this exact course
          if (courses.length > 0) {
            setHasExactMatchCourses(true);
            setShowCloneSuggestion(true);
          } else {
            setHasExactMatchCourses(false);
            setShowCloneSuggestion(true); // Still show, but with "see all" option
          }
        }
      } catch (error) {
        console.error('Failed to check for previous courses:', error);
        // Still show the banner, but without knowing if exact matches exist
        setShowCloneSuggestion(true);
      } finally {
        setCheckingForPreviousCourses(false);
      }
    };
    
    checkForPreviousCourses();
  }, [reserveId, courseCode, itemsLength, foldersLength, userName]);
  
  return {
    showCloneSuggestion,
    setShowCloneSuggestion,
    hasExactMatchCourses,
    checkingForPreviousCourses,
  };
};

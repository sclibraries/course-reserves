/**
 * Filter out UUID or null/invalid terms
 * @param {Array} terms - Array of terms to filter
 * @returns {Array} Filtered array of valid term names
 */
export const filterValidTerms = (terms) => {
    if (!terms || !Array.isArray(terms)) return [];
  
    return terms.filter(term => 
      term && 
      typeof term === 'string' &&
      term !== 'N/A' && 
      term !== 'null' && 
      term !== 'NULL' &&
      !term.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    );
  };
  
  /**
   * Sort terms chronologically with most recent first
   * @param {Array} terms - Array of terms to sort
   * @returns {Array} Sorted array of terms
   */
  export const sortTerms = (terms) => {
    if (!terms || !Array.isArray(terms)) return [];
  
    return [...terms].sort((a, b) => {
      try {
        // Sort terms in a logical order (most recent first)
        const yearA = a.match(/\d{4}/);
        const yearB = b.match(/\d{4}/);
        
        // If both have years, compare years first (descending)
        if (yearA && yearB) {
          const yearDiff = parseInt(yearB[0]) - parseInt(yearA[0]);
          if (yearDiff !== 0) return yearDiff;
        }
        
        // Semester ordering with Fall first
        const semesterOrder = {
          'Fall': 4,
          'Summer': 3,
          'Spring': 2,
          'Winter': 1
        };
        
        // Extract semester names
        const semesterA = Object.keys(semesterOrder).find(s => a.includes(s)) || '';
        const semesterB = Object.keys(semesterOrder).find(s => b.includes(s)) || '';
        
        return (semesterOrder[semesterB] || 0) - (semesterOrder[semesterA] || 0);
      } catch (err) {
        console.error("Error sorting terms:", err);
        return 0; // Default comparison if error
      }
    });
  };
  
  /**
   * Extracts unique colleges from analytics data
   * @param {Array} collegeData - Array of college data objects
   * @returns {Array} Array of unique college names
   */
  export const extractColleges = (collegeData) => {
    if (!collegeData || !Array.isArray(collegeData)) {
      return [];
    }
    
    return [...new Set(
      collegeData
        .filter(item => item && item.college)
        .map(item => item.college)
    )];
  };
  
  /**
   * Format date for API requests
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {string} Formatted date or empty string
   */
  export const formatDateForApi = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    } catch (e) {
      console.error("Error formatting date:", e);
      return '';
    }
  };
  
  /**
   * Build filter parameters object for API requests
   * @param {Object} filters - Object containing all filter values
   * @returns {Object} Parameters object for API request
   */
  export const buildFilterParams = (filters) => {
    const params = {};
    
    if (filters.collegeFilter) {
      params.college = filters.collegeFilter;
    }
    
    if (filters.eventTypeFilter) {
      params.eventType = filters.eventTypeFilter;
    }
    
    if (filters.termFilter) {
      params.term = filters.termFilter;
    }
    
    if (filters.dateRange?.start) {
      params.startDate = formatDateForApi(filters.dateRange.start);
    }
    
    if (filters.dateRange?.end) {
      params.endDate = formatDateForApi(filters.dateRange.end);
    }
    
    if (filters.searchTerm) {
      params.search = filters.searchTerm;
    }
    
    return params;
  };
import { SEMESTER_ORDER } from '../constants';

/**
 * Filter out UUID or null terms
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
 * Sort terms chronologically
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
      
      // If both have years, compare years first
      if (yearA && yearB) {
        const yearDiff = parseInt(yearB[0]) - parseInt(yearA[0]);
        if (yearDiff !== 0) return yearDiff;
      }
      
      // Extract semester names
      const semesterA = Object.keys(SEMESTER_ORDER).find(s => a.includes(s)) || '';
      const semesterB = Object.keys(SEMESTER_ORDER).find(s => b.includes(s)) || '';
      
      return (SEMESTER_ORDER[semesterB] || 0) - (SEMESTER_ORDER[semesterA] || 0);
    } catch (err) {
      console.error("Error sorting terms:", err);
      return 0; // Default comparison if error
    }
  });
};

/**
 * Normalize course data to ensure all fields exist and are valid
 * @param {Array} courses - Array of course objects
 * @returns {Array} Normalized course objects
 */
export const normalizeCourseData = (courses) => {
  if (!courses || !Array.isArray(courses)) return [];
  
  return courses.map(course => {
    // Handle null or undefined course
    if (!course) return { name: 'Unknown Course', college: 'unknown', term: 'N/A', count: 0 };
    
    // Handle missing fields
    return {
      ...course,
      name: course.name || 'Unknown Course',
      college: course.college || 'unknown',
      term: course.term || 'N/A',
      count: Number(course.count) || 0
    };
  });
};

/**
 * Group courses by term and get top N for each
 * @param {Array} courses - Array of course objects
 * @param {Array} terms - Array of term names
 * @param {Number} limit - Number of courses to include per term
 * @returns {Object} Object with terms as keys and arrays of courses as values
 */
export const getCoursesByTerm = (courses, terms, limit = 10) => {
  try {
    const result = {
      all: (courses || [])
        .filter(course => course.name && course.name.trim() !== '')
        .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
        .slice(0, limit)
    };
    
    (terms || []).forEach(term => {
      result[term] = (courses || [])
        .filter(course => course.term === term && course.name && course.name.trim() !== '')
        .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
        .slice(0, limit);
    });
    
    return result;
  } catch (err) {
    console.error("Error in coursesByTerm:", err);
    return { all: [] };
  }
};

/**
 * Group courses by campus and get top N for each
 * @param {Array} courses - Array of course objects
 * @param {Number} limit - Number of courses to include per campus
 * @returns {Object} Object with campuses as keys and arrays of courses as values
 */
export const getCoursesByCampus = (courses, limit = 10) => {
  try {
    const result = {
      all: (courses || [])
        .filter(course => course.name && course.name.trim() !== '')
        .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
        .slice(0, limit)
    };
    
    // Get unique campuses
    const campuses = [...new Set((courses || [])
      .filter(c => c.college)
      .map(c => c.college))];
    
    // Create separate lists for each campus
    campuses.forEach(campus => {
      result[campus] = (courses || [])
        .filter(course => course.college === campus && course.name && course.name.trim() !== '')
        .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
        .slice(0, limit);
    });
    
    return result;
  } catch (err) {
    console.error("Error in coursesByCampus:", err);
    return { all: [] };
  }
};
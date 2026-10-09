/**
 * Utility functions for sorting and selecting academic terms
 */

/**
 * Sorts terms by year (latest first) and season within each year
 * Accounts for academic year cycles where Winter of year Y is part of (Y-1)/Y academic year
 * Chronological order within academic year: Fall -> Winter -> Spring -> Summer
 * 
 * @param {Array} terms - Array of term objects with name property
 * @returns {Array} Sorted array of terms
 */
export const sortTerms = (terms) => {
  return terms.slice().sort((a, b) => {
    // Extract year and season from term names (e.g., "2025 Fall" -> year: 2025, season: "Fall")
    const parseTermName = (name) => {
      const parts = name.split(' ');
      const year = parseInt(parts[0]);
      const season = parts[1];
      return { year, season };
    };

    // Calculate academic year for each term
    // Fall 2025 -> academic year 2025 (2025/2026)
    // Winter 2026 -> academic year 2025 (2025/2026) 
    // Spring 2026 -> academic year 2025 (2025/2026)
    // Summer 2026 -> academic year 2025 (2025/2026)
    const getAcademicYear = (parsedTerm) => {
      const { year, season } = parsedTerm;
      if (season === 'Fall') {
        return year; // Fall 2025 is academic year 2025/2026
      } else {
        return year - 1; // Winter/Spring/Summer 2026 is academic year 2025/2026
      }
    };

    const termA = parseTermName(a.name);
    const termB = parseTermName(b.name);
    
    const academicYearA = getAcademicYear(termA);
    const academicYearB = getAcademicYear(termB);

    // First, sort by academic year (latest first)
    if (academicYearA !== academicYearB) {
      return academicYearB - academicYearA;
    }

    // If same academic year, sort by season in chronological order: Fall, Winter, Spring, Summer
    // For descending order (most recent first): Summer (4), Spring (3), Winter (2), Fall (1)
    const seasonOrder = { 'Summer': 4, 'Spring': 3, 'Winter': 2, 'Fall': 1 };
    const seasonA = seasonOrder[termA.season] || 0;
    const seasonB = seasonOrder[termB.season] || 0;
    
    return seasonB - seasonA;
  });
};

/**
 * Gets the current term based on actual dates
 * Priority:
 * 1. Currently active term (today is between startDate and endDate)
 * 2. Next upcoming term if no term is currently active
 * 3. Most recent term by year/season if no dates available or all past
 * 
 * @param {Array} terms - Array of term objects with name, startDate, endDate
 * @param {string} mode - 'public' or 'admin' - determines selection strategy for overlapping terms
 * @returns {Object|null} The current/most relevant term object
 */
export const getCurrentTerm = (terms, mode = 'public') => {
  if (!terms || terms.length === 0) return null;
  
  const now = new Date();
  const sortedTerms = sortTerms(terms);
  
  // Find all currently active terms (where today falls within the date range)
  const activeTerms = sortedTerms.filter(term => {
    if (!term.startDate || !term.endDate) return false;
    
    const startDate = new Date(term.startDate);
    const endDate = new Date(term.endDate);
    
    return now >= startDate && now <= endDate;
  });
  
  // If we have active terms, selection depends on mode
  if (activeTerms.length > 0) {
    if (mode === 'admin') {
      // Admin: prefer the term that extends furthest into the future (latest end date)
      // This allows admins to work on upcoming terms as soon as they start
      return activeTerms.sort((a, b) => {
        const endA = new Date(a.endDate);
        const endB = new Date(b.endDate);
        return endB - endA; // Latest end date first
      })[0];
    } else {
      // Public: prefer the term ending soonest (earliest end date)
      // Users want to see their current term until it actually ends
      return activeTerms.sort((a, b) => {
        const endA = new Date(a.endDate);
        const endB = new Date(b.endDate);
        return endA - endB; // Earliest end date first
      })[0];
    }
  }
  
  // No currently active terms - find the next upcoming term
  const upcomingTerms = sortedTerms.filter(term => {
    if (!term.startDate) return false;
    const startDate = new Date(term.startDate);
    return startDate > now;
  });
  
  if (upcomingTerms.length > 0) {
    // Sort by startDate (earliest start date = next term)
    return upcomingTerms.sort((a, b) => {
      const startA = new Date(a.startDate);
      const startB = new Date(b.startDate);
      return startA - startB; // Earliest start date first
    })[0];
  }
  
  // Fallback: return the first term in the sorted list (most recent by year/season)
  return sortedTerms[0];
};

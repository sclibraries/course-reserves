/**
 * Utility functions for sorting academic terms
 */

/**
 * Sorts terms by year (latest first) and season within each year
 * Season order: Winter, Fall, Summer, Spring (Winter is latest in academic year)
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

    const termA = parseTermName(a.name);
    const termB = parseTermName(b.name);

    // First, sort by year (latest first)
    if (termA.year !== termB.year) {
      return termB.year - termA.year;
    }

    // If same year, sort by season in the order: Winter, Fall, Summer, Spring
    // Winter is typically the latest term in an academic year
    const seasonOrder = { 'Winter': 4, 'Fall': 3, 'Summer': 2, 'Spring': 1 };
    const seasonA = seasonOrder[termA.season] || 0;
    const seasonB = seasonOrder[termB.season] || 0;
    
    return seasonB - seasonA;
  });
};

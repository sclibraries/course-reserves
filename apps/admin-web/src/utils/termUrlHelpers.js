// utils/termUrlHelpers.js

/**
 * Converts a term name to a URL-friendly format
 * Example: "2025 Fall" -> "2025-fall"
 * @param {string} termName - The term name (e.g., "2025 Fall")
 * @returns {string} URL-friendly term name
 */
export const termNameToUrlParam = (termName) => {
  if (!termName || typeof termName !== 'string') return '';
  return termName.toLowerCase().replace(/\s+/g, '-');
};

/**
 * Converts a URL parameter back to a term name
 * Example: "2025-fall" -> "2025 Fall"
 * @param {string} urlParam - The URL parameter (e.g., "2025-fall")
 * @returns {string} Term name
 */
export const urlParamToTermName = (urlParam) => {
  if (!urlParam || typeof urlParam !== 'string') return '';
  return urlParam
    .split('-')
    .map((word, index) => {
      // Capitalize first letter of each word except the first (which is the year)
      return index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

/**
 * Finds a term ID by its name from the terms array
 * @param {Array} terms - Array of term objects with id and name properties
 * @param {string} termName - The term name to find
 * @returns {string|null} The term ID or null if not found
 */
export const findTermIdByName = (terms, termName) => {
  if (!terms || !Array.isArray(terms) || !termName) return null;
  const term = terms.find(t => t.name === termName);
  return term ? term.id : null;
};

/**
 * Finds a term name by its ID from the terms array
 * @param {Array} terms - Array of term objects with id and name properties
 * @param {string} termId - The term ID to find
 * @returns {string|null} The term name or null if not found
 */
export const findTermNameById = (terms, termId) => {
  if (!terms || !Array.isArray(terms) || !termId) return null;
  const term = terms.find(t => t.id === termId);
  return term ? term.name : null;
};

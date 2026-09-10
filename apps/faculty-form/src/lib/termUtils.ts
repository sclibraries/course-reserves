import { Term } from '@/store/termsStore';

// Utility functions for working with terms

/**
 * Parse term name to extract year and season information
 */
export const parseTermName = (termName: string) => {
  const match = termName.match(/(\d{4})\s+(Winter|Spring|Summer|Fall)/i);
  if (!match) {
    return null;
  }
  
  return {
    year: parseInt(match[1]),
    season: match[2] as 'Winter' | 'Spring' | 'Summer' | 'Fall',
    full: termName
  };
};

/**
 * Get the seasonal order for sorting (Winter=0, Spring=1, Summer=2, Fall=3)
 */
export const getSeasonOrder = (season: string): number => {
  const seasonOrder: Record<string, number> = {
    'Winter': 0,
    'Spring': 1, 
    'Summer': 2,
    'Fall': 3
  };
  
  return seasonOrder[season] ?? 999;
};

/**
 * Compare two terms for sorting (chronological order)
 */
export const compareTerms = (a: Term, b: Term): number => {
  const aInfo = parseTermName(a.name);
  const bInfo = parseTermName(b.name);
  
  if (!aInfo || !bInfo) {
    return a.name.localeCompare(b.name);
  }
  
  // Compare by year first
  if (aInfo.year !== bInfo.year) {
    return aInfo.year - bInfo.year;
  }
  
  // Then by season order
  return getSeasonOrder(aInfo.season) - getSeasonOrder(bInfo.season);
};

/**
 * Find the next term after a given term
 */
export const findNextTerm = (terms: Term[], currentTerm: Term): Term | null => {
  const orderedTerms = [...terms].sort(compareTerms);
  const currentIndex = orderedTerms.findIndex(term => term.id === currentTerm.id);
  
  if (currentIndex === -1 || currentIndex === orderedTerms.length - 1) {
    return null;
  }
  
  return orderedTerms[currentIndex + 1];
};

/**
 * Find the previous term before a given term
 */
export const findPreviousTerm = (terms: Term[], currentTerm: Term): Term | null => {
  const orderedTerms = [...terms].sort(compareTerms);
  const currentIndex = orderedTerms.findIndex(term => term.id === currentTerm.id);
  
  if (currentIndex <= 0) {
    return null;
  }
  
  return orderedTerms[currentIndex - 1];
};

/**
 * Determine which term is currently active based on dates
 */
export const getCurrentTermFromDates = (terms: Term[]): Term | null => {
  const now = new Date();
  
  // Find term that contains current date
  const activeTerm = terms.find(term => {
    const startDate = new Date(term.startDate);
    const endDate = new Date(term.endDate);
    return now >= startDate && now <= endDate;
  });
  
  if (activeTerm) return activeTerm;
  
  // If no current term found, find the closest future term
  const futureTerms = terms
    .filter(term => new Date(term.startDate) > now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    
  return futureTerms[0] || null;
};

/**
 * Format a term name for display with additional context
 */
export const formatTermDisplay = (termName: string, context?: 'current' | 'next' | 'default'): string => {
  let formatted = termName;
  
  if (context === 'current') {
    formatted += ' (Current)';
  } else if (context === 'next') {
    formatted += ' (Next)';
  } else if (context === 'default') {
    formatted += ' (Default)';
  }
  
  return formatted;
};

/**
 * Get terms suitable for course creation (typically current and future terms)
 */
export const getAvailableTermsForCreation = (terms: Term[]): Term[] => {
  const now = new Date();
  
  return terms
    .filter(term => {
      // Only include future terms (haven't started yet)
      const startDate = new Date(term.startDate);
      return startDate > now;
    })
    .sort(compareTerms);
};

/**
 * Calculate how many days until a term starts
 */
export const getDaysUntilTerm = (term: Term): number => {
  const now = new Date();
  const startDate = new Date(term.startDate);
  const diffTime = startDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if a term is in the past
 */
export const isTermPast = (term: Term): boolean => {
  const now = new Date();
  const endDate = new Date(term.endDate);
  return endDate < now;
};

/**
 * Check if a term is currently active
 */
export const isTermActive = (term: Term): boolean => {
  const now = new Date();
  const startDate = new Date(term.startDate);
  const endDate = new Date(term.endDate);
  return now >= startDate && now <= endDate;
};

/**
 * Check if a term is in the future
 */
export const isTermFuture = (term: Term): boolean => {
  const now = new Date();
  const startDate = new Date(term.startDate);
  return startDate > now;
};
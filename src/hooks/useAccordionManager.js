/**
 * useAccordionManager - Custom hook for managing accordion states
 * 
 * This hook provides a DRY solution for managing accordion open/close states
 * across different components, following the Single Responsibility Principle.
 * 
 * @description
 * - Manages multiple accordion states with unique identifiers
 * - Provides toggle functionality with support for single or multiple open accordions
 * - Follows the DRY principle by centralizing accordion state logic
 * - Supports both exclusive (single open) and non-exclusive (multiple open) modes
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.allowMultiple - Whether multiple accordions can be open simultaneously
 * @param {Object} options.initialState - Initial state for accordions
 * @returns {Object} Accordion management utilities
 */

import { useState, useCallback, useMemo } from 'react';

export const useAccordionManager = ({ 
  allowMultiple = false, 
  initialState = {} 
} = {}) => {
  const [openAccordions, setOpenAccordions] = useState(initialState);

  /**
   * Toggle an accordion's open/closed state
   * 
   * @param {string|number} groupId - The group identifier (e.g., instanceId)
   * @param {string|number} accordionId - The specific accordion identifier
   */
  const toggleAccordion = useCallback((groupId, accordionId) => {
    setOpenAccordions(prev => {
      if (allowMultiple) {
        // Multiple accordions can be open - use array to track multiple states
        const currentGroup = prev[groupId] || [];
        const isOpen = currentGroup.includes(accordionId);
        
        let newGroup;
        if (isOpen) {
          newGroup = currentGroup.filter(id => id !== accordionId);
        } else {
          newGroup = [...currentGroup, accordionId];
        }
        
        return {
          ...prev,
          [groupId]: newGroup,
        };
      } else {
        // Only one accordion can be open at a time - use single value
        const isOpen = prev[groupId] === accordionId;
        
        return {
          ...prev,
          [groupId]: isOpen ? null : accordionId,
        };
      }
    });
  }, [allowMultiple]);

  /**
   * Check if a specific accordion is open
   * 
   * @param {string|number} groupId - The group identifier
   * @param {string|number} accordionId - The specific accordion identifier
   * @returns {boolean} Whether the accordion is open
   */
  const isAccordionOpen = useCallback((groupId, accordionId) => {
    const groupState = openAccordions[groupId];
    
    if (allowMultiple) {
      return Array.isArray(groupState) && groupState.includes(accordionId);
    } else {
      return groupState === accordionId;
    }
  }, [openAccordions, allowMultiple]);

  /**
   * Open a specific accordion
   * 
   * @param {string|number} groupId - The group identifier
   * @param {string|number} accordionId - The specific accordion identifier
   */
  const openAccordion = useCallback((groupId, accordionId) => {
    setOpenAccordions(prev => {
      if (allowMultiple) {
        const currentGroup = prev[groupId] || [];
        if (!currentGroup.includes(accordionId)) {
          return {
            ...prev,
            [groupId]: [...currentGroup, accordionId],
          };
        }
        return prev;
      } else {
        return {
          ...prev,
          [groupId]: accordionId,
        };
      }
    });
  }, [allowMultiple]);

  /**
   * Close a specific accordion
   * 
   * @param {string|number} groupId - The group identifier
   * @param {string|number} accordionId - The specific accordion identifier
   */
  const closeAccordion = useCallback((groupId, accordionId) => {
    setOpenAccordions(prev => {
      if (allowMultiple) {
        const currentGroup = prev[groupId] || [];
        return {
          ...prev,
          [groupId]: currentGroup.filter(id => id !== accordionId),
        };
      } else {
        return {
          ...prev,
          [groupId]: prev[groupId] === accordionId ? null : prev[groupId],
        };
      }
    });
  }, [allowMultiple]);

  /**
   * Close all accordions
   */
  const closeAllAccordions = useCallback(() => {
    setOpenAccordions({});
  }, []);

  /**
   * Initialize accordions for a specific group
   * 
   * @param {string|number} groupId - The group identifier
   * @param {Array|string|number} defaultOpen - Default open accordion(s)
   */
  const initializeGroup = useCallback((groupId, defaultOpen = null) => {
    setOpenAccordions(prev => ({
      ...prev,
      [groupId]: allowMultiple 
        ? (Array.isArray(defaultOpen) ? defaultOpen : (defaultOpen ? [defaultOpen] : []))
        : defaultOpen,
    }));
  }, [allowMultiple]);

  /**
   * Get all open accordions for a group
   * 
   * @param {string|number} groupId - The group identifier
   * @returns {Array|string|number|null} Open accordion(s)
   */
  const getOpenAccordions = useCallback((groupId) => {
    return openAccordions[groupId] || (allowMultiple ? [] : null);
  }, [openAccordions, allowMultiple]);

  /**
   * Computed properties for easier access
   */
  const accordionState = useMemo(() => ({
    openAccordions,
    hasAnyOpen: Object.keys(openAccordions).length > 0,
    openGroupCount: Object.keys(openAccordions).length,
  }), [openAccordions]);

  return {
    // State
    ...accordionState,
    
    // Core actions
    toggleAccordion,
    isAccordionOpen,
    
    // Additional actions
    openAccordion,
    closeAccordion,
    closeAllAccordions,
    initializeGroup,
    getOpenAccordions,
    
    // Raw state for advanced usage
    setOpenAccordions,
  };
};

export default useAccordionManager;

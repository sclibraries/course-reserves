/**
 * useCourseRecords - Custom hook for managing course records state and logic
 * 
 * This hook encapsulates the business logic for course records management,
 * following the Single Responsibility Principle by separating concerns
 * from the UI component.
 * 
 * @description
 * - Manages record grouping and filtering logic
 * - Handles accordion state management
 * - Provides computed properties for record data
 * - Centralizes record-related business logic
 * 
 * @param {Array} records - Array of record data objects
 * @param {Object} options - Configuration options
 * @returns {Object} Course records management utilities
 */

import { useMemo } from 'react';
import { groupRecordsByInstanceId } from '../utils/recordUtils';
import { useAccordionManager } from './useAccordionManager';

export const useCourseRecords = (records = [], options = {}) => {
  const {
    enableFiltering = false,
    filterCriteria = null,
    groupByInstanceId = true,
  } = options;

  // Initialize accordion manager for multiple open accordions
  const accordionManager = useAccordionManager({ 
    allowMultiple: true,
    initialState: {},
  });

  /**
   * Process and group records based on configuration
   */
  const processedRecords = useMemo(() => {
    if (!Array.isArray(records) || records.length === 0) {
      return [];
    }

    let processed = records;

    // Apply filtering if enabled
    if (enableFiltering && filterCriteria) {
      processed = records.filter(filterCriteria);
    }

    // Group by instance ID if enabled
    if (groupByInstanceId) {
      processed = groupRecordsByInstanceId(processed);
    }

    return processed;
  }, [records, enableFiltering, filterCriteria, groupByInstanceId]);

  /**
   * Computed statistics for the records
   */
  const recordStats = useMemo(() => {
    const total = processedRecords.length;
    const electronic = processedRecords.filter(record => record.isElectronic).length;
    const print = total - electronic;
    
    return {
      total,
      electronic,
      print,
      hasRecords: total > 0,
      isEmpty: total === 0,
    };
  }, [processedRecords]);

  /**
   * Initialize accordion states for print reserves
   * This follows the business rule that print reserves should be open by default
   */
  const initializePrintReserveAccordions = () => {
    processedRecords.forEach(record => {
      if (!record.isElectronic && record.copiedItem?.instanceId) {
        const instanceId = record.copiedItem.instanceId;
        accordionManager.initializeGroup(instanceId, [`reserves-${instanceId}`]);
      }
    });
  };

  /**
   * Enhanced toggle function with business logic
   * 
   * @param {string|number} instanceId - The instance identifier
   * @param {string|number} accordionId - The accordion identifier
   */
  const toggleAccordionWithLogic = (instanceId, accordionId) => {
    accordionManager.toggleAccordion(instanceId, accordionId);
  };

  /**
   * Get records filtered by type
   * 
   * @param {string} type - 'electronic', 'print', or 'all'
   * @returns {Array} Filtered records
   */
  const getRecordsByType = (type) => {
    switch (type) {
      case 'electronic':
        return processedRecords.filter(record => record.isElectronic);
      case 'print':
        return processedRecords.filter(record => !record.isElectronic);
      case 'all':
      default:
        return processedRecords;
    }
  };

  /**
   * Validate record data structure
   * 
   * @param {Object} record - Record to validate
   * @returns {boolean} Whether the record is valid
   */
  const isValidRecord = (record) => {
    return (
      record &&
      typeof record === 'object' &&
      record.id &&
      record.copiedItem &&
      typeof record.copiedItem === 'object'
    );
  };

  /**
   * Get a record by its ID
   * 
   * @param {string|number} recordId - The record ID to find
   * @returns {Object|null} The found record or null
   */
  const getRecordById = (recordId) => {
    return processedRecords.find(record => record.id === recordId) || null;
  };

  return {
    // Processed data
    records: processedRecords,
    recordStats,
    
    // Accordion management
    ...accordionManager,
    toggleAccordion: toggleAccordionWithLogic,
    initializePrintReserveAccordions,
    
    // Utility functions
    getRecordsByType,
    isValidRecord,
    getRecordById,
    
    // Raw data access for advanced usage
    originalRecords: records,
  };
};

export default useCourseRecords;

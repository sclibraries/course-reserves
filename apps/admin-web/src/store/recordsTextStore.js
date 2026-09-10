/**
 * Course Records Text Store (Zustand)
 * 
 * Centralized state management for all user-facing text in the course records system.
 * Uses Zustand for lightweight, reactive state management that can be easily accessed
 * throughout the application.
 * 
 * @description
 * - Provides reactive text configuration
 * - Supports dynamic text updates
 * - Enables easy localization in the future
 * - Follows SOLID principles with clear separation of concerns
 * - Integrates seamlessly with React components
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Default text configuration object
 */
const DEFAULT_TEXT = {
  // General/Common text
  common: {
    loading: 'Loading...',
    error: 'An error occurred',
    noData: 'No data available',
    notAvailable: 'N/A',
    unknown: 'Unknown',
    total: 'total',
    item: 'item',
    items: 'items',
    digital: 'digital',
    physical: 'physical',
    electronic: 'Electronic',
    print: 'Print',
    available: 'Available',
    unavailable: 'Unavailable',
  },

  // Resource visibility and access
  visibility: {
    notCurrentlyAvailable: 'Resource not currently available',
    notCurrentlyAvailableDetailed: 'The link to this resource is not currently available due to visibility restrictions.',
    linkNotAvailable: 'Link not currently available due to visibility restrictions.',
    visibilityWindow: 'Visibility Window',
    visibilityRestrictions: 'due to visibility restrictions',
    fromDate: 'From',
    untilDate: 'until',
    noStartDate: 'No start date',
    noEndDate: 'No end date',
    linkVisibility: 'Link Visibility',
    notCurrentlyAvailableBadge: 'Not Currently Available',
  },

  // Record cards
  recordCard: {
    accessResource: 'Access Resources',
    viewInCatalog: 'View in Catalog',
    additionalResources: 'Additional Resources',
    description: 'Description',
    availabilityDetails: 'Availability Details',
    otherHoldings: 'Other Holdings',
    noAvailabilityData: 'No availability data found',
    copyOnReserve: 'Copy on Reserve',
    copiesOnReserve: 'Copies on Reserve',
    proxyEnabled: 'Proxy Enabled',
    additionalResource: 'additional resource',
  },

  // Record table
  recordTable: {
    headers: {
      folder: 'Folder',
      title: 'Title',
      authors: 'Authors',
      type: 'Type',
      publication: 'Publication',
      holdings: 'Holdings',
      discover: 'Discover',
      resource: 'Resource',
      description: 'Description',
      access: 'Access',
    },
    noRecordsFound: 'No records found',
    itemAvailabilityDetails: 'Item Availability Details',
    additionalLinks: 'Additional Links',
    additionalLink: 'additional link',
    additionalLinksPlural: 'additional links',
    linksAvailable: 'links available',
    moreLinks: 'more',
    accessResource: 'Access Resource',
    access: 'Access',
    link: 'link',
    links: 'links',
  },

  // Split view
  splitView: {
    printMaterials: 'Print Materials',
    electronicMaterials: 'Electronic Materials',
    noPrintMaterials: 'No print materials available for this course.',
    noElectronicMaterials: 'No electronic materials available for this course.',
    viewInCatalog: 'View in Catalog',
  },

  // Course records container/display
  courseRecords: {
    header: 'Course Materials',
    noRecordsFound: 'No Records Found',
    noRecordsAvailable: 'There are no course records available at this time.',
    noRecordsToDisplay: 'No records to display.',
    noCourseMaterialsFound: 'No Course Materials Found',
    noMaterialsAdded: 'No materials have been added to this course yet.',
    materialsNotCurrentlyAvailable: 'Course Materials Not Currently Available',
    resourcesScheduled: 'resource is',
    resourcesScheduledPlural: 'resources are',
    scheduledButNotAvailable: 'scheduled for this course, but',
    isNotCurrentlyAvailable: 'it is',
    areNotCurrentlyAvailable: 'they are',
    notCurrentlyAvailable: 'not currently available.',
    nextAvailableDate: 'Next available date:',
  },

  // Loading states
  loading: {
    loadingRecords: 'Loading course records...',
    loadingAvailability: 'Loading availability information...',
  },

  // Empty states
  emptyStates: {
    noMaterialsScheduled: 'No materials are currently scheduled to be available.',
    checkBackLater: 'Please check back later or contact your instructor.',
    materialsWillBeAvailable: 'Materials will be available starting',
    hiddenItemsMessage: 'Some materials are scheduled but not yet visible.',
    upcomingMaterials: 'upcoming materials',
  },

  // Accessibility text
  accessibility: {
    opensInNewTab: '(opens in a new tab)',
    opensInNewWindow: '(opens in new window)',
    expandAccordion: 'Expand to see more details',
    collapseAccordion: 'Collapse to hide details',
    listOfHoldings: 'List of holdings and availability details',
    listOfRecords: 'List of available records, their types, holdings, and access links',
    togglePopover: 'Toggle additional information',
    accessResourceAriaLabel: 'Access electronic resource for {title}',
    viewCatalogAriaLabel: 'View {title} in catalog',
    additionalResourceAriaLabel: 'Access {title}',
    accessResourceGeneric: 'Access resource (opens in a new tab)',
  },

  // Status messages
  status: {
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
    info: 'Information',
  },

  // Holdings and availability
  holdings: {
    location: 'Location',
    library: 'Library',
    status: 'Status',
    loanType: 'Loan Type',
    callNumber: 'Call Number',
    barcode: 'Barcode',
    volume: 'Volume',
    itemCopyNumber: 'Item Copy Number',
    temporaryLoanType: 'Temporary Loan Type',
    permanentLoanType: 'Permanent Loan Type',
    reserve: 'Reserve',
  },

  // Actions and buttons
  actions: {
    expand: 'Expand',
    collapse: 'Collapse',
    showMore: 'Show more',
    showLess: 'Show less',
    download: 'Download',
    print: 'Print',
    share: 'Share',
    copy: 'Copy',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    refresh: 'Refresh',
    retry: 'Retry',
  },

  // Dates and time
  dateTime: {
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    startDate: 'Start Date',
    endDate: 'End Date',
    dateRange: 'Date Range',
    noDate: 'No date specified',
  },

  // Error messages
  errors: {
    loadingFailed: 'Failed to load course records',
    networkError: 'Network connection error',
    serverError: 'Server error occurred',
    invalidData: 'Invalid data received',
    resourceUnavailable: 'Resource is currently unavailable',
    accessDenied: 'Access denied',
    notFound: 'Content not found',
  },
};

/**
 * Course Records Text Store Interface
 */
export const useRecordsTextStore = create(
  subscribeWithSelector((set, get) => ({
    // Current text configuration
    text: DEFAULT_TEXT,

    // Language/locale settings
    locale: 'en',
    
    // Actions
    
    /**
     * Get text by path with optional variable interpolation
     * 
     * @param {string} path - Dot notation path to the text (e.g., 'recordCard.accessResource')
     * @param {Object} variables - Variables to interpolate into the text
     * @returns {string} The text with variables interpolated
     */
    getText: (path, variables = {}) => {
      const state = get();
      const keys = path.split('.');
      let text = state.text;
      
      // Navigate through the nested object
      for (const key of keys) {
        if (text && typeof text === 'object' && key in text) {
          text = text[key];
        } else {
          console.warn(`Text path '${path}' not found in records text store`);
          return path; // Return the path as fallback
        }
      }
      
      // If no variables to interpolate, return the text
      if (typeof text !== 'string' || Object.keys(variables).length === 0) {
        return text;
      }
      
      // Interpolate variables using simple template replacement
      return text.replace(/\{(\w+)\}/g, (match, variable) => {
        return variables[variable] || match;
      });
    },

    /**
     * Get pluralized text based on count
     * 
     * @param {number} count - The count to determine singular/plural
     * @param {string} singularPath - Path to singular form text
     * @param {string} pluralPath - Path to plural form text (optional)
     * @returns {string} The appropriate singular or plural text
     */
    getPluralText: (count, singularPath, pluralPath = null) => {
      const { getText } = get();
      
      if (count === 1) {
        return getText(singularPath);
      }
      
      if (pluralPath) {
        return getText(pluralPath);
      }
      
      // Simple pluralization by adding 's'
      return getText(singularPath) + 's';
    },

    /**
     * Update specific text values
     * 
     * @param {string} path - Dot notation path to update
     * @param {string} value - New text value
     */
    updateText: (path, value) => {
      set((state) => {
        const keys = path.split('.');
        const newText = { ...state.text };
        let current = newText;
        
        // Navigate to the parent object
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (!(key in current)) {
            current[key] = {};
          }
          current = current[key];
        }
        
        // Set the final value
        current[keys[keys.length - 1]] = value;
        
        return { text: newText };
      });
    },

    /**
     * Bulk update multiple text values
     * 
     * @param {Object} updates - Object with path-value pairs
     */
    updateMultipleText: (updates) => {
      set((state) => {
        let newText = { ...state.text };
        
        Object.entries(updates).forEach(([path, value]) => {
          const keys = path.split('.');
          let current = newText;
          
          // Navigate to the parent object
          for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
              current[key] = {};
            }
            current = current[key];
          }
          
          // Set the final value
          current[keys[keys.length - 1]] = value;
        });
        
        return { text: newText };
      });
    },

    /**
     * Reset text to default values
     */
    resetText: () => {
      set({ text: DEFAULT_TEXT });
    },

    /**
     * Set locale (for future localization support)
     * 
     * @param {string} newLocale - Locale code (e.g., 'en', 'es', 'fr')
     */
    setLocale: (newLocale) => {
      set({ locale: newLocale });
      // Future: Load locale-specific text here
    },

    /**
     * Load text configuration from external source
     * 
     * @param {Object} textConfig - New text configuration
     */
    loadTextConfig: (textConfig) => {
      set({ text: { ...DEFAULT_TEXT, ...textConfig } });
    },
  }))
);

/**
 * Custom hook for easy text access in components
 * 
 * @param {string} path - Dot notation path to the text
 * @param {Object} variables - Variables to interpolate
 * @returns {string} The requested text
 */
export const useText = (path, variables = {}) => {
  return useRecordsTextStore((state) => state.getText(path, variables));
};

/**
 * Custom hook for pluralized text
 * 
 * @param {number} count - Count for pluralization
 * @param {string} singularPath - Path to singular text
 * @param {string} pluralPath - Path to plural text (optional)
 * @returns {string} The appropriate text
 */
export const usePluralText = (count, singularPath, pluralPath = null) => {
  return useRecordsTextStore((state) => state.getPluralText(count, singularPath, pluralPath));
};

/**
 * Selector functions for specific text categories
 */
export const selectVisibilityText = (state) => state.text.visibility;
export const selectRecordTableText = (state) => state.text.recordTable;
export const selectRecordCardText = (state) => state.text.recordCard;
export const selectCommonText = (state) => state.text.common;
export const selectAccessibilityText = (state) => state.text.accessibility;
export const selectHoldingsText = (state) => state.text.holdings;
export const selectCourseRecordsText = (state) => state.text.courseRecords;
export const selectSplitViewText = (state) => state.text.splitView;

export default useRecordsTextStore;

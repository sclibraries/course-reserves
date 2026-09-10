/**
 * @file submissionWorkflowConstants.js
 * @description Constants for submission workflow feature
 */

/**
 * Submission statuses
 */
export const SUBMISSION_STATUS = {
  SUBMITTED: 'submitted',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  UNAVAILABLE: 'unavailable'
};

/**
 * Status configuration for badges and display
 */
export const STATUS_CONFIG = {
  [SUBMISSION_STATUS.SUBMITTED]: {
    color: 'info',
    label: 'Submitted',
    icon: '📝'
  },
  [SUBMISSION_STATUS.IN_PROGRESS]: {
    color: 'warning',
    label: 'In Progress',
    icon: '⚙️'
  },
  [SUBMISSION_STATUS.COMPLETE]: {
    color: 'success',
    label: 'Complete',
    icon: '✅'
  },
  [SUBMISSION_STATUS.UNAVAILABLE]: {
    color: 'danger',
    label: 'Unavailable',
    icon: '❌'
  }
};

/**
 * Priority levels
 */
export const PRIORITY_LEVEL = {
  URGENT: 'urgent',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  NORMAL: 'normal'
};

/**
 * Priority configuration for badges and display
 */
export const PRIORITY_CONFIG = {
  [PRIORITY_LEVEL.URGENT]: {
    color: 'danger',
    label: 'Urgent',
    icon: '🔴',
    threshold: 7 // days
  },
  [PRIORITY_LEVEL.HIGH]: {
    color: 'warning',
    label: 'High',
    icon: '🟡',
    threshold: 14 // days
  },
  [PRIORITY_LEVEL.NORMAL]: {
    color: 'secondary',
    label: 'Normal',
    icon: '⚪',
    threshold: null
  }
};

/**
 * Item statuses (for individual resources in a submission)
 */
export const ITEM_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  UNAVAILABLE: 'unavailable'
};

/**
 * Item status configuration
 */
export const ITEM_STATUS_CONFIG = {
  [ITEM_STATUS.PENDING]: {
    color: 'secondary',
    label: 'Pending',
    description: 'Not yet started'
  },
  [ITEM_STATUS.IN_PROGRESS]: {
    color: 'warning',
    label: 'In Progress',
    description: 'Currently being processed'
  },
  [ITEM_STATUS.COMPLETE]: {
    color: 'success',
    label: 'Complete',
    description: 'Ready for pickup'
  },
  [ITEM_STATUS.UNAVAILABLE]: {
    color: 'danger',
    label: 'Unavailable',
    description: 'Cannot be fulfilled'
  }
};

/**
 * Item priority levels
 */
export const ITEM_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

/**
 * Item priority configuration
 */
export const ITEM_PRIORITY_CONFIG = {
  [ITEM_PRIORITY.LOW]: {
    color: 'secondary',
    label: 'Low'
  },
  [ITEM_PRIORITY.MEDIUM]: {
    color: 'info',
    label: 'Medium'
  },
  [ITEM_PRIORITY.HIGH]: {
    color: 'warning',
    label: 'High'
  }
};

/**
 * Material types
 */
export const MATERIAL_TYPE = {
  BOOK: 'book',
  ARTICLE: 'article',
  VIDEO: 'video',
  AUDIO: 'audio',
  WEBSITE: 'website',
  OTHER: 'other'
};

/**
 * Material type icons
 */
export const MATERIAL_TYPE_ICONS = {
  [MATERIAL_TYPE.BOOK]: '📚',
  [MATERIAL_TYPE.ARTICLE]: '📄',
  [MATERIAL_TYPE.VIDEO]: '🎥',
  [MATERIAL_TYPE.AUDIO]: '🎵',
  [MATERIAL_TYPE.WEBSITE]: '🌐',
  [MATERIAL_TYPE.OTHER]: '📎'
};

/**
 * Default pagination settings
 */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PER_PAGE: 20,
  MAX_PER_PAGE: 100
};

/**
 * Date format strings
 */
export const DATE_FORMATS = {
  SHORT: 'MM/DD/YYYY',
  LONG: 'MMMM D, YYYY',
  WITH_TIME: 'MM/DD/YYYY h:mm A',
  ISO: 'YYYY-MM-DD'
};

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  FETCH_SUBMISSIONS_FAILED: 'Failed to load submissions. Please try again.',
  FETCH_DETAIL_FAILED: 'Failed to load submission details. Please try again.',
  LOCK_FAILED: 'Failed to lock submission. It may already be locked by another user.',
  UNLOCK_FAILED: 'Failed to unlock submission. Please try again.',
  UPDATE_STATUS_FAILED: 'Failed to update item status. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNAUTHORIZED: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested submission could not be found.'
};

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  SUBMISSION_LOCKED: 'Submission locked successfully.',
  SUBMISSION_UNLOCKED: 'Submission unlocked successfully.',
  STATUS_UPDATED: 'Item status updated successfully.',
  NOTE_ADDED: 'Note added successfully.'
};

/**
 * Lock reasons (predefined options)
 */
export const LOCK_REASONS = {
  PROCESSING: 'Processing items',
  REVIEWING: 'Reviewing submission',
  CONTACTING_FACULTY: 'Contacting faculty',
  WAITING_FOR_MATERIALS: 'Waiting for materials',
  OTHER: 'Other'
};

/**
 * Filter options for submission queue
 */
export const FILTER_OPTIONS = {
  STATUS: {
    ALL: 'all',
    SUBMITTED: SUBMISSION_STATUS.SUBMITTED,
    IN_PROGRESS: SUBMISSION_STATUS.IN_PROGRESS,
    COMPLETE: SUBMISSION_STATUS.COMPLETE
  },
  PRIORITY: {
    ALL: 'all',
    URGENT: PRIORITY_LEVEL.URGENT,
    HIGH: PRIORITY_LEVEL.HIGH,
    NORMAL: PRIORITY_LEVEL.NORMAL
  }
};

/**
 * Sort options for submission queue
 */
export const SORT_OPTIONS = {
  SUBMITTED_DATE_DESC: 'submitted_date_desc',
  SUBMITTED_DATE_ASC: 'submitted_date_asc',
  COURSE_CODE_ASC: 'course_code_asc',
  COURSE_CODE_DESC: 'course_code_desc',
  PRIORITY_DESC: 'priority_desc',
  PROGRESS_ASC: 'progress_asc',
  PROGRESS_DESC: 'progress_desc'
};

/**
 * View modes
 */
export const VIEW_MODE = {
  TABLE: 'table',
  CARD: 'card'
};

/**
 * Progress thresholds for color coding
 */
export const PROGRESS_THRESHOLDS = {
  LOW: 25,      // 0-25% = danger
  MEDIUM: 75,   // 26-75% = warning
  HIGH: 100     // 76-100% = success
};

/**
 * Permission constants
 */
export const PERMISSIONS = {
  MANAGE_SUBMISSIONS: 'manage_submissions',
  VIEW_SUBMISSIONS: 'view_submissions',
  LOCK_SUBMISSIONS: 'lock_submissions',
  UPDATE_ITEM_STATUS: 'update_item_status'
};

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  VIEW_MODE: 'submission_queue_view_mode',
  FILTERS: 'submission_queue_filters',
  SORT: 'submission_queue_sort'
};

/**
 * UI Configuration
 */
export const UI_CONFIG = {
  DEBOUNCE_DELAY: 300, // ms for search input debouncing
  TOAST_DURATION: 3000, // ms for toast notifications
  MODAL_ANIMATION_DURATION: 200, // ms
  SCROLL_TOP_THRESHOLD: 200 // px before showing scroll-to-top button
};

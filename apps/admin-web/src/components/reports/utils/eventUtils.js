/**
 * Get appropriate color for event type badge
 * @param {string} eventType - Type of event
 * @returns {string} Bootstrap color name
 */
export const getEventBadgeColor = (eventType) => {
    const colorMap = {
      'course_access': 'success',
      'search': 'primary', 
      'college_change': 'warning',
      'term_change': 'info',
      'department_change': 'success',
      'item_access': 'secondary',
      'login': 'success',
      'logout': 'danger',
      'export': 'dark'
    };
    
    return colorMap[eventType] || 'secondary';
  };
  
  /**
   * Format event type for display (convert snake_case to Title Case)
   * @param {string} eventType - Event type in snake_case
   * @returns {string} Formatted event type
   */
  export const formatEventType = (eventType) => {
    if (!eventType) return 'Unknown';
    
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
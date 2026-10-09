/**
 * Format date for display
 * @param {string|Date} dateString - Date to format
 * @param {boolean} includeTime - Whether to include time in the formatted result
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString, includeTime = true) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        ...(includeTime && {
          hour: '2-digit',
          minute: '2-digit'
        })
      };
      
      return date.toLocaleDateString(undefined, options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Error';
    }
  };
  
  /**
   * Get relative time (e.g., "2 hours ago")
   * @param {string|Date} dateString - Date to format
   * @returns {string} Relative time string
   */
  export const getRelativeTime = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
      const now = new Date();
      const diffInSeconds = Math.floor((date - now) / 1000);
      
      // Convert to appropriate units
      if (Math.abs(diffInSeconds) < 60) {
        return rtf.format(diffInSeconds, 'second');
      } else if (Math.abs(diffInSeconds) < 3600) {
        return rtf.format(Math.floor(diffInSeconds / 60), 'minute');
      } else if (Math.abs(diffInSeconds) < 86400) {
        return rtf.format(Math.floor(diffInSeconds / 3600), 'hour');
      } else if (Math.abs(diffInSeconds) < 2592000) {
        return rtf.format(Math.floor(diffInSeconds / 86400), 'day');
      } else if (Math.abs(diffInSeconds) < 31536000) {
        return rtf.format(Math.floor(diffInSeconds / 2592000), 'month');
      } else {
        return rtf.format(Math.floor(diffInSeconds / 31536000), 'year');
      }
    } catch (error) {
      console.error('Error getting relative time:', error);
      return 'Error';
    }
  };
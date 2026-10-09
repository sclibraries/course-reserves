/**
 * Format metadata differently based on event type
 * @param {string} eventType - Type of event
 * @param {object} data - Metadata object
 * @returns {object} Formatted summary with label and optional badge
 */
export const formatMetadataByEventType = (eventType, data) => {
    // Default response
    const defaultResult = { 
      label: 'Click to view details'
    };
  
    if (!data || !eventType) {
      return defaultResult;
    }
  
    // Event type specific formatters
    switch (eventType) {
      case 'search': {
        const query = extractValue(data, ['query', 'searchTerm', 'q']);
        return query ? {
          label: `Search: "${query}"`,
          badge: { text: 'Query', color: 'info' }
        } : defaultResult;
      }
  
      case 'course_access': {
        const title = extractValue(data, ['title', 'courseName', 'name']);
        return title ? {
          label: `Viewed: ${title}`,
          badge: { text: 'Course', color: 'primary' }
        } : defaultResult;
      }
  
      case 'department_change': {
        const deptValue = extractValue(data, ['value', 'department', 'dept', 'newValue', 'new.value', 'new.department']);
        return deptValue ? {
          label: `Changed to: ${deptValue}`,
          badge: { text: 'Dept', color: 'success' }
        } : defaultResult;
      }
  
      case 'college_change': {
        const collegeValue = extractValue(data, ['value', 'college', 'newValue', 'new.value', 'new.college']);
        return collegeValue ? {
          label: `Changed to: ${collegeValue}`,
          badge: { text: 'College', color: 'warning' }
        } : defaultResult;
      }
  
      case 'term_change': {
        const termValue = extractValue(data, ['value', 'term', 'newValue', 'new.value', 'new.term', 'termName']);
        return termValue ? {
          label: `Changed to: ${termValue}`,
          badge: { text: 'Term', color: 'dark' }
        } : defaultResult;
      }
  
      case 'item_access': {
        const itemTitle = extractValue(data, ['title', 'itemTitle', 'name']);
        return itemTitle ? {
          label: `Accessed: ${itemTitle}`,
          badge: { text: 'Item', color: 'secondary' }
        } : defaultResult;
      }
  
      default:
        return defaultResult;
    }
  };

  /**
 * Extract a value from an object checking multiple possible paths
 * @param {object} data - Object to extract from
 * @param {string[]} paths - Array of possible paths to check
 * @returns {string|null} The extracted value or null
 */
  export const extractValue = (data, paths) => {
    if (!data || typeof data !== 'object') return null;
    
    for (const path of paths) {
      // Handle dot notation (e.g., 'new.value')
      if (path.includes('.')) {
        const parts = path.split('.');
        let current = data;
        
        // Navigate down the path
        for (const part of parts) {
          if (current && current[part] !== undefined) {
            current = current[part];
          } else {
            current = undefined;
            break;
          }
        }
        
        if (current !== undefined) {
          return String(current);
        }
      } 
      // Direct property access
      else if (data[path] !== undefined) {
        return String(data[path]);
      }
    }
    
    return null;
  };

  /**
 * Safely parse JSON data
 * @param {string|object} jsonData - JSON string or object to parse
 * @returns {object|null} Parsed object or null if invalid
 */
export const safeParseJSON = (jsonData) => {
    // If it's already an object, return it
    if (jsonData && typeof jsonData === 'object') {
      return jsonData;
    }
  
    // If it's a string, try to parse it
    if (typeof jsonData === 'string') {
      try {
        return JSON.parse(jsonData);
      } catch (error) {
        console.error("Error parsing metadata JSON:", error);
        return null;
      }
    }
  
    // Otherwise return null
    return null;
  };
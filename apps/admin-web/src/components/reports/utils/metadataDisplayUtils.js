/**
 * Utility functions for parsing and formatting tracking event metadata
 */

/**
 * Parse metadata JSON safely
 * @param {string} metadataString - JSON string from metadata field
 * @returns {Object|null} Parsed metadata or null if invalid
 */
export const parseMetadata = (metadataString) => {
  if (!metadataString) return null;
  
  try {
    return JSON.parse(metadataString);
  } catch (error) {
    console.warn('Failed to parse metadata:', error);
    return null;
  }
};

/**
 * Format metadata for display based on event type
 * @param {string} eventType - The type of event
 * @param {Object} metadata - Parsed metadata object
 * @returns {Object} Formatted metadata for display
 */
export const formatMetadataForDisplay = (eventType, metadata) => {
  if (!metadata) return null;

  switch (eventType) {
    case 'resource_click':
    case 'resource_view':
    case 'resource_access':
      return {
        type: 'Resource Access',
        title: metadata.record_title || metadata.name || 'Unknown Resource',
        resourceId: metadata.resourceId || metadata.instanceId,
        url: metadata.target_url,
        additionalInfo: {
          'Instance ID': metadata.instanceId,
          'Resource ID': metadata.resourceId
        }
      };

    case 'course_access':
    case 'course_view':
      return {
        type: 'Course Access',
        title: metadata.course_name || metadata.name || 'Course Access',
        additionalInfo: {
          'Course ID': metadata.course_id,
          'Section': metadata.section,
          'Instructor': metadata.instructor
        }
      };

    case 'search':
      return {
        type: 'Search Activity',
        title: `Search: "${metadata.query || metadata.search_term || 'Unknown Query'}"`,
        additionalInfo: {
          'Results Count': metadata.results_count,
          'Search Type': metadata.search_type,
          'Filters Applied': metadata.filters
        }
      };

    case 'download':
      return {
        type: 'Download',
        title: metadata.file_name || metadata.name || 'File Download',
        additionalInfo: {
          'File Type': metadata.file_type,
          'File Size': metadata.file_size,
          'Download URL': metadata.download_url
        }
      };

    case 'login':
    case 'authentication':
      return {
        type: 'Authentication',
        title: 'User Login/Authentication',
        additionalInfo: {
          'Auth Method': metadata.auth_method,
          'Success': metadata.success ? 'Yes' : 'No',
          'IP Address': metadata.ip_address
        }
      };

    default: {
      // Generic metadata display
      const title = metadata.name || metadata.title || metadata.action || 'Event Data';
      const additionalInfo = {};
      
      // Extract common fields
      Object.keys(metadata).forEach(key => {
        if (!['name', 'title', 'action'].includes(key)) {
          additionalInfo[key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())] = metadata[key];
        }
      });

      return {
        type: 'General Event',
        title,
        additionalInfo
      };
    }
  }
};

/**
 * Get a short summary of metadata for table display
 * @param {string} eventType - The type of event
 * @param {Object} metadata - Parsed metadata object
 * @returns {string} Short summary text
 */
export const getMetadataSummary = (eventType, metadata) => {
  if (!metadata) return 'No additional data';

  switch (eventType) {
    case 'resource_click':
    case 'resource_view':
    case 'resource_access':
      return metadata.record_title || metadata.name || 'Resource accessed';

    case 'search':
      return `Search: "${metadata.query || metadata.search_term || 'Unknown'}"`;

    case 'download':
      return `Downloaded: ${metadata.file_name || 'Unknown file'}`;

    case 'course_access':
      return metadata.course_name || 'Course accessed';

    default:
      return metadata.name || metadata.action || metadata.title || 'Event data available';
  }
};

/**
 * Extract the most important field from metadata for quick display
 * @param {Object} metadata - Parsed metadata object
 * @returns {string} Most relevant field value
 */
export const getPrimaryMetadataField = (metadata) => {
  if (!metadata) return null;

  // Priority order for display
  const priorityFields = [
    'record_title',
    'name', 
    'title',
    'query',
    'search_term',
    'file_name',
    'course_name',
    'action'
  ];

  for (const field of priorityFields) {
    if (metadata[field]) {
      return metadata[field];
    }
  }

  return null;
};

/**
 * Check if metadata contains a URL
 * @param {Object} metadata - Parsed metadata object
 * @returns {string|null} URL if found
 */
export const extractUrlFromMetadata = (metadata) => {
  if (!metadata) return null;

  const urlFields = ['target_url', 'url', 'download_url', 'link'];
  
  for (const field of urlFields) {
    if (metadata[field]) {
      return metadata[field];
    }
  }

  return null;
};

/**
 * Group events by metadata type for summary statistics
 * @param {Array} events - Array of events with metadata
 * @returns {Object} Grouped statistics
 */
export const groupEventsByMetadataType = (events) => {
  const groups = {};

  events.forEach(event => {
    const metadata = parseMetadata(event.metadata);
    if (!metadata) return;

    const formatted = formatMetadataForDisplay(event.event_type, metadata);
    if (!formatted) return;

    const groupKey = formatted.type;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        count: 0,
        events: [],
        sampleTitles: new Set()
      };
    }

    groups[groupKey].count++;
    groups[groupKey].events.push(event);
    
    if (formatted.title && groups[groupKey].sampleTitles.size < 3) {
      groups[groupKey].sampleTitles.add(formatted.title);
    }
  });

  // Convert sampleTitles Sets to arrays
  Object.keys(groups).forEach(key => {
    groups[key].sampleTitles = Array.from(groups[key].sampleTitles);
  });

  return groups;
};

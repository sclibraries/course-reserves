/**
 * Utility functions for CSV export functionality
 */

/**
 * Converts an array of objects to CSV format
 * @param {Array} data - Array of objects to convert
 * @param {Array} columns - Array of column definitions with key and label
 * @returns {string} CSV formatted string
 */
export const convertToCSV = (data, columns) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Create header row
  const headers = columns.map(col => `"${col.label}"`).join(',');
  
  // Create data rows
  const rows = data.map(item => {
    return columns.map(col => {
      let value = item[col.key];
      
      // Handle different data types
      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      } else {
        value = String(value);
      }
      
      // Escape quotes and wrap in quotes
      value = value.replace(/"/g, '""');
      return `"${value}"`;
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
};

/**
 * Downloads a CSV file
 * @param {string} csvContent - CSV formatted string
 * @param {string} filename - Name of the file to download
 */
export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Export tracking events to CSV
 * @param {Array} events - Array of tracking events
 * @param {string} filename - Optional filename
 */
export const exportEventsToCSV = (events, filename = 'tracking-events.csv') => {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'event_type', label: 'Event Type' },
    { key: 'course_name', label: 'Course Name' },
    { key: 'course_code', label: 'Course Code' },
    { key: 'college', label: 'College' },
    { key: 'term', label: 'Term' },
    { key: 'course_id', label: 'Course ID' },
    { key: 'instructor', label: 'Instructor' },
    { key: 'created_at', label: 'Created At' },
    { key: 'metadata', label: 'Metadata' }
  ];
  
  const csvContent = convertToCSV(events, columns);
  downloadCSV(csvContent, filename);
};

/**
 * Export courses data to CSV
 * @param {Array} courses - Array of course data
 * @param {string} filename - Optional filename
 */
export const exportCoursesToCSV = (courses, filename = 'courses-data.csv') => {
  const columns = [
    { key: 'name', label: 'Course Name' },
    { key: 'college', label: 'College' },
    { key: 'term', label: 'Term' },
    { key: 'count', label: 'Access Count' }
  ];
  
  const csvContent = convertToCSV(courses, columns);
  downloadCSV(csvContent, filename);
};

/**
 * Export analytics data to CSV
 * @param {Object} analyticsData - Analytics data object
 * @param {string} filename - Optional filename
 */
export const exportAnalyticsToCSV = (analyticsData, filename = 'analytics-data.csv') => {
  const {
    collegeData = [],
    eventTypeData = [],
    topCourses = [],
    topActions = []
  } = analyticsData;
  
  // Create a comprehensive dataset
  const combinedData = [];
  
  // Add college data
  collegeData.forEach(item => {
    combinedData.push({
      type: 'College Data',
      name: item.college || item.name,
      value: item.value || item.count,
      category: 'College Access'
    });
  });
  
  // Add event type data
  eventTypeData.forEach(item => {
    combinedData.push({
      type: 'Event Type Data',
      name: item.event_type || item.name,
      value: item.value || item.count,
      category: 'Event Types'
    });
  });
  
  // Add top courses
  topCourses.forEach(item => {
    combinedData.push({
      type: 'Top Courses',
      name: item.name,
      value: item.count,
      category: 'Course Access',
      college: item.college,
      term: item.term
    });
  });
  
  // Add top actions
  topActions.forEach(item => {
    combinedData.push({
      type: 'Top Actions',
      name: item.action || item.name,
      value: item.count,
      category: 'Actions'
    });
  });
  
  const columns = [
    { key: 'type', label: 'Data Type' },
    { key: 'category', label: 'Category' },
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Count/Value' },
    { key: 'college', label: 'College' },
    { key: 'term', label: 'Term' }
  ];
  
  const csvContent = convertToCSV(combinedData, columns);
  downloadCSV(csvContent, filename);
};

/**
 * Format date for filename
 * @returns {string} Formatted date string
 */
export const getDateForFilename = () => {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD format
};

/**
 * Generate filename with timestamp
 * @param {string} baseName - Base name for the file
 * @param {string} extension - File extension (default: csv)
 * @returns {string} Filename with timestamp
 */
export const generateTimestampedFilename = (baseName, extension = 'csv') => {
  const timestamp = getDateForFilename();
  return `${baseName}-${timestamp}.${extension}`;
};

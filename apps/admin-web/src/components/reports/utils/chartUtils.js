/**
 * Filter out invalid or system colleges
 * @param {Array} collegeData - Raw college data
 * @returns {Array} Filtered college data
 */
export const filterValidColleges = (collegeData = []) => {
    if (!collegeData || !Array.isArray(collegeData)) return [];
    
    return collegeData
      .filter(item => 
        item && 
        item.college &&
        item.college !== 'N/A' && 
        item.college !== 'null' && 
        item.college !== 'NULL' && 
        item.college !== 'Unknown' &&
        item.college.toLowerCase() !== 'unknown' &&
        item.college !== 'default'
      )
      .map(item => ({
        college: item.college,
        value: Number(item.value) || 0
      }));
  };
  
  /**
   * Format time series data for charts
   * @param {Array} timeSeriesData - Raw time series data
   * @returns {Array} Formatted time series data
   */
  export const formatTimeSeriesData = (timeSeriesData = []) => {
    if (!timeSeriesData || !Array.isArray(timeSeriesData)) return [];
    
    return timeSeriesData
      .map(item => ({
        date: item.date,
        count: Number(item.count) || 0
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };
  
  /**
   * Format event type data for charts
   * @param {Array} eventTypeData - Raw event type data
   * @returns {Array} Formatted event type data
   */
  export const formatEventTypeData = (eventTypeData = []) => {
    if (!eventTypeData || !Array.isArray(eventTypeData)) return [];
    
    return eventTypeData
      .filter(item => item && item.name)
      .map(item => ({
        name: formatEventTypeName(item.name),
        value: Number(item.value) || 0,
        rawName: item.name // Keep original name for reference
      }));
  };
  
  /**
   * Format event type name for display
   * @param {string} eventType - Raw event type name
   * @returns {string} Formatted name
   */
  export const formatEventTypeName = (eventType) => {
    if (!eventType) return 'Unknown';
    
    // Convert snake_case to Title Case
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
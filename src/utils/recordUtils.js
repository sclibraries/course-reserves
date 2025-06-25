/**
 * Groups record items by instanceId to avoid duplicate display
 * 
 * @param {Array} recordItems - Array of record items
 * @returns {Array} Array of grouped record items
 */
export const groupRecordsByInstanceId = (recordItems) => {
  if (!recordItems || !Array.isArray(recordItems)) return [];
  
  const groupedRecords = {};
  
  // Group records by instanceId
  recordItems.forEach(record => {
    const instanceId = record.copiedItem?.instanceId;
    if (!instanceId) return;
    
    if (!groupedRecords[instanceId]) {
      // Create a new group with this record as base
      groupedRecords[instanceId] = { 
        ...record, 
        mergedCopies: [record],
        // Flag this as a merged record
        isMergedRecord: true
      };
    } else {
      // Add this record to existing group's mergedCopies array
      groupedRecords[instanceId].mergedCopies.push(record);
    }
  });
  
  // Convert object back to array
  return Object.values(groupedRecords);
};

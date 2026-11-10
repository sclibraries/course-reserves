import { discoveryResultToCourseItem } from '@course-reserves/citations';

export const getEdsMaterialType = (parsedRecord) => {
  const detectedType = discoveryResultToCourseItem(parsedRecord).materialType;
  if (detectedType === 'chapter') return 'book';
  if (detectedType === 'video') return 'media';
  if (detectedType === 'other') {
    return parsedRecord.publicationType.toLowerCase().includes('media') ? 'media' : 'website';
  }
  return detectedType;
};

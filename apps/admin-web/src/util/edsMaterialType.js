import { discoveryResultToCourseItem } from '@course-reserves/citations';

const VIDEO_MATERIAL_TYPE_ID = '3';

export const isVideoMaterialType = (id) => String(id) === VIDEO_MATERIAL_TYPE_ID;

export const getEdsMaterialType = (parsedRecord) => {
  const detectedType = discoveryResultToCourseItem(parsedRecord).materialType;
  if (detectedType === 'chapter') return 'book';
  if (detectedType === 'video') return 'media';
  if (detectedType === 'other') {
    return parsedRecord.publicationType.toLowerCase().includes('media') ? 'media' : 'website';
  }
  return detectedType;
};

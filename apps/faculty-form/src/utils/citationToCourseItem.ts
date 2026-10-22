import { citationToCourseItem as createCitationCourseItem } from '@course-reserves/citations';
import type { CourseItem } from '@/store/courseReservesStore';

export function citationToCourseItem(citation: string): Partial<CourseItem> {
  return createCitationCourseItem(citation);
}

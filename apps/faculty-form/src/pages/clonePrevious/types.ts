import type { Course } from '@/store/courseSearchStore';

export interface CourseResource {
  id: string;
  title: string;
  type: 'book' | 'article' | 'link' | 'file' | 'video' | 'other';
  author?: string;
  publicationInfo?: string;
  url?: string;
  notes?: string;
  status: 'active' | 'pending' | 'inactive';
}

export interface Contributor {
  name: string;
  contributorTypeId: string;
  contributorTypeText: string;
  contributorNameTypeId: string;
  primary: boolean;
}

export interface Publication {
  publisher: string;
  place: string;
  dateOfPublication: string;
  role: string;
}

export interface CopiedItem {
  barcode: string;
  title: string;
  contributors: Contributor[];
  publication: Publication[];
  callNumber: string;
  copy: string;
  instanceId: string;
  instanceHrid: string;
}

export interface PhysicalReserve {
  id: string;
  courseListingId: string;
  itemId: string;
  copiedItem: CopiedItem;
  temporaryLoanTypeId: string;
}

export interface ElectronicResource {
  resource_type: string;
  id: string;
  title: string;
  item_url?: string;
  description?: string;
  external_note?: string;
  internal_note?: string;
  folder_id?: string;
  folder_name?: string;
  course_resource_id: string;
  order: string;
}

export interface DisplayCourse {
  id: string;
  courseNumber: string;
  courseTitle: string;
  departmentName: string;
  instructor: string;
  term: string;
  resourceCount: number | 'loading';
  courseListingId: string;
}

export interface CourseTermGroup {
  term: string;
  courses: Array<{ course: Course; displayCourse: DisplayCourse }>;
}

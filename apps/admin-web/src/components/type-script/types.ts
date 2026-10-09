export type Metadata = {
  createdDate: string;
  createdByUserId: string;
  updatedDate: string;
  updatedByUserId: string;
};

export type Department = {
  id: string;
  name: string;
  description?: string;
  metadata?: Metadata;
};

export type ServicePoint = {
  id: string;
  name?: string;
  code?: string;
};

export type Location = {
  id: string;
  name: string;
  code: string;
  discoveryDisplayName: string;
  isActive: boolean;
  institutionId: string;
  campusId: string;
  libraryId: string;
  primaryServicePoint: string;
  servicePointIds: string[];
};

export type Term = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type CourseType = {
  id: string;
  name: string;
  description: string;
};

export type Instructor = {
  id: string;
  userId: string;
  name: string;
  barcode?: string;
  courseListingId: string;
  metadata: Metadata;
};

export type CourseListing = {
  id: string;
  locationId: string;
  locationObject: Location;
  termId: string;
  termObject: Term;
  courseTypeId: string;
  courseTypeObject: CourseType;
  instructorObjects: Instructor[];
  metadata: Metadata;
};

export type Course = {
  id: string;
  name: string;
  courseNumber: string;
  departmentId: string;
  departmentObject: Department;
  courseListingId: string;
  courseListingObject: CourseListing;
  metadata: Metadata;
  // Keeping these fields for backward compatibility
  title?: string;
  departmentName?: string;
  instructors?: string[];
  term?: string;
  location?: string;
  status?: "active" | "inactive" | "pending";
};

export type AdditionalLink = {
  title: string;
  url: string;
  description: string;
  useProxy: boolean;
};

export type ResourceMetadata = {
  internalNote?: string;
  externalNote?: string;
  useProxy?: boolean;
  folder?: string;
  visibilityStart?: string;
  visibilityEnd?: string;
  additionalLinks?: AdditionalLink[];
};

export type Resource = {
  id: string;
  name: string;
  url?: string;
  description?: string;
  authors?: string[];
  publication?: string;
  materialType: string;
  createdAt: string;
  coursesCount: number;
  metadata?: ResourceMetadata;
  availability?: {
    location: string;
    library: string;
    status: "available" | "checked-out" | "on-hold";
    loanType: string;
    callNumber: string;
    barcode: string;
  };
};

export type SearchFilters = {
  institution: string;
  department: string;
  searchArea: string;
  term: string;
  sortBy: string;
  query: string;
};

export type ReportEvent = {
  id: string;
  type: string;
  courseId?: string;
  courseName?: string;
  date: string;
  user?: string;
  description: string;
  data?: any;
};

export type College = {
  id: string;
  name: string;
};

import type { StateCreator } from 'zustand';

export interface FolioLocation {
  id: string;
  name: string;
  code: string;
  discoveryDisplayName?: string;
  isActive?: boolean;
  institutionId?: string;
  campusId?: string;
  libraryId?: string;
  primaryServicePoint?: string;
  servicePointIds?: string[];
}

export interface FolioCopiedItem {
  barcode?: string;
  callNumber?: string;
  copy?: string;
  instanceId?: string;
  instanceHrid?: string;
  instanceDiscoverySuppress?: boolean;
  holdingsId?: string;
  title?: string;
  contributors?: Array<{
    name: string;
    contributorTypeId?: string;
    contributorTypeText?: string;
    contributorNameTypeId?: string;
    primary?: boolean;
  }>;
  publication?: Array<{
    publisher?: string;
    place?: string;
    dateOfPublication?: string;
    role?: string;
  }>;
  temporaryLocationId?: string;
  temporaryLocationObject?: FolioLocation;
  permanentLocationId?: string;
  permanentLocationObject?: FolioLocation;
  effectiveCallNumberComponents?: {
    callNumber?: string;
  };
  [key: string]: unknown; // Allow additional properties
}

export interface CourseItem {
  id: string;
  backendItemId?: string; // The actual database ID from backend (e.g., "259", "260")
  title: string;
  authors?: string;
  isbn?: string;
  publisher?: string;
  publicationYear?: string;
  edition?: string;
  pages?: string;
  chapterTitle?: string;
  journalTitle?: string;
  volume?: string;
  issue?: string;
  doi?: string;
  url?: string;
  materialType: 'book' | 'article' | 'chapter' | 'video' | 'website' | 'other';
  status: 'draft' | 'pending' | 'in-progress' | 'complete' | 'needs-review';
  notes?: string;
  libraryNotes?: string;
  folderId?: string; // If item belongs to a folder
  displayOrder?: number; // Order position from backend
  // Optional display window (ISO date strings)
  displayStartDate?: string;
  displayEndDate?: string;
  // Optional attachment metadata (no file contents stored)
  hasAttachment?: boolean;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentType?: string;

  // Physical item metadata (for reuse from previous courses)
  barcode?: string; // Maps to source_barcode
  callNumber?: string; // Maps to source_call_number
  copy?: string; // Copy number
  instanceId?: string; // FOLIO instance ID - maps to source_folio_instance_id
  holdingsId?: string; // FOLIO holdings ID - maps to source_resource_id
  instanceHrid?: string; // FOLIO instance human-readable ID

  // Location information
  temporaryLocationId?: string;
  temporaryLocationObject?: FolioLocation;
  permanentLocationId?: string;
  permanentLocationObject?: FolioLocation;

  // Full copiedItem data from FOLIO (preserved for backend)
  copiedItem?: FolioCopiedItem;
}

export interface CourseFolder {
  id: string;
  backendFolderId?: string; // The actual database ID from backend
  title: string;
  description?: string;
  isOpen: boolean; // Whether folder is expanded in UI
  items: CourseItem[];
  position?: number; // Position in the overall list (for ordering with items)
}

export interface CourseReserveItem {
  type: 'item' | 'folder';
  item?: CourseItem;
  folder?: CourseFolder;
}

export interface CourseReserve {
  id: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  instructors: string;
  term: string;
  status: 'draft' | 'in-progress' | 'submitted' | 'complete';
  items: CourseItem[];
  folders: CourseFolder[];
  lastUpdated: string;
  isTestData?: boolean; // Flag to distinguish test data from user-created
  courseAssignmentId?: string; // Link to course assignment (if created from assignment)

  // Lock status fields from backend
  assigneeStaffUserId?: string | null; // Staff member assigned (locks the course for editing)
  isLocked?: boolean; // Computed flag - true if assigneeStaffUserId is set
  lockedAt?: string | null; // ISO timestamp when locked
  lockedBy?: string | null; // Staff name who locked it
  lockReason?: string | null; // Reason for locking
  canEdit?: boolean; // Backend flag indicating if current user can edit
  access?: 'owner' | 'proxy' | 'co_instructor';
  proxyCanEdit?: boolean;

  // Submission fields
  submissionNotes?: string | null; // Faculty notes about the submission
  neededByDate?: string | null; // ISO date string when materials are needed
}

export interface CourseReservesState {
  // Data
  reserves: CourseReserve[];
  _initialized: boolean;
  loading: boolean;
  error: string | null;
  pollingInterval: NodeJS.Timeout | null; // For auto-refresh

  // Actions
  initialize: () => void; // Initialize with test data if needed
  fetchSubmissions: (silent?: boolean) => Promise<void>; // Fetch submissions from backend
  fetchSubmissionDetails: (submissionId: string, silent?: boolean) => Promise<CourseReserve | null>; // Fetch single submission with materials
  deleteSubmission: (submissionId: string) => Promise<boolean>; // Delete a submission via API (only if not locked)
  applyLockState: (submissionId: string, lockData: { locked_by?: string | null; locked_at?: string | null; lock_reason?: string | null }) => void;
  startPolling: (intervalMs?: number) => void; // Start auto-refresh polling
  stopPolling: () => void; // Stop auto-refresh polling
  clearAllData: () => void; // Clear all reserves (for logout)
  addReserve: (reserve: Omit<CourseReserve, 'id' | 'lastUpdated'>) => string;
  findReserveByAssignmentId: (courseAssignmentId: string) => CourseReserve | undefined; // Find reserve by course assignment ID
  updateReserve: (id: string, updates: Partial<CourseReserve>) => void;
  deleteReserve: (id: string) => void;

  // Item actions
  addItem: (reserveId: string, item: Omit<CourseItem, 'id'>) => boolean;
  updateItem: (reserveId: string, itemId: string, updates: Partial<CourseItem>) => void;
  deleteItem: (reserveId: string, itemId: string) => void;
  reorderItems: (reserveId: string, itemIds: string[]) => void;
  moveItemToPosition: (reserveId: string, itemId: string, position: number) => void;

  // Folder actions
  createFolder: (reserveId: string, title: string, description?: string) => string;
  updateFolder: (reserveId: string, folderId: string, updates: Partial<Pick<CourseFolder, 'title' | 'description' | 'isOpen'>>) => void;
  deleteFolder: (reserveId: string, folderId: string) => void;
  addItemToFolder: (reserveId: string, folderId: string, itemId: string) => void;
  removeItemFromFolder: (reserveId: string, itemId: string) => void;
  toggleFolder: (reserveId: string, folderId: string) => void;
  moveItemInFolder: (reserveId: string, folderId: string, itemId: string, direction: 'up' | 'down') => void;
  moveFolderPosition: (reserveId: string, folderId: string, direction: 'up' | 'down') => void;

  // Utility actions
  getReserveById: (id: string) => CourseReserve | undefined;
  getUserReserves: () => CourseReserve[]; // Only user-created reserves
  getTestReserves: () => CourseReserve[]; // Only test data
  cloneReserve: (id: string, newCourseData: { courseCode: string; courseTitle: string; section: string; instructors: string; term: string }) => string;
  clearDuplicates: () => void; // Helper to remove duplicates

  // Stats helpers
  getReserveStats: (id: string) => {
    totalItems: number;
    completeItems: number;
    inProgressItems: number;
    needsReviewItems: number;
    draftItems: number;
  };
}

export type ReserveSlice<Keys extends keyof CourseReservesState> = StateCreator<
  CourseReservesState,
  [],
  [],
  Pick<CourseReservesState, Keys>
>;

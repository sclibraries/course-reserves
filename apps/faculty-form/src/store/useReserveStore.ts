import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';
import { useDraftStore } from './draftStore';

// FOLIO Location Type
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

// FOLIO Copied Item Type (from reserves)
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

// Types
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
  
  // Submission fields
  submissionNotes?: string | null; // Faculty notes about the submission
  neededByDate?: string | null; // ISO date string when materials are needed
}

interface CourseReservesState {
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
  updateSubmission: (submissionId: string, updates: Partial<CourseReserve>) => Promise<boolean>; // Update a submission via PUT API
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

// No initial test data - will load from backend after authentication
const initialTestReserves: CourseReserve[] = [];

export const useReserveStore = create<CourseReservesState>()(
  devtools(
    persist(
      (set, get) => ({
      reserves: [], // Start empty - will load from backend
      _initialized: true,
      loading: false,
      error: null,
      pollingInterval: null,

      initialize: () => {
        // No longer need to inject test data
        // Just ensure structure is valid
        const state = get();
          if (!state._initialized) {
            const migratedReserves = state.reserves.map(reserve => ({
              ...reserve,
              folders: reserve.folders || [],
              items: reserve.items || []
            }));
            
            set({ 
              reserves: migratedReserves,
              _initialized: true 
            });
          }
        },

        fetchSubmissions: async (silent = false) => {
          if (!silent) {
            set({ loading: true, error: null });
          }
          
          try {
            // Import dynamically to avoid circular dependencies
            const { getAuthHeaders } = await import('./authStore');
            const { API_ENDPOINTS } = await import('@/config/endpoints');
            
            const response = await fetch(
              `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_INDEX}`,
              {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  ...getAuthHeaders(),
                },
              }
            );

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📦 Fetched submissions from backend:', data);
            
            // Transform backend submissions to CourseReserve format
            const backendReserves: CourseReserve[] = (data.items || []).map((item: {
              submission_uuid: string;
              course_code: string;
              course_title: string;
              section?: string;
              faculty_display_name: string;
              term_code: string;
              status: string;
              updated_at: string;
              // Lock/edit fields from backend
              assignee_staff_user_id?: string | null;
              is_locked?: boolean;
              locked_at?: string | null;
              locked_by?: string | null;
              locked_by_staff_id?: string | null;
              lock_reason?: string | null;
              can_edit?: boolean;
              materials?: Array<{
                id: string;
                title: string;
                authors?: string;
                material_type: string;
                is_reuse: boolean;
                barcode?: string;
                call_number?: string;
                status: string;
                display_order: number;
              }>;
              folders?: Array<{
                id: string;
                name: string;
                display_order: number;
                items: Array<{
                  id: string;
                  title: string;
                  authors?: string;
                  material_type: string;
                  is_reuse: boolean;
                  barcode?: string;
                  call_number?: string;
                  status: string;
                  display_order: number;
                  folder_name?: string;
                }>;
                item_count: number;
              }>;
              unfoldered_items?: Array<{
                id: string;
                title: string;
                authors?: string;
                material_type: string;
                is_reuse: boolean;
                barcode?: string;
                call_number?: string;
                status: string;
                display_order: number;
                folder_name?: string;
              }>;
            }) => {
              // Transform folders with their items
              const folders: CourseFolder[] = (item.folders || []).map((folder) => {
                const folderItems: CourseItem[] = (folder.items || []).map((material) => ({
                  id: `material-${material.id}`,
                  title: material.title,
                  authors: material.authors,
                  materialType: material.material_type as CourseItem['materialType'],
                  status: (material.status === 'pending' ? 'pending' : 
                          material.status === 'complete' ? 'complete' : 
                          material.status === 'in-progress' ? 'in-progress' : 
                          material.status === 'needs-review' ? 'needs-review' : 'draft') as CourseItem['status'],
                  barcode: material.barcode,
                  callNumber: material.call_number,
                  folderId: `folder-${folder.id}`,
                  displayOrder: material.display_order,
                })).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
                
                return {
                  id: `folder-${folder.id}`,
                  title: folder.name,
                  isOpen: false,
                  items: folderItems,
                  position: folder.display_order,
                };
              }).sort((a, b) => (a.position || 0) - (b.position || 0));

              // Transform unfoldered items
              const unfolderedItems: CourseItem[] = (item.unfoldered_items || []).map((material) => ({
                id: `material-${material.id}`,
                title: material.title,
                authors: material.authors,
                materialType: material.material_type as CourseItem['materialType'],
                status: (material.status === 'pending' ? 'pending' : 
                        material.status === 'complete' ? 'complete' : 
                        material.status === 'in-progress' ? 'in-progress' : 
                        material.status === 'needs-review' ? 'needs-review' : 'draft') as CourseItem['status'],
                barcode: material.barcode,
                callNumber: material.call_number,
                displayOrder: material.display_order,
              })).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

              // Combine all items for flat access (maintain backward compatibility)
              const allFolderItems = folders.flatMap(f => f.items);
              const items = [...allFolderItems, ...unfolderedItems];

              // Construct courseAssignmentId from course_code, section, and term_code
              // Format: "BIO-131-01-202603" (course_code-section-term_code)
              const courseAssignmentId = item.section 
                ? `${item.course_code}-${item.section}-${item.term_code}`
                : item.course_code;

              return {
                id: item.submission_uuid,
                courseCode: item.course_code,
                courseTitle: item.course_title,
                section: item.section || '',
                instructors: item.faculty_display_name,
                term: item.term_code,
                status: item.status as CourseReserve['status'],
                items,
                folders,
                lastUpdated: new Date(item.updated_at).toLocaleDateString("en-US", { 
                  month: "short", 
                  day: "numeric", 
                  year: "numeric" 
                }),
                isTestData: false,
                courseAssignmentId, // Link to course assignment for matching
                // Lock status fields from backend (ensure immediate visibility on Index)
                assigneeStaffUserId: item.assignee_staff_user_id || null,
                isLocked: !!(item.is_locked || item.assignee_staff_user_id || item.locked_by || item.locked_by_staff_id),
                lockedAt: item.locked_at || null,
                lockedBy: (item.locked_by || item.locked_by_staff_id) || null,
                lockReason: item.lock_reason || null,
                canEdit: item.can_edit !== undefined ? item.can_edit : !(item.is_locked ?? false),
              };
            });

            // Merge backend submissions with any local-only draft reserves (ids starting with 'reserve-')
            set((state) => {
              const localDrafts = (state.reserves || []).filter(r => r.id.startsWith('reserve-'));
              const merged = [...localDrafts, ...backendReserves];

              const hasChanged = JSON.stringify(state.reserves) !== JSON.stringify(merged);
              if (!hasChanged && silent) {
                // No changes detected during silent polling, keep existing state
                return state;
              }

              return {
                reserves: merged,
                loading: false,
                error: null,
              };
            });
            
            if (!silent) {
              console.log('✅ Updated reserves from backend:', {
                count: backendReserves.length
              });
            }
            
          } catch (error) {
            console.error('❌ Failed to fetch submissions:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (!silent) {
              set({ loading: false, error: errorMessage });
            }
          }
        },

        fetchSubmissionDetails: async (submissionId: string, silent = false) => {
          try {
            // Import dynamically to avoid circular dependencies
            const { getAuthHeaders } = await import('./authStore');
            const { API_ENDPOINTS } = await import('@/config/endpoints');
            
            const response = await fetch(
              `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_INDEX}`,
              {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  ...getAuthHeaders(),
                },
              }
            );

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Find the specific submission
            const submission = (data.items || []).find((item: { submission_uuid: string }) => 
              item.submission_uuid === submissionId
            );

            if (!submission) {
              console.error('Submission not found:', submissionId);
              return null;
            }

            console.log('📦 Fetched submission details:', submission);
            
            // Transform folders with their items
            const folders: CourseFolder[] = (submission.folders || []).map((folder: {
              id: string;
              name: string;
              display_order: number;
              items: Array<{
                id: string;
                title: string;
                authors?: string;
                material_type: string;
                is_reuse: boolean;
                barcode?: string;
                call_number?: string;
                status: string;
                display_order: number;
                folder_name?: string;
              }>;
              item_count: number;
            }) => {
              const folderItems: CourseItem[] = (folder.items || []).map((material) => ({
                id: `material-${material.id}`,
                backendItemId: String(material.id), // Store the actual backend ID
                title: material.title,
                authors: material.authors,
                materialType: material.material_type as CourseItem['materialType'],
                status: (material.status === 'pending' ? 'pending' : 
                        material.status === 'complete' ? 'complete' : 
                        material.status === 'in-progress' ? 'in-progress' : 
                        material.status === 'needs-review' ? 'needs-review' : 'draft') as CourseItem['status'],
                barcode: material.barcode,
                callNumber: material.call_number,
                folderId: `folder-${folder.id}`,
                displayOrder: material.display_order,
              })).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
              
              return {
                id: `folder-${folder.id}`,
                backendFolderId: String(folder.id), // Store the actual backend folder ID
                title: folder.name,
                isOpen: false,
                items: folderItems,
                position: folder.display_order,
              };
            }).sort((a, b) => (a.position || 0) - (b.position || 0));

            // Transform unfoldered items
            const unfolderedItems: CourseItem[] = (submission.unfoldered_items || []).map((material: {
              id: string;
              title: string;
              authors?: string;
              material_type: string;
              is_reuse: boolean;
              barcode?: string;
              call_number?: string;
              status: string;
              display_order: number;
              folder_name?: string;
            }) => ({
              id: `material-${material.id}`,
              backendItemId: String(material.id), // Store the actual backend ID
              title: material.title,
              authors: material.authors,
              materialType: material.material_type as CourseItem['materialType'],
              status: (material.status === 'pending' ? 'pending' : 
                      material.status === 'complete' ? 'complete' : 
                      material.status === 'in-progress' ? 'in-progress' : 
                      material.status === 'needs-review' ? 'needs-review' : 'draft') as CourseItem['status'],
              barcode: material.barcode,
              callNumber: material.call_number,
              displayOrder: material.display_order,
            })).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

            // Combine all items for flat access (maintain backward compatibility)
            const allFolderItems = folders.flatMap(f => f.items);
            const items = [...allFolderItems, ...unfolderedItems];

            const reserve: CourseReserve = {
              id: submission.submission_uuid,
              courseCode: submission.course_code,
              courseTitle: submission.course_title,
              section: submission.section || '',
              instructors: submission.faculty_display_name,
              term: submission.term_code,
              status: submission.status as CourseReserve['status'],
              items,
              folders,
              lastUpdated: new Date(submission.updated_at).toLocaleDateString("en-US", { 
                month: "short", 
                day: "numeric", 
                year: "numeric" 
              }),
              isTestData: false,
              
              // Lock status fields from backend
              assigneeStaffUserId: submission.assignee_staff_user_id || null,
              isLocked: !!(submission.is_locked || submission.assignee_staff_user_id || submission.locked_by || submission.locked_by_staff_id),
              lockedAt: submission.locked_at || null,
              lockedBy: (submission.locked_by || submission.locked_by_staff_id) || null,
              lockReason: submission.lock_reason || null,
              canEdit: submission.can_edit !== undefined ? submission.can_edit : !(submission.is_locked ?? false),
              
              // Submission fields
              submissionNotes: submission.submission_notes || null,
              neededByDate: submission.needed_by_date || null,
            };

            // Update or add the reserve to the store (with smart caching)
            set((state) => {
              const existingIndex = state.reserves.findIndex(r => r.id === submissionId);
              
              if (existingIndex >= 0) {
                // Check if data has actually changed
                const existingReserve = state.reserves[existingIndex];
                const hasChanged = JSON.stringify(existingReserve) !== JSON.stringify(reserve);
                
                if (!hasChanged && silent) {
                  // No changes detected during silent polling, keep existing state
                  return state;
                }
                
                // Update existing reserve
                return {
                  reserves: state.reserves.map(r => 
                    r.id === submissionId ? reserve : r
                  )
                };
              } else {
                // Add new reserve to store
                return {
                  reserves: [...state.reserves, reserve]
                };
              }
            });

            return reserve;
            
          } catch (error) {
            console.error('❌ Failed to fetch submission details:', error);
            return null;
          }
        },

        updateSubmission: async (submissionId: string, updates: Partial<CourseReserve>) => {
          try {
            // Import dynamically to avoid circular dependencies
            const { getAuthHeaders } = await import('./authStore');
            const { API_ENDPOINTS } = await import('@/config/endpoints');
            
            // Build the update payload matching backend structure
            interface UpdatePayload {
              submission_notes?: string | null;
              needed_by_date?: string | null;
              folders?: Array<{
                folder_uuid: string;
                folder_name: string;
                display_order: number;
              }>;
              items?: Array<{
                item_uuid: string;
                display_order: number | null;
                folder_uuid: string | null;
                position_in_folder: number | null;
                material_type: string;
                title: string;
                author?: string | null;
                journal?: string | null;
                publisher?: string | null;
                isbn?: string | null;
                url?: string | null;
                faculty_notes?: string | null;
                call_number?: string | null;
                barcode?: string | null;
              }>;
            }
            
            const payload: UpdatePayload = {};
            
            if (updates.submissionNotes !== undefined) {
              payload.submission_notes = updates.submissionNotes;
            }
            
            if (updates.neededByDate !== undefined) {
              payload.needed_by_date = updates.neededByDate;
            }
            
            // Transform folders array if provided
            if (updates.folders !== undefined) {
              payload.folders = updates.folders.map((folder, index) => ({
                folder_uuid: folder.id,
                folder_name: folder.title,
                display_order: index,
              }));
            }
            
            // Transform items array if provided
            if (updates.items !== undefined) {
              payload.items = updates.items.map((item, index) => ({
                item_uuid: item.id,
                display_order: item.folderId ? null : index,
                folder_uuid: item.folderId || null,
                position_in_folder: item.folderId ? (item.displayOrder || 0) : null,
                material_type: item.materialType,
                title: item.title,
                author: item.authors || null,
                journal: item.journalTitle || null,
                publisher: item.publisher || null,
                isbn: item.isbn || null,
                url: item.url || null,
                faculty_notes: item.notes || null,
                call_number: item.callNumber || null,
                barcode: item.barcode || null,
              }));
            }
            
            console.log('📤 Updating submission:', submissionId, payload);
            
            const response = await fetch(
              `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_UPDATE.replace(':uuid', submissionId)}`,
              {
                method: 'PUT',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  ...getAuthHeaders(),
                },
                body: JSON.stringify(payload),
              }
            );

            // Handle locked submission specifically: record lock state on the
            // reserve so the editor flips to read-only, then surface the error.
            if (response.status === 423) {
              const lockData = await response.json();
              get().applyLockState(submissionId, lockData);
              throw new Error(
                `This submission is locked by ${lockData.locked_by || 'staff'} on ${
                  lockData.locked_at ? new Date(lockData.locked_at).toLocaleDateString() : 'an unknown date'
                }. Reason: ${lockData.lock_reason || 'No reason provided'}`
              );
            }

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Submission updated successfully:', result);
            
            // Refresh the submission details from backend
            await get().fetchSubmissionDetails(submissionId, true);
            
            return true;
          } catch (error) {
            console.error('❌ Failed to update submission:', error);
            throw error;
          }
        },

        deleteSubmission: async (submissionId: string) => {
          try {
            // Import dynamically to avoid circular dependencies
            const { getAuthHeaders } = await import('./authStore');
            const { API_ENDPOINTS } = await import('@/config/endpoints');

            const response = await fetch(
              `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_INDEX}/${submissionId}`,
              {
                method: 'DELETE',
                headers: {
                  'Accept': 'application/json',
                  ...getAuthHeaders(),
                },
              }
            );

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Submission deleted successfully:', result);

            // Remove from local store
            set((state) => ({
              reserves: state.reserves.filter(r => r.id !== submissionId)
            }));

            return true;
          } catch (error) {
            console.error('❌ Failed to delete submission:', error);
            throw error;
          }
        },

        applyLockState: (submissionId, lockData) => {
          useDraftStore.getState().deleteDraft(submissionId);
          set((state) => ({
            reserves: state.reserves.map((r) =>
              r.id === submissionId
                ? {
                    ...r,
                    isLocked: true,
                    canEdit: false,
                    lockedBy: lockData.locked_by ?? r.lockedBy ?? null,
                    lockedAt: lockData.locked_at ?? r.lockedAt ?? null,
                    lockReason: lockData.lock_reason ?? r.lockReason ?? null,
                  }
                : r
            ),
          }));
        },

        startPolling: (intervalMs = 30000) => { // Default 30 seconds
          // Clear existing interval if any
          const currentInterval = get().pollingInterval;
          if (currentInterval) {
            clearInterval(currentInterval);
          }

          console.log('🔄 Starting auto-refresh polling (every', intervalMs / 1000, 'seconds)');
          
          // Set up new polling interval
          const interval = setInterval(() => {
            console.log('🔄 Auto-refreshing submissions...');
            get().fetchSubmissions(true); // Silent fetch
          }, intervalMs);

          set({ pollingInterval: interval });
        },

        stopPolling: () => {
          const interval = get().pollingInterval;
          if (interval) {
            console.log('⏸️ Stopping auto-refresh polling');
            clearInterval(interval);
            set({ pollingInterval: null });
          }
        },

        clearAllData: () => {
          // Stop polling if active
          const interval = get().pollingInterval;
          if (interval) {
            clearInterval(interval);
          }
          
          console.log('🗑️ Clearing all course reserves data on logout');
          
          // Clear everything on logout
          set({
            reserves: [],
            loading: false,
            error: null,
            pollingInterval: null,
            _initialized: true
          });
        },

        addReserve: (reserve) => {
          const id = `reserve-${Date.now()}`;
          const newReserve: CourseReserve = {
            ...reserve,
            id,
            items: reserve.items || [],
            folders: reserve.folders || [],
            lastUpdated: new Date().toLocaleDateString("en-US", { 
              month: "short", 
              day: "numeric", 
              year: "numeric" 
            }),
            isTestData: false // Explicitly mark as user data
          };
          
          set((state) => {
            // Ensure we don't overwrite test data
            const updatedReserves = [newReserve, ...state.reserves];
            console.log('Adding new reserve. Total reserves:', updatedReserves.length, 
                       'User reserves:', updatedReserves.filter(r => !r.isTestData).length,
                       'Test reserves:', updatedReserves.filter(r => r.isTestData).length);
            return { reserves: updatedReserves };
          });
          
          return id;
        },

        findReserveByAssignmentId: (courseAssignmentId) => {
          const state = get();
          return state.reserves.find(r => r.courseAssignmentId === courseAssignmentId);
        },

        updateReserve: (id, updates) => {
          set((state) => ({
            reserves: state.reserves.map((reserve) =>
              reserve.id === id 
                ? { 
                    ...reserve, 
                    ...updates, 
                    lastUpdated: new Date().toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric" 
                    })
                  }
                : reserve
            )
          }));
        },

        deleteReserve: (id) => {
          set((state) => ({
            reserves: state.reserves.filter((reserve) => reserve.id !== id)
          }));
        },

        addItem: (reserveId, item) => {
          const reserve = get().getReserveById(reserveId);
          if (!reserve) {
            return false;
          }

          const itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newItem: CourseItem = { ...item, id: itemId };

          if (findDuplicateCourseItem(reserve.items || [], newItem)) {
            return false;
          }
          
          set((state) => ({
            reserves: state.reserves.map((reserve) =>
              reserve.id === reserveId
                ? {
                    ...reserve,
                    items: [newItem, ...(reserve.items || [])],
                    lastUpdated: new Date().toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric" 
                    })
                  }
                : reserve
            )
          }));

          return true;
        },

        updateItem: (reserveId, itemId, updates) => {
          set((state) => ({
            reserves: state.reserves.map((reserve) =>
              reserve.id === reserveId
                ? {
                    ...reserve,
                    items: (reserve.items || []).map((item) =>
                      item.id === itemId ? { ...item, ...updates } : item
                    ),
                    lastUpdated: new Date().toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric" 
                    })
                  }
                : reserve
            )
          }));
        },

        deleteItem: (reserveId, itemId) => {
          set((state) => ({
            reserves: state.reserves.map((reserve) =>
              reserve.id === reserveId
                ? {
                    ...reserve,
                    items: (reserve.items || []).filter((item) => item.id !== itemId),
                    lastUpdated: new Date().toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric" 
                    })
                  }
                : reserve
            )
          }));
        },

        reorderItems: (reserveId, itemIds) => {
          set((state) => ({
            reserves: state.reserves.map((reserve) =>
              reserve.id === reserveId
                ? {
                    ...reserve,
                    items: itemIds.map((id) => (reserve.items || []).find((item) => item.id === id)!),
                    lastUpdated: new Date().toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric" 
                    })
                  }
                : reserve
            )
          }));
        },

        moveItemToPosition: (reserveId, itemId, position) => {
          set((state) => ({
            reserves: state.reserves.map((reserve) => {
              if (reserve.id === reserveId) {
                const items = [...(reserve.items || [])];
                const itemIndex = items.findIndex((item) => item.id === itemId);
                if (itemIndex !== -1) {
                  const [item] = items.splice(itemIndex, 1);
                  items.splice(position, 0, item);
                }
                return {
                  ...reserve,
                  items,
                  lastUpdated: new Date().toLocaleDateString("en-US", { 
                    month: "short", 
                    day: "numeric", 
                    year: "numeric" 
                  })
                };
              }
              return reserve;
            })
          }));
        },

        getReserveById: (id) => {
          const reserve = get().reserves.find((reserve) => reserve.id === id);
          if (!reserve) return undefined;
          
          // Ensure folders property exists (backwards compatibility)
          return {
            ...reserve,
            folders: reserve.folders || [],
            items: reserve.items || []
          };
        },

        getUserReserves: () => {
          return get().reserves.filter((reserve) => !reserve.isTestData);
        },

        getTestReserves: () => {
          return get().reserves.filter((reserve) => reserve.isTestData);
        },

        cloneReserve: (id, newCourseData) => {
          const originalReserve = get().getReserveById(id);
          if (!originalReserve) return '';
          
          const newId = `reserve-${Date.now()}`;
          const timestamp = Date.now();
          
          // Create folder mapping for updating item folderIds
          const folderIdMapping: { [oldId: string]: string } = {};
          
          const clonedReserve: CourseReserve = {
            ...originalReserve,
            ...newCourseData,
            id: newId,
            status: 'draft',
            isTestData: false,
            folders: (originalReserve.folders || []).map((folder, index) => {
              const newFolderId = `folder-${timestamp}-${index}`;
              folderIdMapping[folder.id] = newFolderId;
              return {
                ...folder,
                id: newFolderId,
                items: [] // Items will be populated separately
              };
            }),
            items: (originalReserve.items || []).map((item, index) => ({
              ...item,
              id: `item-${timestamp}-${index}`,
              folderId: item.folderId ? folderIdMapping[item.folderId] : undefined,
              status: 'draft'
            })),
            lastUpdated: new Date().toLocaleDateString("en-US", { 
              month: "short", 
              day: "numeric", 
              year: "numeric" 
            })
          };
          
          set((state) => ({
            reserves: [clonedReserve, ...state.reserves]
          }));
          
          return newId;
        },

        getReserveStats: (id) => {
          const reserve = get().getReserveById(id);
          if (!reserve) {
            return {
              totalItems: 0,
              completeItems: 0,
              inProgressItems: 0,
              needsReviewItems: 0,
              draftItems: 0
            };
          }
          
          return {
            totalItems: reserve.items.length,
            completeItems: reserve.items.filter(item => item.status === 'complete').length,
            inProgressItems: reserve.items.filter(item => item.status === 'in-progress').length,
            needsReviewItems: reserve.items.filter(item => item.status === 'needs-review').length,
            draftItems: reserve.items.filter(item => item.status === 'draft').length,
          };
        },

        clearDuplicates: () => {
          set((state) => {
            const uniqueReserves = state.reserves.filter((reserve, index, self) => 
              index === self.findIndex(r => r.id === reserve.id)
            );
            return { reserves: uniqueReserves };
          });
        },

        // Folder methods
        createFolder: (reserveId, title, description) => {
          const folderId = `folder-${Date.now()}`;
          set((state) => ({
            reserves: state.reserves.map(reserve => {
              if (reserve.id === reserveId) {
                // Create folder at the very beginning (position 0 or slightly before the first item)
                const folders = reserve.folders || [];
                const items = reserve.items || [];
                
                // Find the minimum position currently in use
                const ungroupedItems = items.filter(item => !item.folderId);
                const existingPositions = [
                  ...folders.map(f => f.position || 0),
                  ...ungroupedItems.map((_, index) => index)
                ];
                
                const minPosition = existingPositions.length > 0 ? Math.min(...existingPositions) : 0;
                
                // Place new folder before the earliest position (use negative or fractional)
                const newFolderPosition = minPosition <= 0 ? minPosition - 1 : -0.5;
                
                return {
                  ...reserve,
                  folders: [...folders, {
                    id: folderId,
                    title,
                    description,
                    isOpen: true,
                    items: [],
                    position: newFolderPosition
                  }],
                  lastUpdated: new Date().toLocaleDateString("en-US", { 
                    month: "short", 
                    day: "numeric", 
                    year: "numeric" 
                  })
                };
              }
              return reserve;
            })
          }));
          return folderId;
        },

        updateFolder: (reserveId, folderId, updates) => {
          set((state) => ({
            reserves: state.reserves.map(reserve => 
              reserve.id === reserveId 
                ? {
                    ...reserve,
                    folders: (reserve.folders || []).map(folder => 
                      folder.id === folderId 
                        ? { ...folder, ...updates }
                        : folder
                    ),
                    lastUpdated: new Date().toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric" 
                    })
                  }
                : reserve
            )
          }));
        },

        deleteFolder: (reserveId, folderId) => {
          set((state) => ({
            reserves: state.reserves.map(reserve => 
              reserve.id === reserveId 
                ? {
                    ...reserve,
                    folders: (reserve.folders || []).filter(folder => folder.id !== folderId),
                    // Remove folderId from items that were in this folder
                    items: (reserve.items || []).map(item => 
                      item.folderId === folderId 
                        ? { ...item, folderId: undefined }
                        : item
                    ),
                    lastUpdated: new Date().toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric" 
                    })
                  }
                : reserve
            )
          }));
        },

        addItemToFolder: (reserveId, folderId, itemId) => {
          set((state) => ({
            reserves: state.reserves.map(reserve => 
              reserve.id === reserveId 
                ? {
                    ...reserve,
                    items: (reserve.items || []).map(item => 
                      item.id === itemId 
                        ? { ...item, folderId }
                        : item
                    ),
                    lastUpdated: new Date().toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric" 
                    })
                  }
                : reserve
            )
          }));
        },

        removeItemFromFolder: (reserveId, itemId) => {
          set((state) => ({
            reserves: state.reserves.map(reserve => 
              reserve.id === reserveId 
                ? {
                    ...reserve,
                    items: (reserve.items || []).map(item => 
                      item.id === itemId 
                        ? { ...item, folderId: undefined }
                        : item
                    ),
                    lastUpdated: new Date().toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric", 
                      year: "numeric" 
                    })
                  }
                : reserve
            )
          }));
        },

        toggleFolder: (reserveId, folderId) => {
          set((state) => ({
            reserves: state.reserves.map(reserve => 
              reserve.id === reserveId 
                ? {
                    ...reserve,
                    folders: (reserve.folders || []).map(folder => 
                      folder.id === folderId 
                        ? { ...folder, isOpen: !folder.isOpen }
                        : folder
                    )
                  }
                : reserve
            )
          }));
        },

        moveItemInFolder: (reserveId, folderId, itemId, direction) => {
          set((state) => ({
            reserves: state.reserves.map(reserve => {
              if (reserve.id === reserveId) {
                const items = reserve.items || [];
                
                // Get items in this folder
                const folderItems = items.filter(item => item.folderId === folderId);
                const currentIndex = folderItems.findIndex(item => item.id === itemId);
                
                if (currentIndex === -1) return reserve;
                
                const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
                
                // Check bounds
                if (newIndex < 0 || newIndex >= folderItems.length) return reserve;
                
                // Create a new items array with reordered folder items
                const otherItems = items.filter(item => item.folderId !== folderId);
                const reorderedFolderItems = [...folderItems];
                [reorderedFolderItems[currentIndex], reorderedFolderItems[newIndex]] = 
                [reorderedFolderItems[newIndex], reorderedFolderItems[currentIndex]];
                
                return {
                  ...reserve,
                  items: [...otherItems, ...reorderedFolderItems],
                  lastUpdated: new Date().toLocaleDateString("en-US", { 
                    month: "short", 
                    day: "numeric", 
                    year: "numeric" 
                  })
                };
              }
              return reserve;
            })
          }));
        },

        moveFolderPosition: (reserveId, folderId, direction) => {
          set((state) => {
            const reserve = state.reserves.find(r => r.id === reserveId);
            if (!reserve) return state;
            
            const folders = reserve.folders || [];
            const items = reserve.items || [];
            const ungroupedItems = items.filter(item => !item.folderId);
            
            // Create the current mixed display order
            const mixedContent = [
              ...folders.map((folder) => ({
                type: 'folder' as const,
                id: folder.id,
                position: folder.position ?? 1000
              })),
              ...ungroupedItems.map((item, index) => ({
                type: 'item' as const,
                id: item.id,
                position: index
              }))
            ];
            
            // Sort to get current display order
            mixedContent.sort((a, b) => a.position - b.position);
            
            // Find where this folder currently is in the mixed display
            const currentDisplayIndex = mixedContent.findIndex(item => 
              item.type === 'folder' && item.id === folderId
            );
            
            if (currentDisplayIndex === -1) return state;
            
            const newDisplayIndex = direction === 'up' ? currentDisplayIndex - 1 : currentDisplayIndex + 1;
            
            // Check bounds
            if (newDisplayIndex < 0 || newDisplayIndex >= mixedContent.length) return state;
            
            // Get what we're swapping with
            const targetItem = mixedContent[newDisplayIndex];
            
            // Calculate new positions
            let newFolderPosition: number;
            
            if (targetItem.type === 'folder') {
              // Swapping with another folder - swap their positions
              newFolderPosition = targetItem.position;
            } else {
              // Moving before/after an item - calculate position to insert there
              if (direction === 'up') {
                // Insert before this item
                const prevItem = newDisplayIndex > 0 ? mixedContent[newDisplayIndex - 1] : null;
                newFolderPosition = prevItem ? (prevItem.position + targetItem.position) / 2 : targetItem.position - 1;
              } else {
                // Insert after this item
                const nextItem = newDisplayIndex < mixedContent.length - 1 ? mixedContent[newDisplayIndex + 1] : null;
                newFolderPosition = nextItem ? (targetItem.position + nextItem.position) / 2 : targetItem.position + 1;
              }
            }
            
            return {
              reserves: state.reserves.map(reserve => 
                reserve.id === reserveId
                  ? {
                      ...reserve,
                      folders: folders.map(folder => {
                        if (folder.id === folderId) {
                          return { ...folder, position: newFolderPosition };
                        }
                        // If we swapped with another folder, update its position too
                        if (targetItem.type === 'folder' && folder.id === targetItem.id) {
                          return { ...folder, position: mixedContent[currentDisplayIndex].position };
                        }
                        return folder;
                      }),
                      lastUpdated: new Date().toLocaleDateString("en-US", { 
                        month: "short", 
                        day: "numeric", 
                        year: "numeric" 
                      })
                    }
                  : reserve
              )
            };
          });
        }
      }),
      {
        name: 'course-reserves-storage',
        // Only persist essential data, not loading/error states
        partialize: (state) => ({
          reserves: state.reserves,
          _initialized: state._initialized,
        }),
      }
    ),
    { name: 'CourseReservesStore' }
  )
);

// Helper function to clear all course reserves data (called during logout)
export const clearCourseReservesStorage = () => {
  try {
    // Clear all data from store state
    useReserveStore.getState().clearAllData();
    
    console.log('🗑️ Cleared all course reserves from memory');
  } catch (error) {
    console.error('Failed to clear course reserves storage:', error);
  }
};

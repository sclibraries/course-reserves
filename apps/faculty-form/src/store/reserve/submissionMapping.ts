import type { CourseFolder, CourseItem, CourseReserve } from './types';

interface BackendMaterial {
  id: string | number;
  title: string;
  authors?: string;
  material_type: string;
  status: string;
  display_order: number;
  barcode?: string;
  call_number?: string;
  folder_name?: string;
}

interface BackendFolder {
  id: string | number;
  name: string;
  display_order: number;
  items?: BackendMaterial[];
}

export interface BackendSubmission {
  submission_uuid: string;
  course_code: string;
  course_title: string;
  section?: string;
  faculty_display_name: string;
  term_code: string;
  status: string;
  updated_at: string;
  assignee_staff_user_id?: string | null;
  is_locked?: boolean;
  locked_at?: string | null;
  locked_by?: string | null;
  locked_by_staff_id?: string | null;
  lock_reason?: string | null;
  can_edit?: boolean;
  access?: 'owner' | 'proxy' | 'co_instructor';
  proxy_can_edit?: boolean;
  folders?: BackendFolder[];
  unfoldered_items?: BackendMaterial[];
  submission_notes?: string | null;
  needed_by_date?: string | null;
}

const mapMaterialStatus = (status: string): CourseItem['status'] => (
  status === 'pending' ? 'pending' :
    status === 'complete' ? 'complete' :
      status === 'in-progress' ? 'in-progress' :
        status === 'needs-review' ? 'needs-review' : 'draft'
);

const mapMaterial = (
  material: BackendMaterial,
  folderId?: string,
  includeBackendId = false
): CourseItem => ({
  id: `material-${material.id}`,
  ...(includeBackendId ? { backendItemId: String(material.id) } : {}),
  title: material.title,
  authors: material.authors,
  materialType: material.material_type as CourseItem['materialType'],
  status: mapMaterialStatus(material.status),
  barcode: material.barcode,
  callNumber: material.call_number,
  ...(folderId ? { folderId } : {}),
  displayOrder: material.display_order,
});

const mapSubmissionItems = (submission: BackendSubmission, includeBackendIds: boolean) => {
  const folders: CourseFolder[] = (submission.folders || []).map((folder) => {
    const folderId = `folder-${folder.id}`;
    const items = (folder.items || [])
      .map((material) => mapMaterial(material, folderId, includeBackendIds))
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    return {
      id: folderId,
      ...(includeBackendIds ? { backendFolderId: String(folder.id) } : {}),
      title: folder.name,
      isOpen: false,
      items,
      position: folder.display_order,
    };
  }).sort((a, b) => (a.position || 0) - (b.position || 0));

  const unfolderedItems = (submission.unfoldered_items || [])
    .map((material) => mapMaterial(material, undefined, includeBackendIds))
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return { folders, items: [...folders.flatMap((folder) => folder.items), ...unfolderedItems] };
};

const mapLockFields = (submission: BackendSubmission): Pick<
  CourseReserve,
  'assigneeStaffUserId' | 'isLocked' | 'lockedAt' | 'lockedBy' | 'lockReason' | 'canEdit'
> => ({
  assigneeStaffUserId: submission.assignee_staff_user_id || null,
  isLocked: !!(
    submission.is_locked || submission.assignee_staff_user_id ||
    submission.locked_by || submission.locked_by_staff_id
  ),
  lockedAt: submission.locked_at || null,
  lockedBy: (submission.locked_by || submission.locked_by_staff_id) || null,
  lockReason: submission.lock_reason || null,
  canEdit: submission.can_edit !== undefined
    ? submission.can_edit
    : !(submission.is_locked ?? false),
});

const mapProxyFields = (submission: BackendSubmission): Pick<CourseReserve, 'access' | 'proxyCanEdit' | 'canEdit'> => ({
  ...(submission.access ? { access: submission.access } : {}),
  ...(typeof submission.proxy_can_edit === 'boolean'
    ? { proxyCanEdit: submission.proxy_can_edit, canEdit: submission.proxy_can_edit }
    : {}),
});

const formatLastUpdated = (updatedAt: string) => new Date(updatedAt).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export const mapSubmissionIndexItem = (submission: BackendSubmission): CourseReserve => {
  const { folders, items } = mapSubmissionItems(submission, false);
  const courseAssignmentId = submission.section
    ? `${submission.course_code}-${submission.section}-${submission.term_code}`
    : submission.course_code;

  return {
    id: submission.submission_uuid,
    courseCode: submission.course_code,
    courseTitle: submission.course_title,
    section: submission.section || '',
    instructors: submission.faculty_display_name,
    term: submission.term_code,
    status: submission.status as CourseReserve['status'],
    items,
    folders,
    lastUpdated: formatLastUpdated(submission.updated_at),
    isTestData: false,
    courseAssignmentId,
    ...mapLockFields(submission),
    ...mapProxyFields(submission),
  };
};

export const mapSubmissionDetailItem = (submission: BackendSubmission): CourseReserve => {
  const { folders, items } = mapSubmissionItems(submission, true);

  return {
    id: submission.submission_uuid,
    courseCode: submission.course_code,
    courseTitle: submission.course_title,
    section: submission.section || '',
    instructors: submission.faculty_display_name,
    term: submission.term_code,
    status: submission.status as CourseReserve['status'],
    items,
    folders,
    lastUpdated: formatLastUpdated(submission.updated_at),
    isTestData: false,
    ...mapLockFields(submission),
    ...mapProxyFields(submission),
    submissionNotes: submission.submission_notes || null,
    neededByDate: submission.needed_by_date || null,
  };
};

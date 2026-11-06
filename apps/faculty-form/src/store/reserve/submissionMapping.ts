import type { CourseFolder, CourseItem, CourseReserve } from './types';
import { fromServer } from '@/utils/listLayout';

type MaterialResourceData = Omit<Partial<Pick<
  CourseItem,
  'doi' | 'issn' | 'journalTitle' | 'volume' | 'issue' | 'eds' |
  'isbn' | 'publisher' | 'publicationYear' | 'edition' | 'pages' | 'chapterTitle' |
  'copy' | 'url' | 'displayStartDate' | 'displayEndDate' | 'instanceId' | 'instanceHrid' |
  'holdingsId' | 'temporaryLocationId' | 'temporaryLocationObject' |
  'permanentLocationId' | 'permanentLocationObject' | 'copiedItem'
>>, 'journalTitle'> & { journalTitle?: string | null; journal?: string | null };

interface BackendResourceRow {
  id: string | number;
  is_reuse?: boolean | 0 | 1;
  position_in_folder?: number | null;
  source_resource_id?: string | null;
  source_folio_instance_id?: string | null;
  faculty_notes?: string | null;
  assignedPages?: string | null;
  resource_data?: MaterialResourceData | string | null;
}

interface BackendMaterial {
  id: string | number;
  title: string;
  authors?: string;
  material_type: string;
  status: string;
  display_order: number;
  is_reuse?: boolean;
  position_in_folder?: number | null;
  barcode?: string;
  call_number?: string;
  folder_name?: string | null;
  resource_data?: MaterialResourceData | string | null;
}

interface BackendFolder {
  id: string | number;
  name: string;
  display_order: number;
  items?: BackendMaterial[];
}

export interface BackendSubmission {
  submission_uuid: string;
  its_course_id?: string | null;
  academic_period?: string | null;
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
  newResources?: BackendResourceRow[];
  reuseResources?: BackendResourceRow[];
  submission_notes?: string | null;
  needed_by_date?: string | null;
  draft_version?: number;
}

const mapMaterialStatus = (status: string): CourseItem['status'] => (
  status === 'pending' ? 'pending' :
    status === 'complete' ? 'complete' :
      status === 'in-progress' ? 'in-progress' :
        status === 'needs-review' ? 'needs-review' : 'draft'
);

const parseResourceData = (resourceData?: BackendMaterial['resource_data']): MaterialResourceData => {
  if (!resourceData) return {};
  if (typeof resourceData !== 'string') return resourceData;

  try {
    return JSON.parse(resourceData) as MaterialResourceData;
  } catch {
    return {};
  }
};

const mapMaterial = (
  material: BackendMaterial,
  resourceRow: BackendResourceRow | undefined,
  folderId?: string,
  includeBackendId = false
): CourseItem => {
  const resourceData = parseResourceData(material.resource_data ?? resourceRow?.resource_data);
  const journalTitle = resourceData.journal !== undefined
    ? resourceData.journal ?? ''
    : resourceData.journalTitle ?? undefined;

  return {
    id: `material-${material.id}`,
    ...(includeBackendId ? { backendItemId: String(material.id) } : {}),
    title: material.title,
    authors: material.authors,
    materialType: material.material_type as CourseItem['materialType'],
    status: mapMaterialStatus(material.status),
    barcode: material.barcode,
    callNumber: material.call_number,
    assignedPages: resourceRow?.assignedPages ?? undefined,
    doi: resourceData.doi,
    issn: resourceData.issn,
    journalTitle,
    isbn: resourceData.isbn,
    publisher: resourceData.publisher,
    publicationYear: resourceData.publicationYear,
    edition: resourceData.edition,
    pages: resourceData.pages,
    chapterTitle: resourceData.chapterTitle,
    copy: resourceData.copy,
    url: resourceData.url,
    displayStartDate: resourceData.displayStartDate,
    displayEndDate: resourceData.displayEndDate,
    notes: resourceRow?.faculty_notes ?? undefined,
    sourceResourceId: resourceRow?.source_resource_id ?? undefined,
    volume: resourceData.volume,
    issue: resourceData.issue,
    eds: resourceData.eds,
    instanceId: resourceData.instanceId ?? resourceRow?.source_folio_instance_id ?? undefined,
    instanceHrid: resourceData.instanceHrid,
    holdingsId: resourceData.holdingsId,
    temporaryLocationId: resourceData.temporaryLocationId,
    temporaryLocationObject: resourceData.temporaryLocationObject,
    permanentLocationId: resourceData.permanentLocationId,
    permanentLocationObject: resourceData.permanentLocationObject,
    copiedItem: resourceData.copiedItem,
    ...(folderId ? { folderId } : {}),
    displayOrder: material.display_order,
  };
};

const mapSubmissionItems = (submission: BackendSubmission, includeBackendIds: boolean) => {
  // Index item rows omit faculty notes and folder positions, so join the allowlisted resource rows by id.
  const resourceRows = [...(submission.newResources || []), ...(submission.reuseResources || [])];
  const findResourceRow = (material: BackendMaterial) => resourceRows.find((row) => (
    String(row.id) === String(material.id) && (
      row.is_reuse === undefined || typeof material.is_reuse !== 'boolean' ||
      (row.is_reuse === true || row.is_reuse === 1) === material.is_reuse
    )
  ));
  const folders = (submission.folders || []).map((folder) => {
    const folderId = `folder-${folder.id}`;
    const folderItems = (folder.items || []).map((material, index) => {
      const resourceRow = findResourceRow(material);
      return {
        item: mapMaterial(material, resourceRow, folderId, includeBackendIds),
        order: resourceRow?.position_in_folder ?? material.position_in_folder ?? index,
      };
    }).sort((left, right) => left.order - right.order);

    return {
      id: folderId,
      ...(includeBackendIds ? { backendFolderId: String(folder.id) } : {}),
      title: folder.name,
      isOpen: false,
      itemIds: folderItems.map(({ item }) => item.id),
      displayOrder: folder.display_order,
      folderItems: folderItems.map(({ item }) => item),
    };
  });

  const unfolderedItems = (submission.unfoldered_items || [])
    .map((material) => mapMaterial(material, findResourceRow(material), undefined, includeBackendIds))
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  const items = [...folders.flatMap((folder) => folder.folderItems), ...unfolderedItems];
  const mappedFolders = folders.map(({ folderItems: _folderItems, ...folder }) => folder);
  const layout = fromServer(mappedFolders, items);
  return layout;
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
  const { folders, items, layout } = mapSubmissionItems(submission, false);
  const legacyCourseAssignmentId = submission.section
    ? `${submission.course_code}-${submission.section}-${submission.term_code}`
    : submission.course_code;

  return {
    id: submission.submission_uuid,
    submissionUuid: submission.submission_uuid,
    courseCode: submission.course_code,
    courseTitle: submission.course_title,
    section: submission.section || '',
    instructors: submission.faculty_display_name,
    term: submission.term_code,
    status: submission.status as CourseReserve['status'],
    items,
    folders,
    layout,
    lastUpdated: formatLastUpdated(submission.updated_at),
    isTestData: false,
    courseAssignmentId: submission.its_course_id || legacyCourseAssignmentId,
    ...(submission.academic_period ? { academicPeriod: submission.academic_period } : {}),
    ...(typeof submission.draft_version === 'number' ? { draftVersion: submission.draft_version } : {}),
    // The current index response includes these loaded resource relations; legacy rows may not.
    ...(submission.newResources !== undefined || submission.reuseResources !== undefined
      ? {
          submissionNotes: submission.submission_notes ?? null,
          neededByDate: submission.needed_by_date ?? null,
        }
      : {}),
    ...mapLockFields(submission),
    ...mapProxyFields(submission),
  };
};

export const mapSubmissionDetailItem = (submission: BackendSubmission): CourseReserve => {
  const { folders, items, layout } = mapSubmissionItems(submission, true);

  return {
    id: submission.submission_uuid,
    submissionUuid: submission.submission_uuid,
    courseCode: submission.course_code,
    courseTitle: submission.course_title,
    section: submission.section || '',
    instructors: submission.faculty_display_name,
    term: submission.term_code,
    status: submission.status as CourseReserve['status'],
    items,
    folders,
    layout,
    lastUpdated: formatLastUpdated(submission.updated_at),
    isTestData: false,
    ...(submission.its_course_id ? { courseAssignmentId: submission.its_course_id } : {}),
    ...(submission.academic_period ? { academicPeriod: submission.academic_period } : {}),
    ...(typeof submission.draft_version === 'number' ? { draftVersion: submission.draft_version } : {}),
    ...mapLockFields(submission),
    ...mapProxyFields(submission),
    submissionNotes: submission.submission_notes ?? null,
    neededByDate: submission.needed_by_date ?? null,
  };
};

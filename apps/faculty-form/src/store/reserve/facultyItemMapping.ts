import type { CourseFolder, CourseItem } from './types';
import { fromServer } from '@/utils/listLayout';

type Nullable<T> = T | null;

interface FacultyLocationWire {
  id?: Nullable<string>;
  name?: Nullable<string>;
  code?: Nullable<string>;
}

interface FacultyEdsWire {
  dbId?: Nullable<string>;
  an?: Nullable<string>;
  plink?: Nullable<string>;
}

export interface FacultyItemWire {
  kind: 'new' | 'reuse';
  id: number;
  folder_id: Nullable<number>;
  folder_name: Nullable<string>;
  position: Nullable<number>;
  display_order: Nullable<number>;
  is_reuse: boolean;
  status: string;
  title: string;
  journalTitle: Nullable<string>;
  material_type: Nullable<string>;
  assignedPages: Nullable<string>;
  faculty_notes: Nullable<string>;
  barcode: Nullable<string>;
  call_number: Nullable<string>;
  eds: Nullable<FacultyEdsWire>;
  source_resource_id: Nullable<number | string>;
  source_folio_instance_id: Nullable<string>;
  instance_id: Nullable<string>;
  holdings_id: Nullable<string>;
  temporary_location: Nullable<FacultyLocationWire>;
  permanent_location: Nullable<FacultyLocationWire>;
  lock: { locked: boolean; kind: Nullable<string>; reason: Nullable<string> };
  capabilities: { edit: boolean; delete: boolean; move: boolean; reorder: boolean };
  authors: Nullable<string>;
  publisher: Nullable<string>;
  publicationYear: Nullable<string>;
  isbn: Nullable<string>;
  issn: Nullable<string>;
  doi: Nullable<string>;
  edition: Nullable<string>;
  oclcNumber: Nullable<string>;
  volume: Nullable<string>;
  issue: Nullable<string>;
  pages: Nullable<string>;
  url: Nullable<string>;
  displayStartDate: Nullable<string>;
  displayEndDate: Nullable<string>;
  instance_hrid: Nullable<string>;
  chapter_title: Nullable<string>;
  copy: Nullable<string>;
  temporary_location_id: Nullable<string>;
  permanent_location_id: Nullable<string>;
}

export interface FacultyFolderWire {
  folder_id: number;
  name: string;
  display_order: Nullable<number>;
  ambiguous: boolean;
  items: FacultyItemWire[];
}

export interface FacultySubmissionWire {
  submission_uuid: string;
  its_course_id?: Nullable<string>;
  academic_period?: Nullable<string>;
  course_code: string;
  course_title: string;
  section?: Nullable<string>;
  faculty_display_name: string;
  term_code: string;
  status: string;
  updated_at: string;
  draft_version?: Nullable<number>;
  submission_notes?: Nullable<string>;
  needed_by_date?: Nullable<string>;
  is_locked?: boolean;
  locked_at?: Nullable<string>;
  locked_by_staff_id?: Nullable<number | string>;
  lock_reason?: Nullable<string>;
  can_edit: boolean;
  access?: 'owner' | 'proxy' | 'co_instructor';
  proxy_can_edit?: boolean;
  folders: FacultyFolderWire[];
  unfoldered_items: FacultyItemWire[];
}

const mapMaterialStatus = (status: string): CourseItem['status'] => (
  status === 'pending' ? 'pending' :
    status === 'complete' ? 'complete' :
      status === 'in-progress' ? 'in-progress' :
        status === 'needs-review' ? 'needs-review' : 'draft'
);

const mapEds = (value: FacultyEdsWire | null): CourseItem['eds'] => value === null
  ? undefined
  : {
      dbId: value.dbId ?? '',
      an: value.an ?? '',
      ...(value.plink === null || value.plink === undefined ? {} : { plink: value.plink }),
    };

const mapLocation = (value: FacultyLocationWire | null) => value === null
  ? undefined
  : { id: value.id ?? '', name: value.name ?? '', code: value.code ?? '' };

export function mapFacultyItem(item: FacultyItemWire, folderId?: string): CourseItem {
  return {
    id: `material-${item.kind}-${item.id}`,
    backendItemId: String(item.id),
    backendKind: item.kind,
    isReuse: item.is_reuse,
    lock: item.lock,
    capabilities: item.capabilities,
    title: item.title,
    authors: item.authors ?? undefined,
    materialType: item.material_type === null
      ? 'other'
      : item.material_type as CourseItem['materialType'],
    status: mapMaterialStatus(item.status),
    barcode: item.barcode ?? undefined,
    callNumber: item.call_number ?? undefined,
    assignedPages: item.assignedPages ?? undefined,
    doi: item.doi ?? undefined,
    issn: item.issn ?? undefined,
    journalTitle: item.journalTitle ?? '',
    isbn: item.isbn ?? undefined,
    publisher: item.publisher ?? undefined,
    publicationYear: item.publicationYear ?? undefined,
    edition: item.edition ?? undefined,
    oclcNumber: item.oclcNumber ?? undefined,
    volume: item.volume ?? undefined,
    issue: item.issue ?? undefined,
    pages: item.pages ?? undefined,
    chapterTitle: item.chapter_title ?? undefined,
    copy: item.copy ?? undefined,
    url: item.url ?? undefined,
    displayStartDate: item.displayStartDate ?? undefined,
    displayEndDate: item.displayEndDate ?? undefined,
    notes: item.faculty_notes ?? undefined,
    sourceResourceId: item.source_resource_id === null || item.source_resource_id === undefined
      ? undefined
      : String(item.source_resource_id),
    sourceFolioInstanceId: item.source_folio_instance_id ?? undefined,
    instanceId: item.instance_id ?? undefined,
    instanceHrid: item.instance_hrid ?? undefined,
    holdingsId: item.holdings_id ?? undefined,
    temporaryLocationId: item.temporary_location_id ?? undefined,
    temporaryLocationObject: mapLocation(item.temporary_location),
    permanentLocationId: item.permanent_location_id ?? undefined,
    permanentLocationObject: mapLocation(item.permanent_location),
    eds: mapEds(item.eds),
    ...(folderId ? { folderId } : {}),
    displayOrder: item.display_order ?? undefined,
  };
}

export function mapFacultySubmissionItems(folders: FacultyFolderWire[], rootItems: FacultyItemWire[]) {
  const mappedFolders = folders.map((folder) => {
    const id = `folder-${folder.folder_id}`;
    const items = folder.items.map((item) => mapFacultyItem(item, id));
    return {
      folder: {
        id,
        backendFolderId: String(folder.folder_id),
        title: folder.name,
        ambiguous: folder.ambiguous,
        isOpen: false,
        itemIds: items.map((item) => item.id),
      } satisfies CourseFolder,
      displayOrder: folder.display_order,
      items,
    };
  });
  const items = [
    ...mappedFolders.flatMap(({ items: folderItems }) => folderItems),
    ...rootItems.map((item) => mapFacultyItem(item)),
  ];
  const ordered = fromServer(
    mappedFolders.map(({ folder, displayOrder }) => ({ ...folder, displayOrder })),
    items,
  );

  return ordered;
}

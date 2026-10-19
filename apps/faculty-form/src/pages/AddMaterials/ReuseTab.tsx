import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, BookOpen, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createCloneResourceHandler } from '@/handlers/cloneResourceHandler';
import { useCourseCloning, type PreviousCourse, type PreviewResource } from '@/hooks/useCourseCloning';
import { useActingForStore } from '@/store/actingForStore';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';
import { filterPreviousCoursesForSubmission, getPinnedPreviousCourse, sortPreviousCourses } from '@/utils/reuseCourseTerms';
import { useSubmissionEditorContext } from '@/pages/SubmissionEditor/SubmissionEditorContext';
import { mapReuseResources, toReuseDuplicateCandidate } from './reuseResourceMapper';

export default function ReuseTab() {
  const { id, reserve, user, addItem, createFolder, moveFolderPosition } = useSubmissionEditorContext();
  const selectedFaculty = useActingForStore((state) => state.selectedFaculty);
  const {
    loadingPreviousCourses, hasLoadedPreviousCourses, loadingOtherCourses,
    previousCourses, fetchPreviousCourses, fetchCourseResources,
  } = useCourseCloning();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCourse, setSelectedCourse] = useState<PreviousCourse | null>(null);
  const [resources, setResources] = useState<PreviewResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const folderIds = useRef<Record<string, string>>({});
  const requestId = useRef(0);
  const courseSelection = searchParams.get('course');
  const orderedCourses = useMemo(() => sortPreviousCourses(
    filterPreviousCoursesForSubmission(previousCourses, reserve.term, reserve.courseCode),
  ), [previousCourses, reserve.courseCode, reserve.term]);
  const instructorName = selectedFaculty?.displayName || user?.full_name;

  useEffect(() => {
    if (reserve.courseCode && instructorName) {
      void fetchPreviousCourses(reserve.courseCode, instructorName, 'all');
    }
  }, [fetchPreviousCourses, instructorName, reserve.courseCode]);

  const loadCourse = useCallback(async (course: PreviousCourse, updateUrl = true) => {
    const currentRequest = ++requestId.current;
    setSelectedCourse(course);
    setResources([]);
    setLoadingResources(true);
    folderIds.current = {};
    if (updateUrl) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('tab', 'reuse');
        next.set('course', course.courseListingId);
        return next;
      }, { replace: true });
    }
    try {
      const result = await fetchCourseResources(course.courseListingId);
      if (currentRequest === requestId.current) {
        setResources(mapReuseResources(result.orderedResources || result.electronicResources, result.physicalReserves));
      }
    } catch {
      if (currentRequest === requestId.current) toast.error('Could not load materials for this course.');
    } finally {
      if (currentRequest === requestId.current) setLoadingResources(false);
    }
  }, [fetchCourseResources, setSearchParams]);

  useEffect(() => {
    if (!hasLoadedPreviousCourses || !courseSelection) return;
    const course = courseSelection === 'last'
      ? orderedCourses.find((candidate) => candidate.isExactMatch)
      : orderedCourses.find((candidate) => candidate.courseListingId === courseSelection);
    if (course && selectedCourse?.courseListingId !== course.courseListingId) void loadCourse(course);
  }, [courseSelection, hasLoadedPreviousCourses, loadCourse, orderedCourses, selectedCourse?.courseListingId]);

  const cloneResourceHandler = createCloneResourceHandler(reserve, id, addItem, false);
  const isInList = (resource: PreviewResource) => Boolean(
    findDuplicateCourseItem(reserve.items || [], toReuseDuplicateCandidate(resource))
  );
  const canAddResource = (resource: PreviewResource) => resource.type === 'physical'
    ? Boolean(resource._originalReserve?.copiedItem?.title || resource._originalReserve?.item?.title)
    : Boolean(resource._originalResource);
  const ensureDestinationFolder = (folderName?: string) => {
    if (!folderName || searchParams.get('folder')) return undefined;
    if (!folderIds.current[folderName]) {
      const folderId = createFolder(id, folderName);
      folderIds.current[folderName] = folderId;
      const ungroupedItems = (reserve.items || []).filter((item) => !item.folderId).length;
      const displayItems = reserve.folders.length + ungroupedItems + Object.keys(folderIds.current).length;
      for (let position = 1; position < displayItems; position += 1) {
        moveFolderPosition(id, folderId, 'down');
      }
    }
    return folderIds.current[folderName];
  };
  const addResource = (resource: PreviewResource) => {
    if (isInList(resource)) return;
    const folderId = ensureDestinationFolder(resource.folderName);
    cloneResourceHandler.handleAddSingleResource({ ...resource, folderId });
  };
  const addAll = () => resources.filter((resource) => canAddResource(resource) && !isInList(resource)).forEach(addResource);

  const pinnedCourse = getPinnedPreviousCourse(orderedCourses);
  const otherCourses = orderedCourses.filter((course) => course.courseListingId !== pinnedCourse?.courseListingId);
  const groups = groupCoursesByTerm(otherCourses);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.6fr)]" aria-label="Reuse a past course">
      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Previous courses</h2>
        {(loadingPreviousCourses || !hasLoadedPreviousCourses) && <p role="status" className="text-sm text-muted-foreground">Finding your previous courses…</p>}
        {loadingOtherCourses && <p role="status" className="text-sm text-muted-foreground">Finding more courses…</p>}
        {pinnedCourse && (
          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold text-primary">Last time you taught this course</p>
            <CourseButton course={pinnedCourse} selectedId={selectedCourse?.courseListingId} onSelect={loadCourse} pinned />
          </div>
        )}
        {groups.map((group) => (
          <div key={group.term} className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{group.term}</h3>
            <div className="space-y-2">{group.courses.map((course) => <CourseButton key={course.courseListingId} course={course} selectedId={selectedCourse?.courseListingId} onSelect={loadCourse} />)}</div>
          </div>
        ))}
        {hasLoadedPreviousCourses && orderedCourses.length === 0 && (
          <p className="text-sm text-muted-foreground">No previous courses were found for {reserve.courseCode}.</p>
        )}
      </Card>

      <div className="min-w-0">
        {!selectedCourse ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Choose a previous course to view its materials.</div>
        ) : (
          <section aria-label={`Resources from ${selectedCourse.courseName}`} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selectedCourse.courseNumber} · {selectedCourse.courseName}</h2>
                <p className="text-sm text-muted-foreground">{selectedCourse.term}</p>
              </div>
              <Button onClick={addAll} disabled={loadingResources || resources.every((resource) => !canAddResource(resource) || isInList(resource))}>
                <Plus className="mr-2 h-4 w-4" />Add all
              </Button>
            </div>
            {loadingResources && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading course materials…</p>}
            {!loadingResources && resources.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"><AlertCircle className="mx-auto mb-2 h-6 w-6" />No materials found for this course.</div>
            )}
            {!loadingResources && resources.map((resource, index) => (
              <ResourceCard key={`${resource.type}-${resource.title}-${index}`} resource={resource} isInList={isInList(resource)} onAdd={() => addResource(resource)} />
            ))}
          </section>
        )}
      </div>
    </section>
  );
}

function CourseButton({ course, selectedId, onSelect, pinned = false }: {
  course: PreviousCourse;
  selectedId?: string;
  onSelect: (course: PreviousCourse) => void;
  pinned?: boolean;
}) {
  return (
    <button
      type="button"
      data-course-listing-id={course.courseListingId}
      aria-pressed={selectedId === course.courseListingId}
      onClick={() => void onSelect(course)}
      className={`w-full rounded-md border p-3 text-left hover:bg-accent ${selectedId === course.courseListingId ? 'border-primary bg-accent' : ''}`}
    >
      {pinned && <span className="sr-only">Last time you taught this course </span>}
      <span className="block font-medium">{course.courseNumber} · {course.courseName}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{course.term} · {course.resourceCount} materials</span>
    </button>
  );
}

function ResourceCard({ resource, isInList, onAdd }: {
  resource: PreviewResource;
  isInList: boolean;
  onAdd: () => void;
}) {
  const hasOriginalData = resource.type === 'physical'
    ? Boolean(resource._originalReserve?.copiedItem?.title || resource._originalReserve?.item?.title)
    : Boolean(resource._originalResource);
  return (
    <Card className="flex items-start justify-between gap-4 p-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{resource.type === 'physical' ? 'Physical' : 'Electronic'}</Badge>
          {resource.folderName && <Badge variant="secondary">Folder: {resource.folderName}</Badge>}
        </div>
        <h3 className="font-medium">{resource.title}</h3>
        {resource.author && <p className="text-sm text-muted-foreground">{resource.author}</p>}
        {resource.callNumber && <p className="text-sm text-muted-foreground">Call Number: {resource.callNumber}</p>}
        {resource.notes && <p className="text-sm text-muted-foreground">{resource.notes}</p>}
      </div>
      {isInList ? (
        <Badge className="shrink-0">In your list ✓</Badge>
      ) : (
        <Button size="sm" onClick={onAdd} disabled={!hasOriginalData} aria-label={`Add ${resource.title}`}>
          <BookOpen className="mr-2 h-4 w-4" />Add
        </Button>
      )}
    </Card>
  );
}

function groupCoursesByTerm(courses: PreviousCourse[]) {
  const groups = new Map<string, PreviousCourse[]>();
  courses.forEach((course) => {
    const group = groups.get(course.term) || [];
    group.push(course);
    groups.set(course.term, group);
  });
  return Array.from(groups, ([term, groupedCourses]) => ({ term, courses: groupedCourses }));
}

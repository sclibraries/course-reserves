import { CourseList } from '@/components/ClonePrevious/CourseList';
import { CoursePreviewDialog } from '@/components/ClonePrevious/CoursePreviewDialog';
import { useClonePrevious } from '@/hooks/useClonePrevious';

export default function ClonePrevious() {
  const clonePrevious = useClonePrevious();
  const filteredCourseCount = clonePrevious.courseGroups.reduce(
    (count, group) => count + group.courses.length,
    0
  );

  if (!clonePrevious.isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Access Restricted</h1>
          <p className="text-muted-foreground">
            Please log in to view and clone your previous courses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <CourseList
        loading={clonePrevious.loading}
        courseCount={clonePrevious.courses.length}
        filteredCourseCount={filteredCourseCount}
        searchQuery={clonePrevious.searchQuery}
        nextTerm={clonePrevious.nextTerm}
        courseGroups={clonePrevious.courseGroups}
        cloningCourse={clonePrevious.cloningCourse}
        onSearchQueryChange={clonePrevious.setSearchQuery}
        onClearSearch={clonePrevious.clearSearch}
        onPreviewCourse={clonePrevious.handlePreviewCourse}
        onCloneCourse={clonePrevious.handleCloneCourse}
      />
      <CoursePreviewDialog
        open={clonePrevious.previewOpen}
        onOpenChange={clonePrevious.setPreviewOpen}
        selectedCourse={clonePrevious.selectedCourse}
        selectedCourseDisplay={clonePrevious.selectedCourseDisplay}
        loadingResources={clonePrevious.loadingResources}
        resources={clonePrevious.courseResources}
        cloningCourse={clonePrevious.cloningCourse}
        onCloneCourse={clonePrevious.handleCloneCourse}
      />
    </div>
  );
}

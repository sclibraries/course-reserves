import { Book, Copy, Eye, Search, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { Course } from '@/store/courseSearchStore';
import type { CourseTermGroup } from '@/pages/clonePrevious/types';

interface CourseListProps {
  loading: boolean;
  courseCount: number;
  filteredCourseCount: number;
  searchQuery: string;
  nextTerm: string;
  courseGroups: CourseTermGroup[];
  cloningCourse: string | null;
  onSearchQueryChange: (query: string) => void;
  onClearSearch: () => void;
  onPreviewCourse: (course: Course) => void;
  onCloneCourse: (course: Course) => void;
}

export const CourseList = ({
  loading,
  courseCount,
  filteredCourseCount,
  searchQuery,
  nextTerm,
  courseGroups,
  cloningCourse,
  onSearchQueryChange,
  onClearSearch,
  onPreviewCourse,
  onCloneCourse,
}: CourseListProps) => (
  <>
    <div className="mb-8">
      <h1 className="text-3xl font-bold mb-2">Clone from Previous Courses</h1>
      <p className="text-muted-foreground mb-6">
        Find your previous courses and copy their resources to create a new course reserves submission.
      </p>

      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter courses by title..."
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="pl-9"
          />
        </div>
        {searchQuery && (
          <Button variant="outline" onClick={onClearSearch}>Clear Filter</Button>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How to Clone a Course</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Use the filter above to search course titles and narrow down the list</li>
          <li>• Click "Preview" to see course resources before cloning</li>
          <li>• Click "Clone" to copy resources to a new submission for the {nextTerm}</li>
          <li>• You can edit and modify the cloned resources before submitting</li>
        </ul>
      </div>
    </div>

    {loading && (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p>Searching for courses...</p>
      </div>
    )}

    {courseCount > 0 && (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {searchQuery ? `${filteredCourseCount} of ${courseCount}` : courseCount} Course{courseCount !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {filteredCourseCount} result{filteredCourseCount !== 1 ? 's' : ''}
            </Badge>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Sorted by term and course name
            </span>
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Term</TableHead>
                <TableHead className="w-[100px]">Course #</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="w-[200px]">Instructor(s)</TableHead>
                <TableHead className="w-[100px] text-center">Resources</TableHead>
                <TableHead className="w-[200px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courseGroups.flatMap((group) => group.courses.map(({ course, displayCourse }) => (
                <TableRow key={`${group.term}-${displayCourse.id}`} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <Badge variant="outline" className="text-xs">{displayCourse.term}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{displayCourse.courseNumber}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{displayCourse.courseTitle}</div>
                      <div className="text-sm text-muted-foreground">{displayCourse.departmentName}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{displayCourse.instructor}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">
                      {displayCourse.resourceCount === 'loading' ? (
                        <div className="flex items-center gap-1">
                          <div className="inline-block animate-spin rounded-full h-2 w-2 border-b border-current" />
                          Loading
                        </div>
                      ) : displayCourse.resourceCount}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={() => onPreviewCourse(course)} variant="outline" size="sm">
                        <Eye className="h-3 w-3 mr-1" />Preview &amp; Copy
                      </Button>
                      <Button onClick={() => onCloneCourse(course)} size="sm" disabled={cloningCourse === course.id}>
                        {cloningCourse === course.id ? (
                          <><span className="animate-spin rounded-full h-3 w-3 border-b border-current mr-1" />Cloning...</>
                        ) : <><Copy className="h-3 w-3 mr-1" />Clone</>}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </div>
      </div>
    )}

    {!loading && courseCount === 0 && (
      <div className="text-center py-12">
        <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Courses Found</h3>
        <p className="text-muted-foreground mb-4">
          No courses available to clone. This could mean you haven't taught any courses yet, or there may be an issue loading your course history.
        </p>
      </div>
    )}

    {!loading && courseCount > 0 && filteredCourseCount === 0 && searchQuery && (
      <div className="text-center py-12">
        <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Matches Found</h3>
        <p className="text-muted-foreground mb-4">
          No courses match "{searchQuery}". Try a different search term or clear the filter to see all courses.
        </p>
        <Button variant="outline" onClick={onClearSearch}>Clear Filter</Button>
      </div>
    )}
  </>
);

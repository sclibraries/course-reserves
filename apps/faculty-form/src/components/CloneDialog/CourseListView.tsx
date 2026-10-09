import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Copy, ExternalLink, FileText, User } from "lucide-react";
import type { PreviousCourse } from "@/hooks/useCourseCloning";

interface CourseListViewProps {
  loadingPreviousCourses: boolean;
  hasLoadedPreviousCourses: boolean;
  loadingOtherCourses: boolean;
  previousCourses: PreviousCourse[];
  cloningFromCourse: string | null;
  userName: string;
  currentItemsCount: number;
  courseCode: string;
  onPreviewCourse: (course: PreviousCourse) => void;
}

export const CourseListView: React.FC<CourseListViewProps> = ({
  loadingPreviousCourses,
  hasLoadedPreviousCourses,
  loadingOtherCourses,
  previousCourses,
  cloningFromCourse,
  userName,
  currentItemsCount,
  courseCode,
  onPreviewCourse,
}) => {
  if (loadingPreviousCourses || !hasLoadedPreviousCourses) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p>Checking for exact matches...</p>
      </div>
    );
  }

  const exactMatches = previousCourses.filter(c => c.isExactMatch);
  const otherCourses = previousCourses.filter(c => !c.isExactMatch);

  if (previousCourses.length === 0 && loadingOtherCourses) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p>Checking your other courses...</p>
        <p className="text-sm text-muted-foreground mt-2">
          We didn't find an exact match for {courseCode} yet.
        </p>
      </div>
    );
  }

  if (previousCourses.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No Previous Courses Found</h3>
        <p>We couldn't find any previous courses for {userName}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> Resource counts include both electronic and physical materials.
        </p>
      </div>
      
      {/* Exact Matches Section */}
      {exactMatches.length > 0 && (
        <>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <h4 className="font-semibold text-green-900 flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4" />
              Exact Matches ({exactMatches.length})
            </h4>
            <p className="text-sm text-green-700">
              These courses have the same course code ({courseCode})
            </p>
          </div>
          {exactMatches.map((course) => (
            <CourseCard
              key={course.courseListingId}
              course={course}
              isExactMatch={true}
              cloningFromCourse={cloningFromCourse}
              currentItemsCount={currentItemsCount}
              onPreview={onPreviewCourse}
            />
          ))}
        </>
      )}

      {loadingOtherCourses && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 my-4 text-blue-700">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <div>
            <p className="font-medium">Checking your other courses...</p>
            <p className="text-sm text-blue-600">Exact matches are ready. We&apos;re still looking for other courses you taught.</p>
          </div>
        </div>
      )}

      {/* Other Courses Section */}
      {otherCourses.length > 0 && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 my-4">
            <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-1">
              <ExternalLink className="h-4 w-4" />
              Other Courses ({otherCourses.length})
            </h4>
            <p className="text-sm text-blue-700">
              Your other courses that may have relevant materials
            </p>
          </div>
          {otherCourses.map((course) => (
            <CourseCard
              key={course.courseListingId}
              course={course}
              isExactMatch={false}
              cloningFromCourse={cloningFromCourse}
              currentItemsCount={currentItemsCount}
              onPreview={onPreviewCourse}
            />
          ))}
        </>
      )}
    </div>
  );
};

interface CourseCardProps {
  course: PreviousCourse;
  isExactMatch: boolean;
  cloningFromCourse: string | null;
  currentItemsCount: number;
  onPreview: (course: PreviousCourse) => void;
}

const CourseCard: React.FC<CourseCardProps> = ({
  course,
  isExactMatch,
  cloningFromCourse,
  currentItemsCount,
  onPreview,
}) => {
  const isCloning = cloningFromCourse === course.courseListingId;

  return (
    <Card 
      className={`p-4 hover:shadow-md transition-shadow ${isExactMatch ? 'border-green-200' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{course.courseNumber} - {course.courseName}</h4>
            {isExactMatch && <Badge variant="default" className="bg-green-600">Exact Match</Badge>}
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{course.term}</Badge>
              <span>•</span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {course.instructor}
              </span>
            </div>
            <div className="flex items-center gap-1 text-blue-600">
              <FileText className="h-3 w-3" />
              {course.resourceCount > 0 ? (
                <span>
                  <strong>{course.resourceCount}</strong> resource{course.resourceCount !== 1 ? 's' : ''} 
                  <span className="text-xs text-muted-foreground ml-1">
                    ({course.electronicCount} electronic, {course.physicalCount} physical)
                  </span>
                </span>
              ) : (
                <>No resources found</>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          <Button
            onClick={() => onPreview(course)}
            variant="outline"
            size="sm"
          >
            <FileText className="h-3 w-3 mr-2" />
            Preview
          </Button>
        </div>
      </div>
    </Card>
  );
};

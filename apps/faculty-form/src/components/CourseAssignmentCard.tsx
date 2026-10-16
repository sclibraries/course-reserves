import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { CourseAssignment } from "@/store/courseAssignmentsStore";
import { useCourseReservesStore } from "@/store/courseReservesStore";
import { toast } from "sonner";
import { getCourseTermLabel } from "@/utils/courseTermLabel";

interface CourseAssignmentCardProps {
  assignment: CourseAssignment;
}

export const CourseAssignmentCard = ({ assignment }: CourseAssignmentCardProps) => {
  const navigate = useNavigate();
  const { addReserve, findReserveByAssignmentId } = useCourseReservesStore();
  
  const folioCourse = assignment.folio_course;
  const folioTerm = assignment.folio_term;
  const parsedCourse = assignment.parsed_course;
  const assignmentData = assignment.assignment;
  const termLabel = getCourseTermLabel(folioTerm?.name, assignmentData?.academic_period);
  
  const isInFolio = folioCourse?.id && folioCourse?.source !== 'backend';
  const courseAssignmentId = assignmentData?.course_id || '';
  
  // Check if a reserve already exists for this assignment
  const existingReserve = findReserveByAssignmentId(courseAssignmentId);
  
  const handleCreateOrOpenCourse = () => {
    // If reserve already exists, navigate to it
    if (existingReserve) {
      toast.info(`Opening existing course reserve`);
      navigate(`/submission/${existingReserve.id}/edit`);
      return;
    }
    
    // Otherwise, create a new reserve
    // Extract instructor names from FOLIO if available, otherwise use assignment data
    let instructorNames = "";
    if (folioCourse?.courseListingObject && typeof folioCourse.courseListingObject === 'object') {
      const listingObj = folioCourse.courseListingObject as { instructorObjects?: Array<{ name?: string }> };
      if (listingObj.instructorObjects) {
        instructorNames = listingObj.instructorObjects
          .map((i) => i?.name)
          .filter(Boolean)
          .join(", ");
      }
    }
    
    const reserveId = addReserve({
      courseCode: parsedCourse?.courseNumber || assignmentData?.course_id || "",
      courseTitle: assignmentData?.course_title || folioCourse?.name || "",
      section: parsedCourse?.sectionName || "",
      instructors: instructorNames,
      term: termLabel,
      status: "draft",
      items: [],
      folders: [],
      courseAssignmentId: courseAssignmentId, // Link to the course assignment
      academicPeriod: assignmentData?.academic_period,
    });
    
    toast.success(`Created course reserve: ${parsedCourse?.courseNumber || assignmentData?.course_id}`);
    navigate(`/submission/${reserveId}/edit`);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight">
              {parsedCourse?.courseNumber || 'Unknown'} · {assignmentData?.course_title || 'Untitled Course'}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {termLabel}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Section {parsedCourse?.sectionName || 'N/A'}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground">
            <strong>Role:</strong> {assignmentData?.role || 'N/A'}
          </p>
          <p className="text-muted-foreground">
            <strong>Term:</strong> {termLabel}
          </p>
          {folioCourse?.departmentObject && typeof folioCourse.departmentObject === 'object' && (
            <p className="text-muted-foreground">
              <strong>Department:</strong> {(folioCourse.departmentObject as { name?: string })?.name || 'N/A'}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button 
          variant={existingReserve ? "outline" : "default"}
          className={existingReserve ? "flex-1" : "flex-1 bg-green-600 hover:bg-green-700"}
          onClick={handleCreateOrOpenCourse}
        >
          <Plus className="h-4 w-4 mr-2" />
          {existingReserve ? "Open Reserves" : "Add Reserves"}
        </Button>
      </CardFooter>
    </Card>
  );
};

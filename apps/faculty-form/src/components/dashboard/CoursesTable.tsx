import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Eye, Plus } from 'lucide-react';
import { useCourseReservesStore } from '@/store/courseReservesStore';
import type { CourseAssignment } from '@/store/courseAssignmentsStore';
import type { Submission } from '@/components/SubmissionCard';
import { getCourseTermLabel } from '@/utils/courseTermLabel';

type CourseRow = {
  type: 'submission' | 'assignment';
  submission?: Submission;
  assignment?: CourseAssignment;
  key: string;
};

export const CoursesTable = ({ courses }: { courses: CourseRow[] }) => {
  const navigate = useNavigate();
  const addReserve = useCourseReservesStore((state) => state.addReserve);

  const handleAddReserves = (assignment: CourseAssignment) => {
    const { assignment: course, parsed_course: parsedCourse, folio_term: folioTerm, folio_course: folioCourse } = assignment;
    const termLabel = getCourseTermLabel(folioTerm?.name, course.academic_period);
    const reserveId = addReserve({
      courseCode: folioCourse?.courseNumber || parsedCourse.courseNumber,
      courseTitle: folioCourse?.name || course.course_title,
      section: parsedCourse.sectionName,
      instructors: '',
      term: termLabel,
      status: 'draft',
      items: [],
      folders: [],
      courseAssignmentId: course.course_id,
      academicPeriod: course.academic_period,
    });
    navigate(`/submission/${reserveId}/edit`);
  };

  return (
    <div className="border rounded-lg bg-card">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="font-semibold">Course</TableHead>
          <TableHead className="font-semibold">Section</TableHead>
          <TableHead className="font-semibold">Term</TableHead>
          <TableHead className="font-semibold">Status</TableHead>
          <TableHead className="font-semibold">Items</TableHead>
          <TableHead className="font-semibold">Last Updated</TableHead>
          <TableHead className="text-right font-semibold">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {courses.map((item) => {
            if (item.type === 'submission' && item.submission) {
              const submission = item.submission;
              const canEdit = submission.proxyCanEdit !== false;
              return (
                <TableRow key={item.key} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="font-medium">{submission.courseCode}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-xs">{submission.courseTitle}</div>
                    {submission.access === 'proxy' && <Badge variant="outline">Proxy</Badge>}
                    {submission.access === 'co_instructor' && <Badge variant="outline">Co-instructor</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{submission.term}</Badge></TableCell>
                  <TableCell><StatusBadge status={submission.status} /></TableCell>
                  <TableCell className="text-sm">
                    <div>{submission.totalItems} total</div>
                    <div className="text-xs text-muted-foreground">{submission.completeItems} complete</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{submission.lastUpdated}</TableCell>
                  <TableCell className="text-right">
                    {submission.status === 'draft' && canEdit ? (
                      <Button size="sm" onClick={() => navigate(`/submission/${submission.id}/edit`)}>
                        <Edit className="h-4 w-4 mr-1" />Edit
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/submission/${submission.id}`)}>
                        <Eye className="h-4 w-4 mr-1" />View
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            }

            if (item.type !== 'assignment' || !item.assignment?.assignment) return null;
            const assignment = item.assignment;
            const course = assignment.assignment;
            const canEdit = assignment.canEdit !== false;
            const termLabel = getCourseTermLabel(assignment.folio_term?.name, course.academic_period);
            return (
              <TableRow key={item.key} className="hover:bg-muted/50">
                <TableCell>
                  <div className="font-medium">{assignment.folio_course?.courseNumber || assignment.parsed_course.courseNumber}</div>
                  <div className="text-sm text-muted-foreground truncate max-w-xs">{assignment.folio_course?.name || course.course_title}</div>
                </TableCell>
                <TableCell className="text-sm">{assignment.parsed_course.sectionName}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{termLabel}</Badge></TableCell>
                <TableCell><Badge variant="outline" className="text-xs">Not Started</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-right">
                  {canEdit && <Button size="sm" onClick={() => handleAddReserves(assignment)}>
                    <Plus className="h-4 w-4 mr-1" />Add Reserves
                  </Button>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { useCourseReservesStore } from '@/store/courseReservesStore';
import type { CourseAssignment } from '@/store/courseAssignmentsStore';
import type { Submission } from '@/components/SubmissionCard';
import { getCourseTermLabel } from '@/utils/courseTermLabel';
import { DashboardCourseCard } from './DashboardCourseCard';
import { SubmissionActions } from './SubmissionActions';
import { SubmissionAccessBadge } from './SubmissionAccessBadge';

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
    <>
      <div className="space-y-3 lg:hidden">
        {courses.map((item) => {
          if (item.type === 'submission' && item.submission) {
            const submission = item.submission;
            return (
              <DashboardCourseCard
                key={item.key}
                code={submission.courseCode}
                title={submission.courseTitle}
                section="—"
                term={<Badge variant="secondary" className="text-xs">{submission.term}</Badge>}
                status={<StatusBadge status={submission.status} />}
                access={submission.access}
                items={<>{submission.totalItems} total · {submission.completeItems} complete</>}
                lastUpdated={submission.lastUpdated}
                actions={<SubmissionActions submission={submission} />}
              />
            );
          }

          if (item.type !== 'assignment' || !item.assignment?.assignment) return null;
          const assignment = item.assignment;
          const course = assignment.assignment;
          const canEdit = assignment.canEdit !== false;
          const termLabel = getCourseTermLabel(assignment.folio_term?.name, course.academic_period);
          return (
            <DashboardCourseCard
              key={item.key}
              code={assignment.folio_course?.courseNumber || assignment.parsed_course.courseNumber}
              title={assignment.folio_course?.name || course.course_title}
              section={assignment.parsed_course.sectionName}
              term={<Badge variant="secondary" className="text-xs">{termLabel}</Badge>}
              status={<Badge variant="outline" className="text-xs">Not Started</Badge>}
              items="—"
              lastUpdated="—"
              actions={canEdit && <Button size="sm" onClick={() => handleAddReserves(assignment)}>
                <Plus className="mr-1 h-4 w-4" />Add Reserves
              </Button>}
            />
          );
        })}
      </div>
      <div className="hidden rounded-lg border bg-card lg:block">
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
              return (
                <TableRow key={item.key} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="font-medium">{submission.courseCode}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-xs">{submission.courseTitle}</div>
                    <SubmissionAccessBadge access={submission.access} />
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
                    <div className="inline-flex gap-2"><SubmissionActions submission={submission} /></div>
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
    </>
  );
};

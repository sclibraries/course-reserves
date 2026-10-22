import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Submission } from '@/components/SubmissionCard';
import { DashboardCourseCard } from './DashboardCourseCard';
import { SubmissionActions } from './SubmissionActions';
import { SubmissionAccessBadge } from './SubmissionAccessBadge';

export const ReservesTable = ({ submissions }: { submissions: Submission[] }) => {
  return (
    <>
      <div className="space-y-3 lg:hidden">
        {submissions.map((submission) => (
          <DashboardCourseCard
            key={submission.id}
            code={submission.courseCode}
            title={submission.courseTitle}
            term={<Badge variant="secondary" className="text-xs">{submission.term}</Badge>}
            status={<StatusBadge status={submission.status} />}
            access={submission.access}
            items={<>{submission.totalItems} total · {submission.completeItems} complete</>}
            lastUpdated={submission.lastUpdated}
            actions={<SubmissionActions submission={submission} />}
          />
        ))}
      </div>
      <div className="hidden rounded-lg border bg-card lg:block">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="font-semibold">Course</TableHead>
          <TableHead className="font-semibold">Term</TableHead>
          <TableHead className="font-semibold">Status</TableHead>
          <TableHead className="font-semibold">Items</TableHead>
          <TableHead className="font-semibold">Last Updated</TableHead>
          <TableHead className="text-right font-semibold">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id} className="hover:bg-muted/50">
              <TableCell>
                <div className="font-medium">{submission.courseCode}</div>
                <div className="text-sm text-muted-foreground truncate max-w-xs">{submission.courseTitle}</div>
                <SubmissionAccessBadge access={submission.access} />
              </TableCell>
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
          ))}
        </TableBody>
      </Table>
      </div>
    </>
  );
};

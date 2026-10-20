import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Eye } from 'lucide-react';
import type { Submission } from '@/components/SubmissionCard';
import { DraftDiscardButton } from './DraftDiscardButton';

export const ReservesTable = ({ submissions }: { submissions: Submission[] }) => {
  const navigate = useNavigate();

  return (
    <div className="border rounded-lg bg-card">
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
                {submission.access === 'proxy' && <Badge variant="outline">Proxy</Badge>}
                {submission.access === 'co_instructor' && <Badge variant="outline">Co-instructor</Badge>}
              </TableCell>
              <TableCell><Badge variant="secondary" className="text-xs">{submission.term}</Badge></TableCell>
              <TableCell><StatusBadge status={submission.status} /></TableCell>
              <TableCell className="text-sm">
                <div>{submission.totalItems} total</div>
                <div className="text-xs text-muted-foreground">{submission.completeItems} complete</div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{submission.lastUpdated}</TableCell>
              <TableCell className="text-right">
                {submission.status === 'draft' && submission.proxyCanEdit !== false ? (
                  <div className="inline-flex gap-2">
                    <Button size="sm" onClick={() => navigate(`/submission/${submission.id}/edit`)}>
                      <Edit className="h-4 w-4 mr-1" />Edit
                    </Button>
                    <DraftDiscardButton submissionId={submission.id} />
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => navigate(`/submission/${submission.id}`)}>
                    <Eye className="h-4 w-4 mr-1" />View
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

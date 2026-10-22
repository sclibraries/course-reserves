import { useNavigate } from 'react-router-dom';
import { Edit, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Submission } from '@/components/SubmissionCard';
import { DraftDiscardButton } from './DraftDiscardButton';

export function SubmissionActions({ submission }: { submission: Pick<Submission, 'id' | 'status' | 'proxyCanEdit'> }) {
  const navigate = useNavigate();

  if (submission.status === 'draft' && submission.proxyCanEdit !== false) {
    return (
      <>
        <Button size="sm" onClick={() => navigate(`/submission/${submission.id}/edit`)}>
          <Edit className="mr-1 h-4 w-4" />Edit
        </Button>
        <DraftDiscardButton submissionId={submission.id} />
      </>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => navigate(`/submission/${submission.id}`)}>
      <Eye className="mr-1 h-4 w-4" />View
    </Button>
  );
}

import { ArrowLeft, Lock, Pencil, Trash2 } from 'lucide-react';
import type { CourseReserve } from '@/store/courseReservesStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import StickyTop from '@/components/StickyTop';

interface SubmissionDetailHeaderProps {
  reserve: CourseReserve;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const SubmissionDetailHeader = ({ reserve, canEdit, onBack, onEdit, onDelete }: SubmissionDetailHeaderProps) => {
  const status = reserve.status === 'in-progress' ? 'partial'
    : reserve.status === 'submitted' ? 'submitted'
      : reserve.status === 'complete' ? 'complete' : 'draft';

  return (
    <StickyTop
      header={(
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">My Course Reserves /</span>
                    <span className="font-semibold">{reserve.courseCode} ({reserve.term})</span>
                    {reserve.isLocked && (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                        title={`Locked by ${reserve.lockedBy || 'staff'}${reserve.lockedAt ? ` on ${new Date(reserve.lockedAt).toLocaleDateString()}` : ''}${reserve.lockReason ? `. Reason: ${reserve.lockReason}` : ''}`}
                      >
                        <Lock className="h-3 w-3" />
                        {reserve.lockedBy ? `Locked by ${reserve.lockedBy}` : 'Locked by Staff'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={status} />
                {canEdit && (
                  <>
                    <Button variant="outline" onClick={onEdit}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Submission
                    </Button>
                    <Button
                      variant="outline"
                      onClick={onDelete}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
      )}
    />
  );
};

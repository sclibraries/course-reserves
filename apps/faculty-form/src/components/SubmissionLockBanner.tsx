import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LockInfo } from '@/hooks/useSubmissionLock';

interface SubmissionLockBannerProps {
  lockInfo: LockInfo;
  onRefresh: () => void;
  onBack: () => void;
}

export function SubmissionLockBanner({ lockInfo, onRefresh, onBack }: SubmissionLockBannerProps) {
  const who = lockInfo.lockedBy || 'library staff';
  const when = lockInfo.lockedAt ? new Date(lockInfo.lockedAt).toLocaleDateString() : null;

  return (
    <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-semibold">This submission is locked for editing</p>
          <p className="text-sm mt-1">
            Locked by {who}
            {when ? ` on ${when}` : ''}.{' '}
            {lockInfo.lockReason || 'You can view it, but changes are disabled while staff are processing it.'}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={onRefresh}>
              Refresh
            </Button>
            <Button size="sm" variant="ghost" onClick={onBack}>
              Back to list
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubmissionLockBanner;

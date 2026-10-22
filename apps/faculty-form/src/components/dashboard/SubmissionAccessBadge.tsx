import { Badge } from '@/components/ui/badge';
import type { Submission } from '@/components/SubmissionCard';

export function SubmissionAccessBadge({ access }: { access: Submission['access'] }) {
  if (access === 'proxy') return <Badge variant="outline">Proxy</Badge>;
  if (access === 'co_instructor') return <Badge variant="outline">Co-instructor</Badge>;
  return null;
}

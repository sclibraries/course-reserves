import { Button } from '@/components/ui/button';

interface DraftConflictNoticeProps {
  visible: boolean;
  onLoadLatest: () => Promise<boolean>;
}

export function DraftConflictNotice({ visible, onLoadLatest }: DraftConflictNoticeProps) {
  if (!visible) return null;

  return (
    <div role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p>This list was changed on another device</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => void onLoadLatest()}>
        Load the latest version
      </Button>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, Copy } from 'lucide-react';
import { useSubmissionEditorContext } from './SubmissionEditorContext';

function formatSaveTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 10) {
    return 'just now';
  } else if (diffSecs < 60) {
    return `${diffSecs}s ago`;
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

export default function Header() {
  const navigate = useNavigate();
  const {
    reserve,
    id,
    isEditingSubmission,
    hasPreviousOffering,
    isReadOnly,
    saveDraft,
    isSaving,
    hasUnsavedChanges,
    lastSaveTime,
    saveError,
    submissionHandlers,
  } = useSubmissionEditorContext();

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">My Course Reserves /</span>
                <span className="font-semibold">
                  {reserve.courseCode} ({reserve.term})
                </span>
                {isEditingSubmission && (
                  <Badge variant="secondary" className="ml-2">
                    Editing Submission
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status="draft" />
            {lastSaveTime && (
              <span className="text-xs text-muted-foreground">
                {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Unsaved changes' : `Saved ${formatSaveTime(lastSaveTime)}`}
              </span>
            )}
            {saveError && (
              <span className="text-xs text-destructive" title={saveError}>
                Save failed
              </span>
            )}
            <Button variant="ghost" onClick={saveDraft} disabled={isSaving || isReadOnly}>
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            {!isEditingSubmission && hasPreviousOffering && (
              <Button
                variant="secondary"
                className="bg-amber-500/90 hover:bg-amber-500 text-white"
                onClick={() => navigate(`/submission/${id}/edit/add?tab=reuse`, { state: { openDuplicateFlow: true } })}
                disabled={isReadOnly}
                title="Submit indicating you're reusing all previous materials"
              >
                <Copy className="mr-2 h-4 w-4" />
                Reuse last time’s list
              </Button>
            )}
            <Button onClick={submissionHandlers.handleSubmit} disabled={isReadOnly}>
              {isEditingSubmission ? 'Update Submission' : 'Submit to Library'}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

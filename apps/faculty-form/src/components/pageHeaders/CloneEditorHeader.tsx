import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import StickyTop from '@/components/StickyTop';

interface CloneEditorHeaderProps {
  originalTerm: string;
  courseCode: string;
  term: string;
  isEditingCourse: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

export const CloneEditorHeader = ({
  originalTerm, courseCode, term, isEditingCourse, onBack, onSaveDraft, onSubmit,
}: CloneEditorHeaderProps) => (
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
                  <span className="text-sm text-muted-foreground">Copying from {originalTerm} →</span>
                  <span className="font-semibold">{courseCode} ({term})</span>
                  <Badge variant="secondary" className="text-xs">Current Term</Badge>
                  {isEditingCourse && <Badge variant="outline" className="text-xs">Editing</Badge>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status="draft" />
              <Button variant="ghost" onClick={onSaveDraft} disabled={isEditingCourse}>Save Draft</Button>
              <Button onClick={onSubmit} disabled={isEditingCourse}>Create Course</Button>
            </div>
          </div>
        </div>
      </header>
    )}
  />
);

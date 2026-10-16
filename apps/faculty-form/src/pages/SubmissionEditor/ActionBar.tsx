import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useSubmissionEditorContext } from './SubmissionEditorContext';

export default function ActionBar() {
  const navigate = useNavigate();
  const { id, reserve, isReadOnly } = useSubmissionEditorContext();
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div data-testid="submission-editor-action-bar" className="bg-background border-b shadow-sm">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 px-4 py-3">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">
              {reserve.items.length === 0
                ? 'Add materials to your course reserve'
                : `${reserve.items.length} item${reserve.items.length !== 1 ? 's' : ''}${reserve.folders.length > 0 ? ` · ${reserve.folders.length} folder${reserve.folders.length !== 1 ? 's' : ''}` : ''}`}
            </span>
            {reserve.items.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowInstructions((value) => !value)} className="h-7 text-xs">
                {showInstructions ? 'Hide Tips' : 'Show Tips'}
              </Button>
            )}
          </div>
          <Button
            onClick={() => navigate(`/submission/${id}/edit/add?tab=search`)}
            disabled={isReadOnly}
            className="bg-blue-600 text-white shadow-md hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />Add materials
          </Button>
        </div>
        {showInstructions && reserve.items.length === 0 && (
          <p className="mt-3 border-t border-blue-200 pt-3 text-xs text-blue-800 dark:text-blue-200">
            Search the library, paste a syllabus list, reuse a past course, or type an item in.
          </p>
        )}
      </div>
    </div>
  );
}

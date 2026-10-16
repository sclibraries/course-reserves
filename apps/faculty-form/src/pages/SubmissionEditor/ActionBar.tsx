import React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Copy, Search, FileText } from 'lucide-react';
import { useSubmissionEditorContext } from './SubmissionEditorContext';

export default function ActionBar() {
  const {
    reserve,
    isEditingSubmission,
    handleOpenCloneDialog,
    setDiscoverySearchOpen,
    setSyllabusUploadOpen,
    itemHandlers,
  } = useSubmissionEditorContext();

  const [showInstructions, setShowInstructions] = React.useState(false);

  return (
    <div data-testid="submission-editor-action-bar" className="bg-background border-b shadow-sm">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 px-4 py-3">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">
              {reserve.items.length === 0
                ? 'Add materials to your course reserve'
                : `${reserve.items.length} item${reserve.items.length !== 1 ? 's' : ''}${
                    reserve.folders.length > 0
                      ? ` · ${reserve.folders.length} folder${reserve.folders.length !== 1 ? 's' : ''}`
                      : ''
                  }`}
            </span>
            {reserve.items.length === 0 && !isEditingSubmission && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInstructions(!showInstructions)}
                className="h-7 text-xs"
              >
                {showInstructions ? 'Hide Tips' : 'Show Tips'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditingSubmission && (
              <Button
                onClick={() => handleOpenCloneDialog('all', false)}
                className="bg-amber-600 hover:bg-amber-700 text-white shadow-md"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy from Previous Course
              </Button>
            )}
            <Button
              onClick={() => setDiscoverySearchOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
            >
              <Search className="mr-2 h-4 w-4" />
              Search Library
            </Button>
            <Button
              onClick={() => setSyllabusUploadOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white shadow-md"
            >
              <FileText className="mr-2 h-4 w-4" />
              Paste Citations
            </Button>
            <Button
              onClick={itemHandlers.handleAddItem}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-md"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Manually
            </Button>
          </div>
        </div>

        {showInstructions && reserve.items.length === 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <Search className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">Search Library</p>
                  <p className="text-blue-700 dark:text-blue-300">Find books, articles, and media in our catalog</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">Paste Citations</p>
                  <p className="text-green-700 dark:text-green-300">Copy reading list from your syllabus</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Copy className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">Copy Previous</p>
                  <p className="text-amber-700 dark:text-amber-300">Reuse materials from prior terms</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

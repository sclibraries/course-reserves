import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Search, Edit, Copy } from "lucide-react";

interface EmptyStateProps {
  hasItems: boolean;
  hasFolders: boolean;
  onAddItem: () => void;
  onCreateFolder: () => void;
  onClearFilters: () => void;
  onSearchLibrary?: () => void;
  onPasteCitations?: () => void;
  onUsePrevious?: () => void;
  hasPreviousCourse?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  hasItems,
  hasFolders,
  onAddItem,
  onClearFilters,
  onSearchLibrary,
  onPasteCitations,
  onUsePrevious,
  hasPreviousCourse = false,
}) => {
  // If filters are active and nothing matches, show filter clear message
  if (hasItems || hasFolders) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">
            No materials match your current filters.
          </p>
          <Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state - show 2x2 grid of large option cards
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-xl font-semibold mb-2">Add Materials to Your Reserve</h3>
        <p className="text-muted-foreground">
          Choose how you'd like to add books, articles, and other materials
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
        {/* Upper Left: Copy from Previous Course */}
        {onUsePrevious && (
          <Card className="cursor-pointer hover:border-amber-500 hover:shadow-lg transition-all hover:scale-105" onClick={onUsePrevious}>
            <CardHeader className="text-center pb-3">
              <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <Copy className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-lg">Copy from Previous Course</CardTitle>
              <CardDescription className="text-xs">
                Reuse materials from a prior term
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Upper Right: Search Library */}
        {onSearchLibrary && (
          <Card className="cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all hover:scale-105" onClick={onSearchLibrary}>
            <CardHeader className="text-center pb-3">
              <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Search className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg">Search Library</CardTitle>
              <CardDescription className="text-xs">
                Find books, articles, and media
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Bottom Left: Paste Citations */}
        {onPasteCitations && (
          <Card className="cursor-pointer hover:border-green-500 hover:shadow-lg transition-all hover:scale-105" onClick={onPasteCitations}>
            <CardHeader className="text-center pb-3">
              <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-lg">Paste Citations</CardTitle>
              <CardDescription className="text-xs">
                Copy from your syllabus
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Bottom Right: Enter Manually */}
        <Card className="cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all hover:scale-105" onClick={onAddItem}>
          <CardHeader className="text-center pb-3">
            <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Edit className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-lg">Enter Manually</CardTitle>
            <CardDescription className="text-xs">
              Fill out form for each item
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

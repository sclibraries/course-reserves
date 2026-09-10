import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, FileText } from "lucide-react";

interface CloneSuggestionBannerProps {
  hasExactMatchCourses: boolean;
  checkingForPreviousCourses: boolean;
  itemsLength: number;
  courseCode: string;
  onViewExact: () => void;
  onBrowseAll: () => void;
  onDismiss: () => void;
}

export const CloneSuggestionBanner: React.FC<CloneSuggestionBannerProps> = ({
  hasExactMatchCourses,
  checkingForPreviousCourses,
  itemsLength,
  courseCode,
  onViewExact,
  onBrowseAll,
  onDismiss,
}) => {
  if (checkingForPreviousCourses) return null;

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Copy className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-blue-900 text-lg mb-1">
                {hasExactMatchCourses ? 'Copy Materials from Previous Terms' : 'Copy from Your Other Courses'}
              </h3>
              <p className="text-blue-700 text-sm">
                {itemsLength > 0 ? (
                  <>
                    You have <strong>{itemsLength} material{itemsLength !== 1 ? 's' : ''}</strong> so far. 
                    You can continue adding from {hasExactMatchCourses ? 'previous versions of this course' : 'your other courses'}.
                  </>
                ) : hasExactMatchCourses ? (
                  <>
                    We found previous versions of <strong>{courseCode}</strong> that you taught. 
                    Copy materials from one or more terms to build your list.
                  </>
                ) : (
                  <>
                    We didn't find previous versions of <strong>{courseCode}</strong>, but you can 
                    search all your courses and copy relevant materials.
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasExactMatchCourses ? (
                <>
                  <Button 
                    onClick={onViewExact}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    View {courseCode} Resources
                  </Button>
                  <Button 
                    onClick={onBrowseAll}
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Browse All My Courses
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={onBrowseAll}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Browse All My Courses
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={onDismiss}
                className="border-blue-300 hover:bg-blue-100"
              >
                {itemsLength > 0 ? 'Dismiss' : 'Start Fresh Instead'}
              </Button>
            </div>
            <p className="text-xs text-blue-600">
              💡 Tip: You can copy from multiple courses! Add materials from different terms or related courses, then edit as needed.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

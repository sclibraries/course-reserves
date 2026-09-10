import React, { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText } from "lucide-react";
import { useCourseCloning, type PreviewResource, type PreviousCourse } from "@/hooks/useCourseCloning";
import { CourseListView } from "./CloneDialog/CourseListView";
import { ResourcePreviewView } from "./CloneDialog/ResourcePreviewView";

// Term Selection View Component
interface TermSelectionViewProps {
  availableTerms: PreviousCourse[];
  onSelectTerm: (course: PreviousCourse) => void;
  onBack: () => void;
}

const TermSelectionView: React.FC<TermSelectionViewProps> = ({
  availableTerms,
  onSelectTerm,
  onBack,
}) => {
  return (
    <div className="space-y-4 py-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>Select a term:</strong> Choose which term's resources you want to load. 
          Each term may have different materials.
        </p>
      </div>

      <div className="space-y-3">
        {availableTerms.map((course) => (
          <Card key={course.courseListingId} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-base font-semibold">
                    {course.term}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>
                      {course.resourceCount > 0 ? (
                        <span>
                          <span className="text-blue-600 font-medium">
                            {course.resourceCount} resource{course.resourceCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs ml-1">
                            ({course.electronicCount} electronic, {course.physicalCount} physical)
                          </span>
                        </span>
                      ) : (
                        <span>No resources found</span>
                      )}
                    </span>
                  </div>
                  <div className="text-xs">
                    Course: {course.courseNumber} - {course.courseName}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => onSelectTerm(course)}
                className="ml-4"
              >
                View Resources
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface CloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reserveId: string;
  courseCode: string;
  userName: string;
  currentItemsCount: number;
  onAddResource: (resource: PreviewResource) => void;
  initialMode?: 'exact' | 'all';
  directToResources?: boolean;
}

export const CloneDialog: React.FC<CloneDialogProps> = ({
  open,
  onOpenChange,
  reserveId,
  courseCode,
  userName,
  currentItemsCount,
  onAddResource,
  initialMode = 'exact',
  directToResources = false,
}) => {
  const [viewMode, setViewMode] = useState<'exact' | 'all'>(initialMode);
  const [dialogView, setDialogView] = useState<'courses' | 'resources' | 'term-selection'>('courses');
  const [previewCourse, setPreviewCourse] = useState<PreviousCourse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewResources, setPreviewResources] = useState<PreviewResource[]>([]);
  const [availableTerms, setAvailableTerms] = useState<PreviousCourse[]>([]);
  
  const { 
    loadingPreviousCourses,
    hasLoadedPreviousCourses,
    loadingOtherCourses,
    previousCourses,
    cloningFromCourse,
    fetchCourseResources,
    fetchPreviousCourses
  } = useCourseCloning();

    // Fetch courses when dialog opens or mode changes
  React.useEffect(() => {
    if (open && userName && courseCode) {
      fetchPreviousCourses(courseCode, userName, viewMode);
    }
  }, [open, courseCode, userName, viewMode, fetchPreviousCourses]);

  const handlePreviewCourse = React.useCallback(async (course: PreviousCourse) => {
    setPreviewCourse(course);
    setDialogView('resources');
    setLoadingPreview(true);
    
    try {
      const { physicalReserves, electronicResources } = await fetchCourseResources(course.courseListingId);
      
      const resources: PreviewResource[] = [];
      
      // Helper function to create discovery URL for physical items
      const createDiscoveryUrl = (instanceId: string) => {
        // Convert instanceId from UUID format (with dashes) to dot format
        const dotFormattedId = instanceId.replace(/-/g, '.');
        const dbid = 'cat09206a'; // Default database ID for Five Colleges
        return `https://openurl.ebsco.com/c/4e4lys/openurl?sid=ebsco:plink&id=ebsco:${dbid}:scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.${dotFormattedId}&crl=f&prompt=none`;
      };
      
      // Process physical reserves
      physicalReserves.forEach((reserve) => {
        const item = reserve.copiedItem || reserve.item;
        if (item) {
          const primaryAuthor = item.contributors?.find((c) => c.primary)?.name || 
                               item.contributors?.[0]?.name || '';
          const pubInfo = item.publication?.[0];
          
          let callNumber = '';
          if ('callNumber' in item && item.callNumber) {
            callNumber = item.callNumber;
          } else if ('effectiveCallNumberComponents' in item && item.effectiveCallNumberComponents?.callNumber) {
            callNumber = item.effectiveCallNumberComponents.callNumber;
          }
          
          const barcode = reserve.barcode || item.barcode || '';
          const copy = 'copy' in item ? item.copy || '' : '';
          const instanceId = 'instanceId' in item && typeof item.instanceId === 'string' ? item.instanceId : '';
          
          // Create notes with all relevant information
          const notesParts = [];
          if (callNumber) notesParts.push(`Call Number: ${callNumber}`);
          if (barcode) notesParts.push(`Barcode: ${barcode}`);
          if (copy) notesParts.push(`Copy: ${copy}`);
          
          resources.push({
            type: 'physical',
            title: item.title || 'Untitled Item',
            author: primaryAuthor,
            materialType: 'Physical Resource',
            publicationInfo: pubInfo?.publisher && pubInfo?.dateOfPublication ? 
              `${pubInfo.publisher}, ${pubInfo.dateOfPublication}` : 
              pubInfo?.publisher || undefined,
            callNumber: callNumber || undefined,
            notes: notesParts.join(' | ') || undefined,
            discoveryUrl: instanceId ? createDiscoveryUrl(instanceId) : undefined,
            order: 999999, // Physical items don't have order from merged resources
            _originalReserve: reserve
          });
        }
      });
      
      // Process electronic resources
      electronicResources.forEach((resource) => {
        let materialType = 'other';
        const url = resource.url || resource.item_url || '';
        
        if (url) {
          if (url.includes('youtube') || url.includes('video')) {
            materialType = 'video';
          } else if (url.includes('ebsco') || url.includes('journal')) {
            materialType = 'article';
          } else {
            materialType = 'website';
          }
        }
        
        resources.push({
          type: 'electronic',
          title: resource.title || 'Untitled Resource',
          materialType,
          url: url || undefined,
          description: resource.description || undefined,
          notes: [
            resource.external_note,
            resource.internal_note,
            resource.folder_name ? `Folder: ${resource.folder_name}` : null
          ].filter(Boolean).join(' | ') || undefined,
          order: typeof resource.order === 'number' ? resource.order : 
                 (resource.order ? parseInt(resource.order as string, 10) : 999999),
          _originalResource: resource
        });
      });
      
      // Sort by order field (lower numbers first)
      resources.sort((a, b) => (a.order || 999999) - (b.order || 999999));
      
      setPreviewResources(resources);
      
    } catch (error) {
      console.error('Failed to preview course:', error);
      setPreviewResources([]);
    } finally {
      setLoadingPreview(false);
    }
  }, [fetchCourseResources]);

  // When user wants to view all exact match resources, check if we need term selection
  const handleViewAllExactMatches = React.useCallback(async () => {
    const exactMatches = previousCourses.filter(c => c.isExactMatch);
    
    if (exactMatches.length === 0) {
      toast.error('No exact match courses found');
      return;
    }
    
    // If only one exact match, load it directly
    if (exactMatches.length === 1) {
      handlePreviewCourse(exactMatches[0]);
      return;
    }
    
    // Multiple exact matches - show term selection
    setAvailableTerms(exactMatches);
    setDialogView('term-selection');
  }, [previousCourses, handlePreviewCourse]);

  // Handle direct to resources mode
  React.useEffect(() => {
    if (open && directToResources && viewMode === 'exact' && previousCourses.length > 0) {
      handleViewAllExactMatches();
    }
  }, [open, directToResources, viewMode, previousCourses, handleViewAllExactMatches]);

  // Reset view when mode changes
  React.useEffect(() => {
    setViewMode(initialMode);
    if (directToResources) {
      // Will be handled by handleViewAllExactMatches effect
      setDialogView('courses'); // Start at courses, will navigate to term-selection or resources
    } else {
      setDialogView('courses');
    }
    setAvailableTerms([]);
  }, [initialMode, directToResources]);

  const handleAddAllResources = () => {
    previewResources.forEach(resource => onAddResource(resource));
    toast.success(`Added all ${previewResources.length} resources`);
  };

  const handleBackToCourses = () => {
    setDialogView('courses');
    setAvailableTerms([]);
  };

  const handleSelectTerm = (course: PreviousCourse) => {
    handlePreviewCourse(course);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dialogView === 'term-selection'
              ? `Select Term for ${courseCode}`
              : dialogView === 'resources' 
                ? `${previewCourse ? previewCourse.courseName : 'Resources'} - Resources`
                : currentItemsCount > 0 
                  ? `Add More Materials (${currentItemsCount} current)` 
                  : 'Copy Materials from Previous Courses'}
          </DialogTitle>
          <DialogDescription>
            {dialogView === 'term-selection' ? (
              <div className="space-y-1">
                <p>Multiple terms found for {courseCode}. Select which term to load resources from:</p>
                <button
                  onClick={handleBackToCourses}
                  className="text-xs hover:underline"
                >
                  ← Back to all courses
                </button>
              </div>
            ) : dialogView === 'resources' ? (
              previewCourse && (
                <div className="space-y-1">
                  <button
                    onClick={handleBackToCourses}
                    className="text-xs hover:underline"
                  >
                    ← Back to courses
                  </button>
                </div>
              )
            ) : (
              <>
                {currentItemsCount > 0 ? (
                  <>Select additional courses to copy materials from. Materials will be added to your current {currentItemsCount} item{currentItemsCount !== 1 ? 's' : ''}.</>
                ) : (
                  <>Select a course to copy materials from. Exact matches for {courseCode} are shown first.</>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto px-1">
          {dialogView === 'term-selection' ? (
            <TermSelectionView
              availableTerms={availableTerms}
              onSelectTerm={handleSelectTerm}
              onBack={handleBackToCourses}
            />
          ) : dialogView === 'resources' ? (
            <ResourcePreviewView
              loadingPreview={loadingPreview}
              previewResources={previewResources}
              onAddResource={onAddResource}
              onAddAllResources={handleAddAllResources}
            />
          ) : (
            <CourseListView
              loadingPreviousCourses={loadingPreviousCourses}
              hasLoadedPreviousCourses={hasLoadedPreviousCourses}
              loadingOtherCourses={loadingOtherCourses}
              previousCourses={previousCourses}
              cloningFromCourse={cloningFromCourse}
              userName={userName}
              currentItemsCount={currentItemsCount}
              courseCode={courseCode}
              onPreviewCourse={handlePreviewCourse}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

import { Book, Copy, Download, Eye, FileText, Link } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { CourseResource, DisplayCourse } from '@/pages/clonePrevious/types';
import type { Course } from '@/store/courseSearchStore';

interface CoursePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCourse: Course | null;
  selectedCourseDisplay: DisplayCourse | null;
  loadingResources: boolean;
  resources: CourseResource[];
  cloningCourse: string | null;
  onCloneCourse: (course: Course) => void;
}

const getResourceIcon = (type: CourseResource['type']) => {
  switch (type) {
    case 'book': return <Book className="h-4 w-4" />;
    case 'article': return <FileText className="h-4 w-4" />;
    case 'link': return <Link className="h-4 w-4" />;
    case 'file': return <Download className="h-4 w-4" />;
    case 'video': return <Eye className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

const getResourceTypeLabel = (type: CourseResource['type']) => {
  switch (type) {
    case 'book': return 'Book';
    case 'article': return 'Article';
    case 'link': return 'Link';
    case 'file': return 'File';
    case 'video': return 'Video';
    default: return 'Resource';
  }
};

export const CoursePreviewDialog = ({
  open,
  onOpenChange,
  selectedCourse,
  selectedCourseDisplay,
  loadingResources,
  resources,
  cloningCourse,
  onCloneCourse,
}: CoursePreviewDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl max-h-[80vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Book className="h-5 w-5" />
          Course Resources Preview
          {selectedCourseDisplay && (
            <Badge variant="outline" className="ml-2">
              {selectedCourseDisplay.courseNumber} - {selectedCourseDisplay.courseTitle}
            </Badge>
          )}
        </DialogTitle>
      </DialogHeader>

      <ScrollArea className="max-h-[60vh]">
        {loadingResources ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
            <p className="text-center">
              Loading course resources...
              <br />
              <span className="text-sm text-muted-foreground mt-1">
                Fetching physical reserves from FOLIO and electronic resources from course database
              </span>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {resources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <p>No resources found for this course.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {resources.length} resource{resources.length !== 1 ? 's' : ''} found
                  </p>
                  <Badge variant="secondary" className="text-xs">Preview Mode</Badge>
                </div>
                <div className="space-y-3">
                  {resources.map((resource, index) => (
                    <Card key={resource.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">{getResourceIcon(resource.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm leading-tight">{resource.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {getResourceTypeLabel(resource.type)}
                                </Badge>
                                <Badge
                                  variant={resource.status === 'active' ? 'default' : resource.status === 'pending' ? 'secondary' : 'destructive'}
                                  className="text-xs"
                                >
                                  {resource.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          {resource.author && (
                            <p className="text-xs text-muted-foreground mt-2">
                              <strong>Author:</strong> {resource.author}
                            </p>
                          )}
                          {resource.publicationInfo && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Publication:</strong> {resource.publicationInfo}
                            </p>
                          )}
                          {resource.url && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>URL:</strong>
                              <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                                {resource.url}
                              </a>
                            </p>
                          )}
                          {resource.notes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Notes:</strong> {resource.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      {index < resources.length - 1 && <Separator className="mt-3" />}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          Preview the resources above, then clone if they match your needs.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {selectedCourse && (
            <Button onClick={() => onCloneCourse(selectedCourse)} disabled={cloningCourse === selectedCourse.id}>
              {cloningCourse === selectedCourse.id ? (
                <><span className="animate-spin rounded-full h-4 w-4 border-b border-current mr-2" />Cloning Course...</>
              ) : <><Copy className="h-4 w-4 mr-2" />Clone This Course</>}
            </Button>
          )}
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

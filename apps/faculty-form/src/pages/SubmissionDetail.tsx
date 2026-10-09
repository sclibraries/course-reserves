import { useState, useEffect, Fragment } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { useCourseReservesStore } from "../store/courseReservesStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Folder, Pencil, Trash2, Lock } from "lucide-react";
import CommunicationsContainer from "@/components/Communications/CommunicationsContainer";
import ItemMessageDialog from "@/components/Communications/ItemMessageDialog";
import { CommunicationsAPI, CreateMessageRequest, Message } from "@/services/api/communications";
import { toast } from "sonner";

const SubmissionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const { getReserveById, getReserveStats, fetchSubmissionDetails, deleteSubmission } = useCourseReservesStore();
  const reserve = getReserveById(id!);
  const stats = getReserveStats(id!);
  
  const api = new CommunicationsAPI();

  // Helper function to get message count for a specific item
  const getItemMessageCount = (resourceId: number) => {
    return messages.filter(msg => msg.resource_id === resourceId).length;
  };

  // Helper function to get unread message count for a specific item
  const getItemUnreadCount = (resourceId: number) => {
    return messages.filter(msg => msg.resource_id === resourceId && !msg.is_read).length;
  };

  // Build organized content structure respecting display_order
  // This creates a unified list of folders and unfoldered items in proper order
  const getOrganizedContent = () => {
    if (!reserve) return [];
    
    type ContentItem = 
      | { type: 'folder'; folder: typeof reserve.folders[0]; order: number }
      | { type: 'item'; item: typeof reserve.items[0]; order: number };
    
    const content: ContentItem[] = [];
    
    // Add folders with their display_order (already sorted in store)
    reserve.folders.forEach(folder => {
      content.push({
        type: 'folder',
        folder: folder,
        order: folder.position || 0
      });
    });
    
    // Add unfoldered items with their display_order (already sorted in store)
    const unfolderedItems = reserve.items.filter(item => !item.folderId);
    unfolderedItems.forEach(item => {
      content.push({
        type: 'item',
        item: item,
        order: item.displayOrder || 0
      });
    });
    
    // Sort by display order to interleave folders and items correctly
    return content.sort((a, b) => a.order - b.order);
  };

  // Load messages with smart caching to update badge counts
  const loadMessages = async () => {
    if (!id) return;
    
    try {
      const data = await api.getMessages(id);
      
      // Only update if messages changed
      const hasChanged = JSON.stringify(messages) !== JSON.stringify(data);
      if (hasChanged) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  // Handler for sending messages about specific items
  const handleItemMessage = async (data: CreateMessageRequest) => {
    if (!id) return;
    
    try {
      await api.createMessage(id, data);
      toast.success('Message sent to library staff');
      // Refresh messages to update badge counts
      loadMessages();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      toast.error(errorMessage);
      throw err; // Re-throw so dialog knows it failed
    }
  };

  // Handler for deleting submission
  const handleDeleteSubmission = async () => {
    if (!id || !reserve) return;
    
    setDeleting(true);
    try {
      await deleteSubmission(id);
      toast.success('Submission deleted successfully');
      navigate('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete submission';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Handler for editing submission
  const handleEditSubmission = () => {
    if (!id) return;
    navigate(`/submission/${id}/edit`);
  };

  // Determine if course can be edited/deleted
  // Prefer backend's canEdit field if available, fallback to client-side logic
  const canEdit = reserve 
    ? (reserve.canEdit !== undefined ? reserve.canEdit : (!reserve.isLocked && reserve.status === 'submitted'))
    : false;

  // Fetch submission details on mount (handles both new loads and refreshes)
  useEffect(() => {
    const loadDetails = async (silent = false) => {
      if (!id) return;
      
      // Check if we need to force refresh from backend (e.g., after fresh submission)
      const shouldRefresh = searchParams.get('refresh') === 'true';
      
      // Only show loading spinner on initial load
      if (!silent) {
        setLoadingDetails(true);
      }
      
      // Always fetch if:
      // 1. Reserve doesn't exist or has no items
      // 2. Doing silent refresh (polling)
      // 3. Refresh param is present (fresh submission)
      if (!reserve || reserve.items.length === 0 || silent || shouldRefresh) {
        const result = await fetchSubmissionDetails(id, silent);
        if (!result && !silent) {
          setNotFound(true);
        }
        
        // Clear the refresh param after fetching
        if (shouldRefresh) {
          searchParams.delete('refresh');
          setSearchParams(searchParams, { replace: true });
        }
      }
      
      if (!silent) {
        setLoadingDetails(false);
      }
    };
    
    // Initial load with loading indicator
    loadDetails(false);
    loadMessages(); // Load messages on mount
    
    // Poll for item updates every 30 seconds (silent updates to catch status changes)
    const itemsInterval = setInterval(() => {
      loadDetails(true);
    }, 30000);
    
    // Poll for messages every 30 seconds to update badge counts
    const messagesInterval = setInterval(() => {
      loadMessages();
    }, 30000);
    
    return () => {
      clearInterval(itemsInterval);
      clearInterval(messagesInterval);
    };
    // We intentionally omit 'reserve' from deps to only run on mount or when ID changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, fetchSubmissionDetails, searchParams, setSearchParams]);

  // Show loading state while fetching
  if (loadingDetails && !reserve) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading submission details...</p>
        </div>
      </div>
    );
  }

  // Show not found if we tried to fetch and it failed
  if (notFound || !reserve) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Course Reserve Not Found</h1>
          <p className="text-muted-foreground mb-4">The submission you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => navigate("/")}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  const progressPercent = stats.totalItems > 0 ? (stats.completeItems / stats.totalItems) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">My Course Reserves /</span>
                  <span className="font-semibold">{reserve.courseCode} ({reserve.term})</span>
                  {reserve.isLocked && (
                    <Badge 
                      variant="secondary" 
                      className="flex items-center gap-1"
                      title={`Locked by ${reserve.lockedBy || 'staff'}${reserve.lockedAt ? ` on ${new Date(reserve.lockedAt).toLocaleDateString()}` : ''}${reserve.lockReason ? `. Reason: ${reserve.lockReason}` : ''}`}
                    >
                      <Lock className="h-3 w-3" />
                      {reserve.lockedBy ? `Locked by ${reserve.lockedBy}` : 'Locked by Staff'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={reserve.status === 'in-progress' ? 'partial' : reserve.status === 'submitted' ? 'submitted' : reserve.status === 'complete' ? 'complete' : 'draft'} />
              {canEdit && (
                <>
                  <Button variant="outline" onClick={handleEditSubmission}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Submission
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary Bar */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">{reserve.courseCode} · {reserve.courseTitle}</h2>
                <Badge variant="secondary">{reserve.term}</Badge>
              </div>
              <StatusBadge status={reserve.status === 'in-progress' ? 'partial' : reserve.status === 'submitted' ? 'submitted' : reserve.status === 'complete' ? 'complete' : 'draft'} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Item Progress</span>
                <span className="font-medium">
                  {stats.completeItems}/{stats.totalItems} complete
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>


          </CardContent>
        </Card>

        {/* Items Table */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Requested Items</h3>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">
                      <div className="flex items-center gap-1">
                        #
                        <span className="text-xs text-muted-foreground" title="Order can be changed in edit mode">
                          (Order)
                        </span>
                      </div>
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Material Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Needed By</TableHead>
                    <TableHead className="text-center">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reserve.items.length > 0 || reserve.folders.length > 0 ? (
                    <>
                      {getOrganizedContent().map((content, globalIndex) => {
                        if (content.type === 'folder') {
                          // Render folder header and its items
                          const folder = content.folder;
                          return (
                            <Fragment key={folder.id}>
                              {/* Folder header row */}
                              <TableRow className="bg-blue-50 dark:bg-blue-950 border-t-2 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900">
                                <TableCell className="font-semibold text-blue-900 dark:text-blue-100">
                                  {globalIndex + 1}
                                </TableCell>
                                <TableCell colSpan={5} className="font-semibold py-3">
                                  <div className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                                    <Folder className="h-5 w-5 fill-blue-200 dark:fill-blue-800" />
                                    <span className="text-base">{folder.title}</span>
                                    <Badge variant="secondary" className="bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100 border-blue-300 dark:border-blue-700">
                                      {folder.items.length} {folder.items.length === 1 ? 'item' : 'items'}
                                    </Badge>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {/* Items in this folder (already sorted by display_order in store) */}
                              {folder.items.map((item, itemIndex) => {
                                const resourceId = parseInt(item.id.replace('material-', ''));
                                const totalCount = getItemMessageCount(resourceId);
                                const unreadCount = getItemUnreadCount(resourceId);
                                
                                return (
                                  <TableRow key={item.id} className="hover:bg-muted/50 bg-blue-50/30 dark:bg-blue-950/30 border-l-4 border-l-blue-300 dark:border-l-blue-700">
                                    <TableCell className="font-medium pl-8 text-muted-foreground text-sm">
                                      {globalIndex + 1}.{itemIndex + 1}
                                    </TableCell>
                                    <TableCell className="font-medium">{item.title}</TableCell>
                                    <TableCell className="capitalize">{item.materialType}</TableCell>
                                    <TableCell>
                                      <StatusBadge 
                                        status={item.status === 'in-progress' ? 'partial' : item.status === 'needs-review' ? 'in-review' : item.status === 'complete' ? 'complete' : 'draft'} 
                                        className="text-xs"
                                      />
                                    </TableCell>
                                    <TableCell>-</TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <ItemMessageDialog
                                          itemTitle={item.title}
                                          itemId={item.id}
                                          resourceId={resourceId}
                                          onSubmit={handleItemMessage}
                                        />
                                        {totalCount > 0 && (
                                          <Badge 
                                            variant={unreadCount > 0 ? "default" : "secondary"}
                                            className="text-xs"
                                          >
                                            {unreadCount > 0 ? `${unreadCount} new` : totalCount}
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </Fragment>
                          );
                        } else {
                          // Render standalone item (not in folder)
                          const item = content.item;
                          const resourceId = parseInt(item.id.replace('material-', ''));
                          const totalCount = getItemMessageCount(resourceId);
                          const unreadCount = getItemUnreadCount(resourceId);
                          
                          return (
                            <TableRow key={item.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium">{globalIndex + 1}</TableCell>
                              <TableCell className="font-medium">{item.title}</TableCell>
                              <TableCell className="capitalize">{item.materialType}</TableCell>
                              <TableCell>
                                <StatusBadge 
                                  status={item.status === 'in-progress' ? 'partial' : item.status === 'needs-review' ? 'in-review' : item.status === 'complete' ? 'complete' : 'draft'} 
                                  className="text-xs"
                                />
                              </TableCell>
                              <TableCell>-</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <ItemMessageDialog
                                    itemTitle={item.title}
                                    itemId={item.id}
                                    resourceId={resourceId}
                                    onSubmit={handleItemMessage}
                                  />
                                  {totalCount > 0 && (
                                    <Badge 
                                      variant={unreadCount > 0 ? "default" : "secondary"}
                                      className="text-xs"
                                    >
                                      {unreadCount > 0 ? `${unreadCount} new` : totalCount}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                      })}
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No materials added yet. <Button variant="link" onClick={() => navigate(`/submission/${reserve.id}/edit`)}>Add materials</Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Communications Section */}
        <Card>
          <CardContent className="pt-6">
            <CommunicationsContainer submissionUuid={id!} />
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Are you sure you want to delete this submission for <strong>{reserve.courseCode} · {reserve.term}</strong>?
              </p>
              <p className="text-red-600">
                This action cannot be undone. All {reserve.items.length} items and {reserve.folders.length} folders will be permanently deleted.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmission}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Submission'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SubmissionDetail;

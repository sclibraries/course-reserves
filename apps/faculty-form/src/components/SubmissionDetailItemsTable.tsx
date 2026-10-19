import { Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { Folder } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import ItemMessageDialog from '@/components/Communications/ItemMessageDialog';
import type { CreateMessageRequest } from '@/services/api/communications';
import type { CourseItem, CourseReserve } from '@/store/courseReservesStore';
import { getLayoutState } from '@/store/reserve/layoutState';

interface SubmissionDetailItemsTableProps {
  reserve: CourseReserve;
  onItemMessage: (data: CreateMessageRequest) => Promise<void>;
  getItemMessageCount: (resourceId: number) => number;
  getItemUnreadCount: (resourceId: number) => number;
  onAddMaterials: () => void;
}

export function SubmissionDetailItemsTable({
  reserve,
  onItemMessage,
  getItemMessageCount,
  getItemUnreadCount,
  onAddMaterials,
}: SubmissionDetailItemsTableProps) {
  const state = getLayoutState(reserve);
  const itemsById = new Map(state.items.map((item) => [item.id, item]));
  const foldersById = new Map(state.folders.map((folder) => [
    folder.id,
    { ...folder, items: folder.itemIds.map((id) => itemsById.get(id)).filter((item): item is CourseItem => !!item) },
  ]));

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">Requested Items</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"># <span className="text-xs text-muted-foreground">(Order)</span></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Material Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Needed By</TableHead>
                <TableHead className="text-center">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.layout.length > 0 ? state.layout.map((entry, globalIndex) => {
                if (entry.kind === 'folder') {
                  const folder = foldersById.get(entry.id);
                  if (!folder) return null;
                  return (
                    <Fragment key={folder.id}>
                      <TableRow className="bg-blue-50 dark:bg-blue-950 border-t-2 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900">
                        <TableCell className="font-semibold text-blue-900 dark:text-blue-100">{globalIndex + 1}</TableCell>
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
                      {folder.items.map((item, itemIndex) => renderItemRow(
                        item, `${globalIndex + 1}.${itemIndex + 1}`, 'hover:bg-muted/50 bg-blue-50/30 dark:bg-blue-950/30 border-l-4 border-l-blue-300 dark:border-l-blue-700',
                        onItemMessage, getItemMessageCount, getItemUnreadCount, true
                      ))}
                    </Fragment>
                  );
                }
                const item = itemsById.get(entry.id);
                return item ? renderItemRow(
                  item, String(globalIndex + 1), 'hover:bg-muted/50',
                  onItemMessage, getItemMessageCount, getItemUnreadCount, false
                ) : null;
              }) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No materials added yet. <Button variant="link" onClick={onAddMaterials}>Add materials</Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function renderItemRow(
  item: CourseItem,
  order: string,
  className: string,
  onItemMessage: SubmissionDetailItemsTableProps['onItemMessage'],
  getItemMessageCount: SubmissionDetailItemsTableProps['getItemMessageCount'],
  getItemUnreadCount: SubmissionDetailItemsTableProps['getItemUnreadCount'],
  inFolder: boolean
) {
  const resourceId = parseInt(item.id.replace('material-', ''), 10);
  const totalCount = getItemMessageCount(resourceId);
  const unreadCount = getItemUnreadCount(resourceId);
  return (
    <TableRow key={item.id} className={className}>
      <TableCell className={`font-medium ${inFolder ? 'pl-8 text-muted-foreground text-sm' : ''}`}>{order}</TableCell>
      <TableCell className="font-medium">{item.title}</TableCell>
      <TableCell className="capitalize">{item.materialType}</TableCell>
      <TableCell>
        <StatusBadge status={item.status === 'in-progress' ? 'partial' : item.status === 'needs-review' ? 'in-review' : item.status === 'complete' ? 'complete' : 'draft'} className="text-xs" />
      </TableCell>
      <TableCell>-</TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <ItemMessageDialog itemTitle={item.title} itemId={item.id} resourceId={resourceId} onSubmit={onItemMessage} />
          {totalCount > 0 && <Badge variant={unreadCount > 0 ? 'default' : 'secondary'} className="text-xs">{unreadCount > 0 ? `${unreadCount} new` : totalCount}</Badge>}
        </div>
      </TableCell>
    </TableRow>
  );
}

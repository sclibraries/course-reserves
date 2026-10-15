import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';

export const TableLoadingSkeleton = () => (
  <div className="border rounded-lg">
    <Table>
      <TableHeader><TableRow>
        {['Course', 'Section', 'Term', 'Status', 'Items', 'Last Updated', 'Actions'].map((heading) => (
          <TableHead key={heading}>{heading}</TableHead>
        ))}
      </TableRow></TableHeader>
      <TableBody>
        {[1, 2, 3, 4, 5].map((row) => (
          <TableRow key={row}>
            {['h-4 w-40', 'h-4 w-12', 'h-4 w-24', 'h-5 w-20', 'h-4 w-16', 'h-4 w-32', 'h-8 w-20 ml-auto'].map((width, column) => (
              <TableCell key={column}><Skeleton className={width} /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export const EmptyState = ({ termName, termsLoading }: { termName: string; termsLoading: boolean }) => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4"><FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" /></div>
      {termsLoading ? <Skeleton className="h-6 w-64 mb-2" /> : <h3 className="text-lg font-semibold mb-2">No Courses for {termName}</h3>}
      <p className="text-sm text-muted-foreground max-w-md">
        Your teaching assignments will appear here when they become available.
        Course reserves can be submitted once courses are assigned.
      </p>
    </CardContent>
  </Card>
);

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface ListSearchToolbarProps {
  totalItems: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const ListSearchToolbar = ({ totalItems, searchQuery, onSearchChange }: ListSearchToolbarProps) => (
  <div className="bg-card border rounded-lg p-4">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">Course Materials</h3>
        <Badge variant="secondary">{totalItems} items</Badge>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Search materials"
          placeholder="Search materials..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9 w-64"
        />
      </div>
    </div>
  </div>
);

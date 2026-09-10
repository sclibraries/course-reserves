import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface Props {
  filter: {
    priority?: string;
    status?: string;
    category?: string;
  };
  onFilterChange: (filter: { priority?: string; status?: string; category?: string }) => void;
}

export default function MessageFilters({ filter, onFilterChange }: Props) {
  const hasActiveFilters = filter.priority || filter.status || filter.category;

  return (
    <div className="bg-muted/50 rounded-lg p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Filters:</Label>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="priority-filter" className="text-sm">Priority:</Label>
          <Select
            value={filter.priority || 'all'}
            onValueChange={(value) => 
              onFilterChange({ 
                ...filter, 
                priority: value === 'all' ? undefined : value 
              })
            }
          >
            <SelectTrigger id="priority-filter" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter" className="text-sm">Status:</Label>
          <Select
            value={filter.status || 'all'}
            onValueChange={(value) => 
              onFilterChange({ 
                ...filter, 
                status: value === 'all' ? undefined : value 
              })
            }
          >
            <SelectTrigger id="status-filter" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="category-filter" className="text-sm">Category:</Label>
          <Select
            value={filter.category || 'all'}
            onValueChange={(value) => 
              onFilterChange({ 
                ...filter, 
                category: value === 'all' ? undefined : value 
              })
            }
          >
            <SelectTrigger id="category-filter" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="question">Question</SelectItem>
              <SelectItem value="issue">Issue</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="note">Note</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button 
            variant="ghost"
            size="sm"
            onClick={() => onFilterChange({})}
          >
            <X className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}

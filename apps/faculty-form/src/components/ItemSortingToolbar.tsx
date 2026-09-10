import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpAZ, 
  ArrowDownAZ, 
  Clock, 
  Star,
  BookOpen,
  Search,
  Filter,
  RotateCcw
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SortOption = 
  | 'position' 
  | 'title-asc' 
  | 'title-desc' 
  | 'author-asc' 
  | 'author-desc' 
  | 'material-type'
  | 'status';

export type FilterOption = {
  materialTypes: string[];
  statuses: string[];
};

interface ItemSortingToolbarProps {
  totalItems: number;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: FilterOption;
  onFiltersChange: (filters: FilterOption) => void;
  onResetFilters: () => void;
}

const materialTypes = ['book', 'article', 'chapter', 'video', 'website', 'other'];
const statuses = ['draft', 'in-progress', 'complete', 'needs-review'];


export const ItemSortingToolbar = ({
  totalItems,
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  onResetFilters
}: ItemSortingToolbarProps) => {
  const [filterOpen, setFilterOpen] = useState(false);

  const getSortIcon = () => {
    switch (sortBy) {
      case 'title-asc':
        return <ArrowUpAZ className="h-4 w-4" />;
      case 'title-desc':
        return <ArrowDownAZ className="h-4 w-4" />;

      case 'status':
        return <Clock className="h-4 w-4" />;
      case 'material-type':
        return <BookOpen className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getSortLabel = () => {
    switch (sortBy) {
      case 'position':
        return 'Custom Order';
      case 'title-asc':
        return 'Title A-Z';
      case 'title-desc':
        return 'Title Z-A';
      case 'author-asc':
        return 'Author A-Z';
      case 'author-desc':
        return 'Author Z-A';
      case 'material-type':
        return 'Material Type';
      case 'status':
        return 'Status';

      default:
        return 'Sort by...';
    }
  };

  const activeFiltersCount = 
    filters.materialTypes.length + 
    filters.statuses.length;

  const toggleArrayFilter = (
    array: string[], 
    value: string, 
    key: keyof FilterOption
  ) => {
    const newArray = array.includes(value) 
      ? array.filter(item => item !== value)
      : [...array, value];
    
    onFiltersChange({
      ...filters,
      [key]: newArray
    });
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Course Materials</h3>
          <Badge variant="secondary">{totalItems} items</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search materials..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          {/* Sort dropdown */}
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-48">
              <div className="flex items-center gap-2">
                {getSortIcon()}
                <SelectValue placeholder="Sort by..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="position">
                <div className="flex items-center gap-2">
                  <span>Custom Order</span>
                </div>
              </SelectItem>
              <SelectItem value="title-asc">
                <div className="flex items-center gap-2">
                  <ArrowUpAZ className="h-4 w-4" />
                  <span>Title A-Z</span>
                </div>
              </SelectItem>
              <SelectItem value="title-desc">
                <div className="flex items-center gap-2">
                  <ArrowDownAZ className="h-4 w-4" />
                  <span>Title Z-A</span>
                </div>
              </SelectItem>
              <SelectItem value="author-asc">Author A-Z</SelectItem>
              <SelectItem value="author-desc">Author Z-A</SelectItem>
              <SelectItem value="material-type">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span>Material Type</span>
                </div>
              </SelectItem>
              <SelectItem value="status">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Status</span>
                </div>
              </SelectItem>

            </SelectContent>
          </Select>

          {/* Filters popover */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filters</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResetFilters}
                    className="h-8 gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                </div>

                {/* Material Type Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Material Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {materialTypes.map(type => (
                      <Badge
                        key={type}
                        variant={filters.materialTypes.includes(type) ? "default" : "secondary"}
                        className="cursor-pointer capitalize"
                        onClick={() => toggleArrayFilter(filters.materialTypes, type, 'materialTypes')}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {statuses.map(status => (
                      <Badge
                        key={status}
                        variant={filters.statuses.includes(status) ? "default" : "secondary"}
                        className="cursor-pointer capitalize"
                        onClick={() => toggleArrayFilter(filters.statuses, status, 'statuses')}
                      >
                        {status === 'in-progress' ? 'In Progress' : 
                         status === 'needs-review' ? 'Needs Review' : 
                         status}
                      </Badge>
                    ))}
                  </div>
                </div>


              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Active filters display */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          <div className="flex flex-wrap gap-1">
            {filters.materialTypes.map(type => (
              <Badge key={`type-${type}`} variant="outline" className="text-xs">
                {type}
              </Badge>
            ))}
            {filters.statuses.map(status => (
              <Badge key={`status-${status}`} variant="outline" className="text-xs">
                {status}
              </Badge>
            ))}

          </div>
        </div>
      )}
    </div>
  );
};
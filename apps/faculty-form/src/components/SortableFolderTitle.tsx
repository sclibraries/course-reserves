import { ChevronDown, ChevronRight, FolderClosed, FolderOpen } from 'lucide-react';
import type { CourseFolder, CourseItem } from '@/store/courseReservesStore';

interface Props {
  folder: CourseFolder & { items: CourseItem[] };
  onToggle: () => void;
}

export function SortableFolderTitle({ folder, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={folder.isOpen}
      className="flex min-w-0 flex-1 basis-full items-center gap-2 rounded p-1 -m-1 text-left hover:bg-muted/50 sm:basis-0"
    >
      {folder.isOpen ? (
        <>
          <ChevronDown className="h-4 w-4 shrink-0 text-blue-600" />
          <FolderOpen className="h-5 w-5 shrink-0 text-blue-600" />
        </>
      ) : (
        <>
          <ChevronRight className="h-4 w-4 shrink-0 text-blue-600" />
          <FolderClosed className="h-5 w-5 shrink-0 text-blue-600" />
        </>
      )}
      <span className="min-w-0 flex-1 break-words whitespace-normal font-medium text-sm">
        {folder.title} ({folder.items.length} items)
      </span>
    </button>
  );
}

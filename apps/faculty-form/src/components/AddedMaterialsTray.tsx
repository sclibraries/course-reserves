import { useState } from 'react';
import { ChevronDown, ChevronUp, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AddedMaterialVisitItem } from '@/store/addedMaterialsVisitStore';

interface AddedMaterialsTrayProps {
  items: AddedMaterialVisitItem[];
  onUndo: (itemId: string) => void;
  onDone: () => void;
}

export default function AddedMaterialsTray({ items, onUndo, onDone }: AddedMaterialsTrayProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className="sticky bottom-0 z-40 border-t bg-background/95 shadow-lg backdrop-blur" aria-label="Added materials">
      {expanded && (
        <div className="container mx-auto max-h-56 overflow-y-auto px-4 py-3" role="region" aria-label="Materials added this visit">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No materials added yet.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{item.title}</span>
                  <Button variant="ghost" size="sm" onClick={() => onUndo(item.id)}>
                    <Undo2 className="mr-1 h-3.5 w-3.5" />Undo
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
        <Button variant="ghost" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronUp className="mr-2 h-4 w-4" />}
          <span>Added ({items.length})</span>
          <span className="sr-only">Review added items</span>
        </Button>
        <Button onClick={onDone}>Done — back to my list</Button>
      </div>
    </aside>
  );
}

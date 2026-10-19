import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SkippedCitationBlock } from './pasteCitationTypes';

export default function PasteSkippedNotice({
  skipped,
  onAddToList,
}: {
  skipped: SkippedCitationBlock[];
  onAddToList: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (!skipped.length) return null;

  const count = skipped.length;
  const message = count === 1
    ? "1 line wasn't recognised as a citation."
    : `${count} lines weren't recognised as citations.`;

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      <span role="status">{message}</span>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0"
        aria-expanded={isOpen}
        aria-controls="skipped-citation-list"
        onClick={() => setIsOpen((open) => !open)}
      >
        Review it
      </Button>
      {isOpen && (
        <ul id="skipped-citation-list" className="basis-full space-y-2 pt-1">
          {skipped.map((block) => (
            <li key={block.id} data-skipped-citation className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background p-2">
              <span className="whitespace-pre-wrap break-words">{block.text}</span>
              <Button variant="outline" size="sm" onClick={() => onAddToList(block.id)}>
                Add to the list
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

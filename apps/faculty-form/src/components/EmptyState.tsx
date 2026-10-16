import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, FileText, Search } from 'lucide-react';

interface EmptyStateProps {
  hasItems: boolean;
  hasFolders: boolean;
  onAddItem: () => void;
  onCreateFolder: () => void;
  onClearFilters: () => void;
  onSearchLibrary?: () => void;
  onPasteCitations?: () => void;
  onUsePrevious?: () => void;
  hasPreviousCourse?: boolean;
}

export const EmptyState = ({
  hasItems,
  hasFolders,
  onAddItem,
  onClearFilters,
  onSearchLibrary,
  onPasteCitations,
  onUsePrevious,
  hasPreviousCourse = false,
}: EmptyStateProps) => {
  if (hasItems || hasFolders) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="mb-4 text-muted-foreground">No materials match your current filters.</p>
          <Button variant="outline" onClick={onClearFilters}>Clear Filters</Button>
        </CardContent>
      </Card>
    );
  }

  const choices: Array<{ title: string; description: string; icon: ReactNode; onClick?: () => void }> = [
    { title: 'Search the library', description: 'Find books, articles, and media', icon: <Search className="h-6 w-6" />, onClick: onSearchLibrary },
    { title: 'Paste a list from your syllabus', description: 'Start with a reading list', icon: <FileText className="h-6 w-6" />, onClick: onPasteCitations },
    {
      title: hasPreviousCourse ? 'Reuse what you used last time' : 'Reuse a past course',
      description: 'Browse materials from an earlier course',
      icon: <Copy className="h-6 w-6" />,
      onClick: onUsePrevious,
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="add-materials-start-title">
      <div className="text-center">
        <h3 id="add-materials-start-title" className="text-xl font-semibold">Add materials to your course reserve</h3>
        <p className="text-sm text-muted-foreground">Choose where you want to start.</p>
      </div>
      <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3">
        {choices.map((choice) => (
          <Card
            key={choice.title}
            role="button"
            tabIndex={choice.onClick ? 0 : -1}
            aria-disabled={!choice.onClick}
            className={`transition-colors ${choice.onClick ? 'cursor-pointer hover:border-primary' : 'opacity-60'}`}
            onClick={choice.onClick}
            onKeyDown={(event) => {
              if (choice.onClick && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                choice.onClick();
              }
            }}
          >
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
              <span className="text-primary">{choice.icon}</span>
              <div>
                <CardTitle className="text-base">{choice.title}</CardTitle>
                <CardDescription className="mt-1">{choice.description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        or{' '}
        <Button variant="link" className="h-auto p-0" onClick={onAddItem}>type an item in</Button>
      </p>
    </section>
  );
};

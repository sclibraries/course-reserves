import type { ReactNode } from 'react';

interface Props {
  code: string;
  title: string;
  section?: string;
  term: ReactNode;
  status: ReactNode;
  badges?: ReactNode;
  items: ReactNode;
  lastUpdated: string;
  actions: ReactNode;
}

export function DashboardCourseCard({ code, title, section, term, status, badges, items, lastUpdated, actions }: Props) {
  return (
    <article className="space-y-3 rounded-lg border bg-card p-4">
      <header className="min-w-0 space-y-2">
        <h2 className="break-words font-medium">{code} · {title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {term}
          {badges}
          {status}
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {section !== undefined && <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Section</dt>
          <dd className="break-words">{section}</dd>
        </div>}
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Items</dt>
          <dd className="break-words">{items}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Last updated</dt>
          <dd className="break-words">{lastUpdated}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </article>
  );
}

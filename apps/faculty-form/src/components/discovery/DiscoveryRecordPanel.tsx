import { Button } from '@/components/ui/button';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';

interface DiscoveryRecordPanelProps {
  record?: DiscoverySearchResult;
  loading?: boolean;
  error?: string | null;
  isRoute?: boolean;
  onBack?: () => void;
  onAdd?: () => void;
  addLabel?: string;
}

export default function DiscoveryRecordPanel({ record, loading = false, error, isRoute = false, onBack, onAdd, addLabel = 'Add to my list' }: DiscoveryRecordPanelProps) {
  if (loading) return <div className="rounded-md border p-6 text-sm text-muted-foreground" role="status">Loading full record…</div>;
  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 p-6">
        {isRoute && <Button variant="ghost" className="mb-4 px-0" onClick={onBack}>Back to results</Button>}
        <p className="whitespace-pre-line text-sm text-destructive">{error}</p>
      </div>
    );
  }
  if (!record) return <div className="rounded-md border p-6 text-sm text-muted-foreground">Select a result to view its full record.</div>;

  const identifiers = [
    record.isbn && `ISBN: ${record.isbn}`,
    record.issn && `ISSN: ${record.issn}`,
    record.doi && `DOI: ${record.doi}`,
  ].filter(Boolean);

  return (
    <article aria-label="Full record" className="space-y-4 rounded-md border bg-background p-5">
      {isRoute && <Button variant="ghost" className="px-0" onClick={onBack}>Back to results</Button>}
      {!isRoute && onBack && <Button variant="ghost" className="px-0" onClick={onBack}>Close record</Button>}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{record.publicationType}</p>
        <h2 className="mt-1 text-xl font-semibold">{record.title}</h2>
      </div>
      {record.authors.length > 0 && <p><strong>Authors:</strong> {record.authors.join('; ')}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        {record.edition && <><dt className="font-medium">Edition</dt><dd>{record.edition}</dd></>}
        {record.publisher && <><dt className="font-medium">Publisher</dt><dd>{record.publisher}</dd></>}
        {record.publicationDate && <><dt className="font-medium">Date</dt><dd>{[record.publicationDate.year, record.publicationDate.month, record.publicationDate.day].filter(Boolean).join('-')}</dd></>}
        {record.journalTitle && <><dt className="font-medium">Source</dt><dd>{record.journalTitle}{record.volumeNumber ? `, volume ${record.volumeNumber}` : ''}{record.issueNumber ? `, issue ${record.issueNumber}` : ''}</dd></>}
        {identifiers.length > 0 && <><dt className="font-medium">Identifiers</dt><dd>{identifiers.join(' · ')}</dd></>}
        {(record.location || record.callNumber) && <><dt className="font-medium">Holdings</dt><dd>{[record.location, record.callNumber].filter(Boolean).join(' · ')}</dd></>}
      </dl>
      {record.subjects && record.subjects.length > 0 && <section><h3 className="font-medium">Subjects</h3><p className="mt-1 text-sm text-muted-foreground">{record.subjects.join('; ')}</p></section>}
      {record.abstract && <section><h3 className="font-medium">Abstract</h3><p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{record.abstract}</p></section>}
      {record.fullTextLinks && record.fullTextLinks.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-medium">Full text</h3>
          {record.fullTextLinks.map((link) => <a key={link.Url} className="block text-sm text-primary underline" href={link.Url} target="_blank" rel="noreferrer">{link.Text || link.Name || 'Open full text'}</a>)}
        </section>
      )}
      {record.pLink && <a className="block text-sm text-primary underline" href={record.pLink} target="_blank" rel="noreferrer">View at EBSCO</a>}
      {onAdd && <Button className="w-full" onClick={onAdd}>{addLabel}</Button>}
    </article>
  );
}

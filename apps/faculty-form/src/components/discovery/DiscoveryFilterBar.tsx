import { Button } from '@/components/ui/button';
import type { DiscoveryFacets, SearchLimiters } from '@/services/discoverySearchService';

const locations = [
  'Smith College Annex',
  'Smith College Hillyer Art Library',
  'Smith College Josten Library',
  'Smith College Neilson Library',
  'Smith College Online',
];

interface DiscoveryFilterBarProps {
  filters: SearchLimiters;
  facets: DiscoveryFacets;
  onChange: (key: keyof SearchLimiters, value: boolean | string | undefined) => void;
}

export default function DiscoveryFilterBar({ filters, facets, onChange }: DiscoveryFilterBarProps) {
  return (
    <section className="rounded-md border bg-muted/30 p-3" aria-label="Search filters">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={filters.fullText ? 'default' : 'outline'} aria-pressed={Boolean(filters.fullText)} onClick={() => onChange('fullText', !filters.fullText)}>
          Full text
        </Button>
        <Button type="button" size="sm" variant={filters.peerReviewed ? 'default' : 'outline'} aria-pressed={Boolean(filters.peerReviewed)} onClick={() => onChange('peerReviewed', !filters.peerReviewed)}>
          Peer reviewed
        </Button>
        <Button type="button" size="sm" variant={filters.fiveCollege ? 'default' : 'outline'} aria-pressed={Boolean(filters.fiveCollege)} onClick={() => onChange('fiveCollege', !filters.fiveCollege)}>
          Five College
        </Button>
        <label className="flex items-center gap-2 text-sm">
          Location
          <select aria-label="Location" className="h-9 rounded-md border bg-background px-2" value={filters.location || ''} onChange={(event) => onChange('location', event.target.value || undefined)}>
            <option value="">All locations</option>
            {locations.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Source type
          <select aria-label="Source type" className="h-9 rounded-md border bg-background px-2" value={filters.sourceType || ''} onChange={(event) => onChange('sourceType', event.target.value || undefined)}>
            <option value="">All source types</option>
            {facets.sourceTypes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Publication year
          <select aria-label="Publication year" className="h-9 rounded-md border bg-background px-2" value={filters.publicationYear || ''} onChange={(event) => onChange('publicationYear', event.target.value || undefined)}>
            <option value="">Any year</option>
            {facets.publicationYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

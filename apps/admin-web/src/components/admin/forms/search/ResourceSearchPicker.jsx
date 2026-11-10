import { useId } from 'react';
import PropTypes from 'prop-types';
import { LoaderCircle, Search } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { ResourceFormType } from '../constants/formTypes';
import ResourceSearchResults from './ResourceSearchResults';

export default function ResourceSearchPicker({
  formType,
  searchTerm,
  onSearchTermChange,
  onSearch,
  searchResults,
  hasSearched,
  loading,
  totalHits,
  searchTime,
  hasMore,
  onLoadMore,
  onSelectRecord,
  searchInputRef,
  selectionDisabled = false,
}) {
  const searchId = useId();
  const source = {
    [ResourceFormType.EDS]: 'EDS',
    [ResourceFormType.HITCHCOCK]: 'Hitchcock',
    [ResourceFormType.REUSE]: 'resources',
  }[formType];

  return (
    <div className="tw-min-w-0 tw-space-y-4">
      <form
        className="tw-flex tw-min-w-0 tw-flex-col tw-gap-3 sm:tw-flex-row sm:tw-items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div className="tw-min-w-0 tw-flex-1">
          <Label htmlFor={searchId}>Search {source}</Label>
          <Input
            id={searchId}
            className="tw-mt-2"
            ref={searchInputRef}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !searchTerm.trim()}>
          {loading ? <LoaderCircle aria-hidden="true" className="tw-animate-spin" /> : <Search aria-hidden="true" />}
          Search
        </Button>
      </form>

      {formType === ResourceFormType.EDS && totalHits > 0 && (
        <p className="tw-text-sm tw-text-muted-foreground" role="status">
          Found {totalHits.toLocaleString()} results in {searchTime}ms
          {searchResults.length < totalHits && ` · Showing ${searchResults.length} of ${totalHits.toLocaleString()}`}
        </p>
      )}

      {hasSearched && searchResults.length === 0 && !loading && (
        <p className="tw-rounded-md tw-bg-muted tw-p-4 tw-text-sm" role="status">
          No results found for “{searchTerm}”. Try another search.
        </p>
      )}

      {searchResults.length > 0 && (
        <section aria-labelledby={`${searchId}-results`} className="tw-min-w-0 tw-space-y-3">
          <h2 id={`${searchId}-results`} className="tw-text-lg tw-font-semibold">Search results</h2>
          <ResourceSearchResults
            formType={formType}
            results={searchResults}
            onSelectRecord={onSelectRecord}
            selectionDisabled={selectionDisabled}
          />
          {hasMore && (
            <Button type="button" variant="outline" onClick={onLoadMore} disabled={loading}>
              {loading && <LoaderCircle aria-hidden="true" className="tw-animate-spin" />}
              Load More Results ({searchResults.length} of {totalHits.toLocaleString()})
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

ResourceSearchPicker.propTypes = {
  formType: PropTypes.oneOf([ResourceFormType.EDS, ResourceFormType.HITCHCOCK, ResourceFormType.REUSE]).isRequired,
  searchTerm: PropTypes.string.isRequired,
  onSearchTermChange: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
  searchResults: PropTypes.arrayOf(PropTypes.object).isRequired,
  hasSearched: PropTypes.bool.isRequired,
  loading: PropTypes.bool.isRequired,
  totalHits: PropTypes.number.isRequired,
  searchTime: PropTypes.number.isRequired,
  hasMore: PropTypes.bool.isRequired,
  onLoadMore: PropTypes.func.isRequired,
  onSelectRecord: PropTypes.func.isRequired,
  searchInputRef: PropTypes.object,
  selectionDisabled: PropTypes.bool,
};

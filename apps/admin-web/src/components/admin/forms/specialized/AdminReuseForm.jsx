import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Alert } from '../../../ui/alert';
import { ResourceFormType } from '../constants/formTypes';
import ResourceSearchPicker from '../search/ResourceSearchPicker';
import { useResourceSearch } from '../../../../hooks/admin/useResourceSearch';

export const AdminReuseForm = ({
  error,
  searchTerm = '',
  onSearchTermChange,
  onReuse,
  isLoading: reuseLoading = false,
}) => {
  const search = useResourceSearch(ResourceFormType.REUSE);
  const resetSearch = search.reset;
  const loading = search.loading || reuseLoading;

  useEffect(() => {
    if (!searchTerm) resetSearch();
  }, [searchTerm, resetSearch]);

  return (
    <>
      {error && <Alert variant="destructive">{error}</Alert>}
      <ResourceSearchPicker
        formType={ResourceFormType.REUSE}
        searchTerm={search.searchTerm}
        onSearchTermChange={(term) => {
          search.setSearchTerm(term);
          onSearchTermChange(term);
        }}
        onSearch={search.search}
        searchResults={search.searchResults}
        hasSearched={search.hasSearched}
        loading={loading}
        totalHits={search.totalHits}
        searchTime={search.searchTime}
        hasMore={search.hasMore}
        onLoadMore={search.loadMore}
        onSelectRecord={(resource) => onReuse(resource.resource_id)}
        selectionDisabled={loading}
      />
    </>
  );
};

AdminReuseForm.propTypes = {
  error: PropTypes.string,
  searchTerm: PropTypes.string,
  onSearchTermChange: PropTypes.func.isRequired,
  onReuse: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default AdminReuseForm;

/**
 * AdminReuseForm - Specialized Form for Reusing Existing Resources
 * 
 * This component provides a search interface for finding and reusing existing
 * resources from other courses. It handles:
 * - Resource search by title
 * - Search results display with actionable buttons
 * - Resource reuse workflow integration
 * 
 * Used by: ResourceFormManager with ResourceFormType.REUSE
 * 
 * @component
 * @example
 * <AdminReuseForm
 *   searchTerm={searchTerm}
 *   searchResults={results}
 *   onSearchTermChange={setSearchTerm}
 *   onSearch={handleSearch}
 *   onReuse={handleReuse}
 *   isLoading={loading}
 * />
 */

import PropTypes from 'prop-types';
import { Form, FormGroup, Label, Input, Button, Table, Spinner } from 'reactstrap';

export const AdminReuseForm = ({ 
  searchTerm, 
  searchResults, 
  onSearchTermChange, 
  onSearch, 
  onReuse, 
  isLoading 
}) => {
  /**
   * Handle form submission for search
   * Prevents default form behavior and triggers search
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSearch(searchTerm);
  };

  return (
    <>
      {/* Search Form */}
      <Form onSubmit={handleSubmit} className="mb-4">
        <FormGroup>
          <Label for="resource-search" className="form-label fw-bold">
            Search for Existing Resources
          </Label>
          <div className="d-flex gap-2">
            <Input
              id="resource-search"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Enter part of resource title to search..."
              className="flex-grow-1"
              disabled={isLoading}
            />
            <Button 
              color="primary" 
              type="submit" 
              disabled={isLoading || !searchTerm?.trim()}
              className="px-4"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="me-1" />
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </Button>
          </div>
          <small className="form-text text-muted">
            Search for resources from other courses to reuse in this course
          </small>
        </FormGroup>
      </Form>
      
      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="search-results">
          <h6 className="mb-3">Found {searchResults.length} resource(s)</h6>
          <Table bordered responsive hover className="mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '40%' }}>Resource Title</th>
                <th style={{ width: '40%' }}>URL</th>
                <th style={{ width: '20%' }} className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((resource) => (
                <tr key={resource.resource_id}>
                  <td>
                    <div className="resource-title">
                      <strong>{resource.name}</strong>
                      {resource.material_type_name && (
                        <small className="text-muted d-block">
                          Type: {resource.material_type_name}
                        </small>
                      )}
                    </div>
                  </td>
                  <td style={{ wordBreak: 'break-word' }}>
                    {resource.item_url ? (
                      <a 
                        href={resource.item_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-decoration-none"
                      >
                        {resource.item_url}
                      </a>
                    ) : (
                      <span className="text-muted">No URL available</span>
                    )}
                  </td>
                  <td className="text-center">
                    <Button
                      color="success"
                      size="sm"
                      onClick={() => onReuse(resource.resource_id)}
                      disabled={isLoading}
                      className="px-3"
                    >
                      {isLoading ? (
                        <Spinner size="sm" />
                      ) : (
                        'Add to Course'
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* No Results Message */}
      {searchTerm && searchResults.length === 0 && !isLoading && (
        <div className="text-center py-4 text-muted">
          <p className="mb-0">No resources found matching &quot;{searchTerm}&quot;</p>
          <small>Try searching with different keywords</small>
        </div>
      )}
    </>
  );
};

AdminReuseForm.propTypes = {
  /** Current search term */
  searchTerm: PropTypes.string,
  /** Array of search results to display */
  searchResults: PropTypes.arrayOf(PropTypes.shape({
    resource_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    item_url: PropTypes.string,
    material_type_name: PropTypes.string,
  })),
  /** Callback when search term changes */
  onSearchTermChange: PropTypes.func.isRequired,
  /** Callback to trigger search */
  onSearch: PropTypes.func.isRequired,
  /** Callback when reusing a resource */
  onReuse: PropTypes.func.isRequired,
  /** Whether a search/reuse operation is in progress */
  isLoading: PropTypes.bool
};

AdminReuseForm.defaultProps = {
  searchTerm: '',
  searchResults: [],
  isLoading: false
};

export default AdminReuseForm;
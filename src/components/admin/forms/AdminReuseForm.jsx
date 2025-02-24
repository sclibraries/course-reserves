// components/admin/forms/AdminReuseForm.js
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
  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSearch(searchTerm);
  };

  return (
    <>
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label>Search Title:</Label>
          <Input
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Part of title"
          />
        </FormGroup>
        <Button color="primary" type="submit" disabled={isLoading}>
          {isLoading ? <Spinner size="sm" /> : 'Search'}
        </Button>
      </Form>
      
      {searchResults.length > 0 && (
        <Table bordered responsive className="mt-3">
          <thead>
            <tr>
              <th>Name</th>
              <th>Url</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {searchResults.map((res) => (
              <tr key={res.resource_id}>
                <td style={{wordBreak: 'break-word'}}>{res.name}</td>
                <td style={{wordBreak: "break-word"}}>
                  {res.item_url ? (
                    <a href={res.item_url} target="_blank" rel="noreferrer">
                      {res.item_url}
                    </a>
                  ) : 'N/A'}
                </td>
                <td>
                  <Button
                    color="primary"
                    onClick={() => onReuse(res.resource_id)}
                    disabled={isLoading}
                  >
                    {isLoading ? <Spinner size="sm" /> : 'Add to Course'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
};

AdminReuseForm.propTypes = {
  searchTerm: PropTypes.string,
  searchResults: PropTypes.array,
  onSearchTermChange: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
  onReuse: PropTypes.func.isRequired,
  isLoading: PropTypes.bool
};
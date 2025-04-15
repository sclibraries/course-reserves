import { Button, InputGroup, Input, Row, Col, Badge } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';

const UserSearch = ({ 
  activeTab, 
  setActiveTab, 
  pendingCount, 
  searchTerm, 
  handleSearchChange, 
  clearSearch, 
  filteredCount 
}) => {
  return (
    <Row className="mb-4">
      <Col md={6} className="d-flex align-items-center mb-3 mb-md-0">
        <Button
          color={activeTab === 'pending' ? 'primary' : 'outline-primary'}
          className="me-2 d-flex align-items-center"
          onClick={() => setActiveTab('pending')}
        >
          <FontAwesomeIcon icon="clock" className="me-2" />
          Pending Requests
          {pendingCount > 0 && (
            <Badge color="light" pill className="ms-2">{pendingCount}</Badge>
          )}
        </Button>
        <Button
          color={activeTab === 'all' ? 'primary' : 'outline-primary'}
          className="d-flex align-items-center"
          onClick={() => setActiveTab('all')}
        >
          <FontAwesomeIcon icon="users" className="me-2" />
          All Users
        </Button>
      </Col>
      <Col md={6}>
        <InputGroup>
          <Input 
            type="text" 
            placeholder="Search by name, email, username..." 
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-users-input"
          />
          {searchTerm && (
            <Button color="secondary" onClick={clearSearch}>
              <FontAwesomeIcon icon="times" />
            </Button>
          )}
          <Button color="primary">
            <FontAwesomeIcon icon="search" />
          </Button>
        </InputGroup>
        {searchTerm && filteredCount > 0 && (
          <div className="mt-2 text-muted small">
            Found {filteredCount} {filteredCount === 1 ? 'user' : 'users'} matching &quot;{searchTerm}&quot;
          </div>
        )}
      </Col>
    </Row>
  );
};

UserSearch.propTypes = {
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  pendingCount: PropTypes.number.isRequired,
  searchTerm: PropTypes.string.isRequired,
  handleSearchChange: PropTypes.func.isRequired,
  clearSearch: PropTypes.func.isRequired,
  filteredCount: PropTypes.number.isRequired
};

export default UserSearch;

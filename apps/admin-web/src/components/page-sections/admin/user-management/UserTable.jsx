import { Table, Button, Badge } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';

const UserTable = ({ 
  users, 
  isPending, 
  searchTerm, 
  sortField, 
  sortDirection, 
  handleSort, 
  openModal, 
  openEditModal 
}) => {
  // Render sort indicator
  const renderSortIcon = (field) => {
    if (sortField !== field) return null;
    
    return (
      <span className="ms-1">
        {sortDirection === 'asc' 
          ? <FontAwesomeIcon icon="sort-up" size="sm" /> 
          : <FontAwesomeIcon icon="sort-down" size="sm" />
        }
      </span>
    );
  };

  const renderPendingMessage = () => (
    <tr>
      <td colSpan="7" className="text-center py-4 text-muted">
        {searchTerm ? (
          <>
            <FontAwesomeIcon icon="search" className="me-2" />
            No users found matching &quot;{searchTerm}&quot;
          </>
        ) : (
          <>
            <FontAwesomeIcon icon="check-circle" className="me-2" />
            No pending user requests
          </>
        )}
      </td>
    </tr>
  );

  const renderEmptyMessage = () => (
    <tr>
      <td colSpan="8" className="text-center py-4 text-muted">
        {searchTerm ? (
          <>
            <FontAwesomeIcon icon="search" className="me-2" />
            No users found matching &quot;{searchTerm}&quot;
          </>
        ) : (
          <>
            <FontAwesomeIcon icon="exclamation-circle" className="me-2" />
            No users found
          </>
        )}
      </td>
    </tr>
  );

  return (
    <div className="table-responsive">
      <Table hover className="align-middle">
        <thead className="bg-light">
          <tr>
            <th onClick={() => handleSort('username')} style={{ cursor: 'pointer' }}>
              Username {renderSortIcon('username')}
            </th>
            <th onClick={() => handleSort('full_name')} style={{ cursor: 'pointer' }}>
              Full Name {renderSortIcon('full_name')}
            </th>
            <th onClick={() => handleSort('email')} style={{ cursor: 'pointer' }}>
              Email {renderSortIcon('email')}
            </th>
            <th onClick={() => handleSort('department')} style={{ cursor: 'pointer' }}>
              Department {renderSortIcon('department')}
            </th>
            <th onClick={() => handleSort('institution')} style={{ cursor: 'pointer' }}>
              Institution {renderSortIcon('institution')}
            </th>
            {isPending ? (
              <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                Requested {renderSortIcon('created_at')}
              </th>
            ) : (
              <th onClick={() => handleSort('role')} style={{ cursor: 'pointer' }}>
                Role {renderSortIcon('role')}
              </th>
            )}
            {!isPending && (
              <th className="text-center" onClick={() => handleSort('approved')} style={{ cursor: 'pointer' }}>
                Status {renderSortIcon('approved')}
              </th>
            )}
            <th className="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            isPending ? renderPendingMessage() : renderEmptyMessage()
          ) : (
            users.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.full_name}</td>
                <td>
                  <a href={`mailto:${user.email}`} className="text-decoration-none">
                    {user.email}
                  </a>
                </td>
                <td>{user.department}</td>
                <td>{user.institution}</td>
                {isPending ? (
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                ) : (
                  <td>
                    <Badge 
                      color={user.role === 'admin' ? 'primary' : 'info'}
                      pill
                    >
                      {user.role}
                    </Badge>
                  </td>
                )}
                {!isPending && (
                  <td className="text-center">
                    <Badge color={user.approved === 1 ? 'success' : 'warning'} pill>
                      {user.approved === 1 ? 'Approved' : 'Pending'}
                    </Badge>
                  </td>
                )}
                <td>
                  {isPending ? (
                    <div className="d-flex justify-content-center gap-2">
                      <Button 
                        color="success" 
                        size="sm" 
                        className="d-flex align-items-center" 
                        onClick={() => openModal(user, 'approve')}
                      >
                        <FontAwesomeIcon icon="check" className="me-2" />
                        Approve
                      </Button>
                      <Button 
                        color="danger" 
                        size="sm" 
                        className="d-flex align-items-center" 
                        onClick={() => openModal(user, 'reject')}
                      >
                        <FontAwesomeIcon icon="times" className="me-2" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Button
                        color="secondary"
                        size="sm"
                        className="d-flex align-items-center mx-auto"
                        onClick={() => openEditModal(user)}
                      >
                        <FontAwesomeIcon icon="edit" className="me-2" />
                        Edit
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
};

UserTable.propTypes = {
  users: PropTypes.array.isRequired,
  isPending: PropTypes.bool.isRequired,
  searchTerm: PropTypes.string.isRequired,
  sortField: PropTypes.string.isRequired,
  sortDirection: PropTypes.string.isRequired,
  handleSort: PropTypes.func.isRequired,
  openModal: PropTypes.func.isRequired,
  openEditModal: PropTypes.func.isRequired
};

export default UserTable;

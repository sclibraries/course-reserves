import { useState } from 'react';
import { Card, Spinner, Button, Nav, NavItem, NavLink } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from '../../../contexts/AuthContext';
import classnames from 'classnames';

// Import refactored components
import UserTable from './user-management/UserTable';
import UserSearch from './user-management/UserSearch';
import { ConfirmationModal, EditUserModal, CreateUserModal } from './user-management/UserModals';
import PermissionManagement from './user-management/PermissionManagement';
import useUserManagement from './user-management/useUserManagement';
import usePermissionManagement from './user-management/usePermissionManagement';

const UserManagement = () => {
  const { token } = useAuth();
  const [activeSection, setActiveSection] = useState('users');
  
  const {
    // State
    pendingUsers,
    loading,
    activeTab,
    selectedUser,
    modalOpen,
    actionType,
    editModalOpen,
    createModalOpen,
    searchTerm,
    sortField,
    sortDirection,
    editFormData,
    createFormData,
    formErrors,
    createFormErrors,
    submitting,
    filteredUsers,

    // Actions
    setActiveTab,
    handleSearchChange,
    clearSearch,
    handleSort,
    openModal,
    openEditModal,
    openCreateModal,
    handleApprove,
    handleReject,
    handleEditFormChange,
    handleCreateFormChange,
    handleEditSubmit,
    handleCreateSubmit,
    setModalOpen,
    setEditModalOpen,
    setCreateModalOpen
  } = useUserManagement(token);

  const {
    permissions,
    availablePermissions,
    loading: permissionsLoading,
    updating,
    togglePermission
  } = usePermissionManagement(token);

  return (
    <div className="fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">User Management</h1>
        {activeSection === 'users' && (
          <Button 
            color="primary" 
            onClick={openCreateModal}
            className="d-flex align-items-center"
          >
            <FontAwesomeIcon icon="user-plus" className="me-2" />
            Add New User
          </Button>
        )}
      </div>

      {/* Section Navigation */}
      <Nav tabs className="mb-4">
        <NavItem>
          <NavLink
            className={classnames({ active: activeSection === 'users' })}
            onClick={() => setActiveSection('users')}
            style={{ cursor: 'pointer' }}
          >
            <FontAwesomeIcon icon="users" className="me-2" />
            Users
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={classnames({ active: activeSection === 'permissions' })}
            onClick={() => setActiveSection('permissions')}
            style={{ cursor: 'pointer' }}
          >
            <FontAwesomeIcon icon="key" className="me-2" />
            Permissions
          </NavLink>
        </NavItem>
      </Nav>
      
      {activeSection === 'users' ? (
        <>
          <UserSearch 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pendingCount={pendingUsers.length}
            searchTerm={searchTerm}
            handleSearchChange={handleSearchChange}
            clearSearch={clearSearch}
            filteredCount={filteredUsers.length}
          />
          
          <Card className="shadow-sm">
            <div className="card-body p-0">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner color="primary" />
                  <p className="mt-3 text-muted">Loading users...</p>
                </div>
              ) : (
                <UserTable 
                  users={filteredUsers}
                  isPending={activeTab === 'pending'}
                  searchTerm={searchTerm}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  handleSort={handleSort}
                  openModal={openModal}
                  openEditModal={openEditModal}
                />
              )}
            </div>
          </Card>
          
          {/* Modals */}
          <ConfirmationModal 
            isOpen={modalOpen}
            toggle={() => setModalOpen(!modalOpen)}
            user={selectedUser}
            actionType={actionType}
            handleApprove={handleApprove}
            handleReject={handleReject}
          />
          
          <EditUserModal 
            isOpen={editModalOpen}
            toggle={() => setEditModalOpen(!editModalOpen)}
            user={selectedUser}
            formData={editFormData}
            formErrors={formErrors}
            handleChange={handleEditFormChange}
            handleSubmit={handleEditSubmit}
            submitting={submitting}
          />
          
          <CreateUserModal 
            isOpen={createModalOpen}
            toggle={() => setCreateModalOpen(!createModalOpen)}
            formData={createFormData}
            formErrors={createFormErrors}
            handleChange={handleCreateFormChange}
            handleSubmit={handleCreateSubmit}
            submitting={submitting}
          />
        </>
      ) : (
        <PermissionManagement 
          permissions={permissions}
          availablePermissions={availablePermissions}
          loading={permissionsLoading}
          updating={updating}
          togglePermission={togglePermission}
        />
      )}
    </div>
  );
};

export default UserManagement;
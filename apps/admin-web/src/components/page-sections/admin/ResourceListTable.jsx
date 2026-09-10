/**
 * @file ResourceListTable component
 * @module ResourceListTable
 * @description Displays a table of electronic resources with editing and deletion capabilities.
 * Supports pagination, sorting, and filtering of resources.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Table,
  Badge,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner
} from 'reactstrap';
import { FaEdit, FaTrash, FaExternalLinkAlt, FaSort, FaSortUp, FaSortDown, FaSearch } from 'react-icons/fa';
import ResourceFormManager from '../../admin/forms/ResourceFormManager';
import { ResourceFormType } from '../../admin/forms/constants/formTypes';
import { useResourceFormModal } from '../../../hooks/admin/useResourceFormModal';
import { adminResourceService } from '../../../services/admin/adminResourceService';
import { toast } from 'react-toastify';

/**
 * Smith College proxy URL prefix
 * @constant {string}
 */
const PROXY_PREFIX = "https://libproxy.smith.edu/login?url=";

/**
 * Adjusts the proxy settings in a resource URL
 * @function
 * @param {Object} data - Resource data
 */
function adjustProxy(data) {
  if (!data || typeof data.link !== "string") {
    throw new Error("Invalid data or missing link property");
  }
  
  if (data.use_proxy == 1) {
    if (!data.link.startsWith(PROXY_PREFIX)) {
      data.link = PROXY_PREFIX + data.link;
    }
  } else if (data.use_proxy == 0) {
    if (data.link.startsWith(PROXY_PREFIX)) {
      data.link = data.link.replace(PROXY_PREFIX, "");
    }
  }
}

/**
 * Delete confirmation modal component
 * @component
 */
const DeleteConfirmationModal = ({ isOpen, toggle, resource, loading, onConfirm }) => (
  <Modal isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>Confirm Deletion</ModalHeader>
    <ModalBody>
      {resource && (
        <>
          <p>Are you sure you want to delete this resource? This action cannot be undone.</p>
          <p><strong>Resource:</strong> {resource.name}</p>
          {resource.course_count > 0 && (
            <p className="text-danger">
              Warning: This resource is linked to {resource.course_count} {resource.course_count === 1 ? 'course' : 'courses'}.
            </p>
          )}
        </>
      )}
    </ModalBody>
    <ModalFooter>
      <Button color="secondary" onClick={toggle} disabled={loading}>
        Cancel
      </Button>
      <Button color="danger" onClick={onConfirm} disabled={loading}>
        {loading ? <Spinner size="sm" /> : 'Delete'}
      </Button>
    </ModalFooter>
  </Modal>
);

// Add PropTypes for DeleteConfirmationModal
DeleteConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  resource: PropTypes.shape({
    resource_id: PropTypes.string.isRequired,
    name: PropTypes.string,
    course_count: PropTypes.number
  }),
  loading: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired
};

/**
 * Resource list table component
 * @component
 */
const ResourceListTable = ({ resources, refreshResources }) => {
  const editResourceModal = useResourceFormModal();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const toggleDeleteModal = () => setDeleteModalOpen(!deleteModalOpen);

  const handleEdit = async (formData) => {
    const { resource_id, ...data } = formData;
    
    try {
      adjustProxy(data);
      const update = await adminResourceService.updateResource(resource_id, data);
      
      if (update) {
        editResourceModal.closeModal();
        toast.success('Resource updated successfully');
        refreshResources();
      } else {
        toast.error('Resource update failed');
      }
    } catch (error) {
      console.error('Resource Update Failed:', error);
      toast.error(`Resource update failed: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDelete = (id) => {
    const resource = resources.find(r => r.resource_id === id);
    setResourceToDelete(resource);
    toggleDeleteModal();
  };

  const confirmDelete = async () => {
    if (!resourceToDelete) return;
    
    try {
      setLoading(true);
      await adminResourceService.deleteResource(resourceToDelete.resource_id);
      toast.success('Resource deleted successfully');
      refreshResources();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(`Failed to delete resource: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      toggleDeleteModal();
      setResourceToDelete(null);
    }
  };

  const handleSelectedResource = (resource) => {
    editResourceModal.openEditResourceForm(resource);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return <FaSort size={12} className="ms-1 text-muted" />;
    return sortDirection === 'asc' 
      ? <FaSortUp size={12} className="ms-1 text-primary" /> 
      : <FaSortDown size={12} className="ms-1 text-primary" />;
  };

  const getSortedResources = () => {
    return [...resources].sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';

      if (sortDirection === 'asc') {
        return String(aValue).localeCompare(String(bValue));
      } else {
        return String(bValue).localeCompare(String(aValue));
      }
    });
  };

  // Show message when no resources available
  if (!resources || resources.length === 0) {
    return (
      <div className="empty-state fade-in">
        <div className="empty-state-icon">
          <FaSearch />
        </div>
        <h3>No resources found</h3>
        <p className="text-muted">Try adjusting your search criteria or add some resources to get started.</p>
      </div>
    );
  }

  const sortedResources = getSortedResources();

  return (
    <div className="admin-table-container">
      <Table hover responsive className="custom-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('resource_id')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                Resource ID {renderSortIcon('resource_id')}
              </span>
            </th>
            <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                Name {renderSortIcon('name')}
              </span>
            </th>  
            <th onClick={() => handleSort('item_url')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                URL {renderSortIcon('item_url')}
              </span>
            </th>
            <th onClick={() => handleSort('material_type_name')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                Material Type {renderSortIcon('material_type_name')}
              </span>
            </th>
            <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                Created At {renderSortIcon('created_at')}
              </span>
            </th>
            <th onClick={() => handleSort('course_count')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                Course Count {renderSortIcon('course_count')}
              </span>
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedResources.map(resource => (
            <tr key={resource.resource_id}>
              <td>{resource.resource_id}</td>
              <td className="fw-medium">{resource.name || 'Untitled Resource'}</td>
              <td>
                {resource.item_url ? (
                  <a 
                    href={resource.item_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="d-flex align-items-center text-primary"
                    aria-label={`Open ${resource.name} link`}
                  >
                    View <FaExternalLinkAlt className="ms-1" size={12} />
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td>
                <Badge color="info" pill className="px-3 py-1">
                  {resource.material_type_name || 'Unknown'}
                </Badge>
              </td>
              <td>
                {resource.created_at 
                  ? new Date(resource.created_at).toLocaleDateString() 
                  : '—'
                }
              </td>
              <td>
                {resource.course_count > 0 ? (
                  <Badge color="success" pill className="px-3 py-1">
                    {resource.course_count}
                  </Badge>
                ) : (
                  <Badge color="secondary" pill className="px-3 py-1">
                    0
                  </Badge>
                )}
              </td>
              <td>
                <div className="d-flex gap-2">
                  <Button 
                    color="primary" 
                    size="sm"
                    outline
                    className="d-flex align-items-center gap-1"
                    onClick={() => handleSelectedResource(resource)}
                    aria-label={`Edit ${resource.name}`}
                  >
                    <FaEdit size={14} /> Edit
                  </Button>
                  <Button 
                    color="danger" 
                    size="sm" 
                    outline
                    className="d-flex align-items-center gap-1"
                    onClick={() => handleDelete(resource.resource_id)}
                    disabled={loading}
                    aria-label={`Delete ${resource.name}`}
                  >
                    <FaTrash size={14} /> Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Edit Resource Modal */}
      <ResourceFormManager
        isOpen={editResourceModal.isOpen}
        onClose={editResourceModal.closeModal}
        onSubmit={handleEdit}
        formType={ResourceFormType.EDIT}
        initialData={editResourceModal.initialData}
        {...editResourceModal.additionalProps}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        toggle={toggleDeleteModal}
        resource={resourceToDelete}
        loading={loading}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

ResourceListTable.propTypes = {
  resources: PropTypes.arrayOf(
    PropTypes.shape({
      resource_id: PropTypes.string.isRequired,
      name: PropTypes.string,
      item_url: PropTypes.string,
      link: PropTypes.string,  // Added missing property used in adjustProxy
      use_proxy: PropTypes.number, // Added missing property used in adjustProxy
      material_type_name: PropTypes.string,
      created_at: PropTypes.string,
      course_count: PropTypes.number,
    })
  ).isRequired,
  refreshResources: PropTypes.func.isRequired
};

export default ResourceListTable;
/**
 * @file ResourceListTable component
 * @module ResourceListTable
 * @description Displays a table of electronic resources with editing and deletion capabilities.
 * Supports pagination, sorting, and filtering of resources.
 * @requires react
 * @requires prop-types
 * @requires reactstrap
 * @requires react-toastify
 * @requires ../../../hooks/admin/useAdminModal
 * @requires ../../admin/modals/AdminEditResourceModel
 * @requires ../../../services/admin/adminResourceService
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Table,
  Badge,
  Button,
  Container,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner
} from 'reactstrap';
import { AdminEditResourceModal } from '../../admin/modals/AdminEditResourceModel';
import { useAdminModal } from '../../../hooks/admin/useAdminModal';
import { adminResourceService } from '../../../services/admin/adminResourceService';
import { toast } from 'react-toastify';

/**
 * Smith College proxy URL prefix
 * @constant {string}
 */
const PROXY_PREFIX = "https://libproxy.smith.edu/login?url=";

/**
 * Resource shape definition for PropTypes
 * @constant {Object}
 */
const resourceShape = PropTypes.shape({
  resource_id: PropTypes.string.isRequired,
  name: PropTypes.string,
  item_url: PropTypes.string,
  description: PropTypes.string,
  material_type_name: PropTypes.string,
  material_type_id: PropTypes.string,
  created_at: PropTypes.string,
  course_count: PropTypes.number,
});

/**
 * Pagination shape definition for PropTypes
 * @constant {Object}
 */
const paginationShape = PropTypes.shape({
  currentPage: PropTypes.number,
  totalPages: PropTypes.number,
  totalItems: PropTypes.number,
  perPage: PropTypes.number,
});

/**
 * Adjusts the proxy settings in a resource URL
 * 
 * @function
 * @param {Object} data - Resource data
 * @param {string} data.link - The URL to adjust
 * @param {number} data.use_proxy - Whether to use proxy (1) or not (0)
 * @returns {void}
 * @throws {Error} If data or link property is invalid
 */
function adjustProxy(data) {
  // Basic error checking
  if (!data || typeof data.link !== "string") {
    throw new Error("Invalid data or missing link property");
  }
  
  // Check explicitly against the numbers 1 or 0.
  if (data.use_proxy == 1) {
    // Add the proxy prefix if it's not already present.
    if (!data.link.startsWith(PROXY_PREFIX)) {
      data.link = PROXY_PREFIX + data.link;
    }
  } else if (data.use_proxy == 0) {
    // Remove the proxy prefix if it's present.
    if (data.link.startsWith(PROXY_PREFIX)) {
      data.link = data.link.replace(PROXY_PREFIX, "");
    }
  }
}

/**
 * Delete confirmation modal component
 * 
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.toggle - Function to toggle modal visibility
 * @param {Object} props.resource - Resource to be deleted
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onConfirm - Function to call when deletion is confirmed
 * @returns {JSX.Element} Modal component
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

DeleteConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  resource: PropTypes.object,
  loading: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired
};

/**
 * Resource list table component
 * 
 * Displays a sortable, filterable table of electronic resources with
 * options for editing and deletion.
 * 
 * @component
 * @example
 * const resources = [
 *   {
 *     resource_id: '123',
 *     name: 'Introduction to React',
 *     item_url: 'https://example.com/resource',
 *     material_type_name: 'E-Book',
 *     created_at: '2023-04-15T12:00:00Z',
 *     course_count: 2
 *   }
 * ];
 * 
 * return (
 *   <ResourceListTable 
 *     resources={resources} 
 *     refreshResources={() => fetchResources()}
 *   />
 * );
 * 
 * @param {Object} props - Component props
 * @param {Array<Object>} props.resources - List of resources to display
 * @param {Object} [props.pagination] - Pagination information
 * @param {Function} props.refreshResources - Function to refresh resources after updates
 * @returns {JSX.Element} Resource table with modals
 */
const ResourceListTable = ({ resources, refreshResources }) => {
  /**
   * Edit resource modal state
   * @type {[boolean, Function]}
   */
  const [editResourceModalOpen, toggleEditResourceModal] = useAdminModal();
  
  /**
   * Selected resource for editing
   * @type {[Object|null, Function]}
   */
  const [selectedResource, setSelectedResource] = useState(null);
  
  /**
   * Delete confirmation modal state
   * @type {[boolean, Function]}
   */
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  /**
   * Resource selected for deletion
   * @type {[Object|null, Function]}
   */
  const [resourceToDelete, setResourceToDelete] = useState(null);
  
  /**
   * Loading state for async operations
   * @type {[boolean, Function]}
   */
  const [loading, setLoading] = useState(false);

  /**
   * Toggle delete confirmation modal
   * @function
   * @returns {void}
   */
  const toggleDeleteModal = () => setDeleteModalOpen(!deleteModalOpen);

  /**
   * Handle resource editing
   * 
   * Updates the resource via API and refreshes the resource list
   * 
   * @async
   * @function
   * @param {Object} formData - Form data from the edit modal
   * @param {string} formData.resource_id - ID of the resource to update
   * @returns {Promise<void>}
   */
  const handleEdit = async (formData) => {
    const { resource_id, ...data } = formData;
    
    try {
      adjustProxy(data);
      const update = await adminResourceService.updateResource(resource_id, data);
      
      if (update) {
        toggleEditResourceModal();
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

  /**
   * Trigger delete confirmation modal
   * 
   * @function
   * @param {string} id - Resource ID to delete
   * @returns {void}
   */
  const handleDelete = (id) => {
    const resource = resources.find(r => r.resource_id === id);
    setResourceToDelete(resource);
    toggleDeleteModal();
  };

  /**
   * Confirm resource deletion
   * 
   * Deletes the resource via API and refreshes the list
   * 
   * @async
   * @function
   * @returns {Promise<void>}
   */
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

  /**
   * Open the edit modal for a selected resource
   * 
   * @function
   * @param {Object} resource - The resource to edit
   * @returns {void}
   */
  const handleSelectedResource = (resource) => {
    setSelectedResource(resource);
    toggleEditResourceModal();
  };

  // Show message when no resources available
  if (!resources || resources.length === 0) {
    return (
      <Container className="my-4 text-center">
        <p>No resources found. Add some resources to get started.</p>
      </Container>
    );
  }

  return (
    <Container className="my-4">
      <Table hover responsive striped>
        <thead>
          <tr>
            <th>Resource ID</th>  
            <th>Name</th>
            <th>URL</th>
            <th>Material Type</th>
            <th>Created At</th>
            <th>Course Count</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {resources.map(resource => (
            <tr key={resource.resource_id}>
              <td>{resource.resource_id}</td>
              <td style={{ wordBreak: 'break-word' }}>{resource.name}</td>
              <td style={{ wordBreak: 'break-word' }}>
                {resource.item_url ? (
                  <a 
                    href={resource.item_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${resource.name} link`}
                  >
                    {resource.item_url}
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td>
                <Badge color="info">{resource.material_type_name || '—'}</Badge>
              </td>
              <td>
                {resource.created_at 
                  ? new Date(resource.created_at).toLocaleDateString() 
                  : '—'
                }
              </td>
              <td>{resource.course_count || 0}</td>
              <td>
                <div className="d-flex gap-2">
                  <Button 
                    color="primary" 
                    size="sm"
                    onClick={() => handleSelectedResource(resource)}
                    aria-label={`Edit ${resource.name}`}
                  >
                    Edit
                  </Button>
                  <Button 
                    color="danger" 
                    size="sm" 
                    onClick={() => handleDelete(resource.resource_id)}
                    disabled={loading}
                    aria-label={`Delete ${resource.name}`}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Edit Resource Modal */}
      <AdminEditResourceModal
        isOpen={editResourceModalOpen}
        toggle={toggleEditResourceModal}
        onSubmit={handleEdit}
        resource={selectedResource}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        toggle={toggleDeleteModal}
        resource={resourceToDelete}
        loading={loading}
        onConfirm={confirmDelete}
      />
    </Container>
  );
};

ResourceListTable.propTypes = {
  resources: PropTypes.arrayOf(resourceShape).isRequired,
  pagination: paginationShape,
  refreshResources: PropTypes.func.isRequired
};

export default ResourceListTable;
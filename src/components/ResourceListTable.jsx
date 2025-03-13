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
import { AdminEditResourceModal } from './admin/modals/AdminEditResourceModel';
import { useAdminModal } from '../hooks/admin/useAdminModal';
import { adminResourceService } from '../services/admin/adminResourceService';
import { toast } from 'react-toastify';

const ResourceListTable = ({ resources, refreshResources }) => {
  const [editResourceModalOpen, toggleEditResourceModal] = useAdminModal();
  const [selectedResource, setSelectedResource] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const PROXY_PREFIX = "https://libproxy.smith.edu/login?url=";

  // Toggle delete confirmation modal
  const toggleDeleteModal = () => setDeleteModalOpen(!deleteModalOpen);

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


  // Handle resource editing – using react-toastify for alerts
  const handleEdit = async (formData) => {
    const { resource_id, ...data } = formData;
    adjustProxy(data);
    try {
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
      toast.error('Resource update failed');
    }
  };

  // Trigger delete confirmation modal
  const handleDelete = (id) => {
    const resource = resources.find(r => r.resource_id === id);
    setResourceToDelete(resource);
    toggleDeleteModal();
  };

  // Confirm deletion and refresh the resource list
  const confirmDelete = async () => {
    if (!resourceToDelete) return;
    try {
      setLoading(true);
      await adminResourceService.deleteResource(resourceToDelete.resource_id);
      toast.success('Resource deleted successfully');
      refreshResources();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete resource');
    } finally {
      setLoading(false);
      toggleDeleteModal();
      setResourceToDelete(null);
    }
  };

  // Open the edit modal for the selected resource
  const handleSelectedResource = (resource) => {
    setSelectedResource(resource);
    toggleEditResourceModal();
  };

  return (
    <Container className="my-4">
      <Table hover responsive striped>
        <thead>
          <tr>
            <th>Resource ID</th>  
            <th>Name</th>
            <th>Url</th>
            <th>Material Type</th>
            <th>Created At</th>
            <th>Course Count</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {resources.map(resource => (
            <tr key={resource.resource_id}>
              <td>{resource.resource_id}</td>
              <td style={{ wordBreak: 'break-word' }}>{resource.name}</td>
              <td style={{ wordBreak: 'break-word' }}>{resource.item_url}</td>
              <td>
                <Badge color="info">{resource.material_type_name}</Badge>
              </td>
              <td>{new Date(resource.created_at).toLocaleDateString()}</td>
              <td>{resource.course_count}</td>
              <td>
                <Button 
                  color="primary" 
                  size="sm" 
                  className="mr-2" 
                  onClick={() => handleSelectedResource(resource)}
                >
                  Edit
                </Button>
                <Button 
                  color="danger" 
                  size="sm" 
                  onClick={() => handleDelete(resource.resource_id)}
                  disabled={loading}
                >
                  {loading ? <Spinner size="sm" /> : 'Delete'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <AdminEditResourceModal
        isOpen={editResourceModalOpen}
        toggle={toggleEditResourceModal}
        onSubmit={handleEdit}
        resource={selectedResource}
      />
      <Modal isOpen={deleteModalOpen} toggle={toggleDeleteModal}>
        <ModalHeader toggle={toggleDeleteModal}>Confirm Deletion</ModalHeader>
        <ModalBody>
          Are you sure you want to delete this resource? This action cannot be undone.
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggleDeleteModal} disabled={loading}>
            Cancel
          </Button>
          <Button color="danger" onClick={confirmDelete} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Delete'}
          </Button>
        </ModalFooter>
      </Modal>
    </Container>
  );
};

ResourceListTable.propTypes = {
  resources: PropTypes.array.isRequired,
  pagination: PropTypes.object,
  refreshResources: PropTypes.func.isRequired
};

export default ResourceListTable;

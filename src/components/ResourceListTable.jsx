// src/components/ResourceListTable.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Table, Badge, Button, Container } from 'reactstrap';
import { AdminEditResourceModal } from './admin/modals/AdminEditResourceModel';
import { useAdminModal } from '../hooks/admin/useAdminModal';
import { adminResourceService } from '../services/admin/adminResourceService';

const ResourceListTable = ({ resources, pagination, refreshResources }) => {
  const [editResourceModalOpen, toggleEditResourceModal] = useAdminModal();
  const [selectedResource, setSelectedResource] = useState(null);

  const handleEdit = async (formData) => {
    const { resource_id, ...data } = formData;
    try {
      const update = await adminResourceService.updateResource(resource_id, data);
      if (update) {
        toggleEditResourceModal();
        alert('Resource Updated');
          refreshResources();
      } else {
        alert('Resource Update Failed');
      }
    } catch (error) {
      console.error('Resource Update Failed:', error);
    }
  };

  const handleDelete = (id) => {
    console.log('Delete Resource ID:', id);
  };

  const handleSelectedResource = (resource) => {
    setSelectedResource(resource);
    toggleEditResourceModal();
  };

  return (
    <Container className="my-4">
      <Table hover responsive>
        <thead>
          <tr>
            <th>Resource ID</th>  
            <th>Name</th>
            <th>Url</th>
            <td>Material Type</td>
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
                >
                  Delete
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
    </Container>
  );
};

ResourceListTable.propTypes = {
  resources: PropTypes.array.isRequired,
  pagination: PropTypes.object,
  refreshResources: PropTypes.func.isRequired  // New prop for refreshing data
};

export default ResourceListTable;

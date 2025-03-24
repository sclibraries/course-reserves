import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Alert } from 'reactstrap';
import { useAdminModal } from '../../../hooks/admin/useAdminModal';
import { AdminEditResourceModal } from '../../admin/modals/AdminEditResourceModel';
import { adminResourceService } from '../../../services/admin/adminResourceService';
import { toast } from 'react-toastify';

// Constants
const TABLE_HEADERS = [
  { key: 'name', label: 'Name' },
  { key: 'item_url', label: 'Item URL' },
  { key: 'description', label: 'Description' },
  { key: 'material_type_name', label: 'Type' },
  { key: 'action', label: 'Action' },
];

const ResourceTableRow = React.memo(({ resource, onUnlink, handleSelectedResource }) => (
  <tr className="resource-row">
    <td className="text-break">{resource.name}</td>
    <td className="text-break">
      {resource.item_url ? (
        <a 
          href={resource.item_url} 
          target="_blank" 
          rel="noreferrer noopener"
          className="resource-link"
        >
          {resource.item_url}
        </a>
      ) : (
        <span className="text-muted">N/A</span>
      )}
    </td>
    <td className="text-break">{resource.description || '—'}</td>
    <td>{resource.material_type_name || '—'}</td>
    <td>
      <Button
        color="danger"
        size="sm"
        onClick={() => onUnlink(resource.course_resource_id)}
        aria-label={`Unlink ${resource.name}`}
      >
        Unlink
      </Button>
      <Button 
        color="primary" 
        size="sm" 
        className="mr-2" 
        onClick={() => handleSelectedResource(resource)}
      >
        Edit  
      </Button>
    </td>
  </tr>
));

ResourceTableRow.propTypes = {
  resource: PropTypes.shape({
    resource_id: PropTypes.string.isRequired,
    name: PropTypes.string,
    item_url: PropTypes.string,
    description: PropTypes.string,
    material_type_name: PropTypes.string,
    course_resource_id: PropTypes.string,
  }).isRequired,
  onUnlink: PropTypes.func.isRequired,
  handleSelectedResource: PropTypes.func.isRequired,
};

ResourceTableRow.displayName = 'ResourceTableRow';

export const AdminResourceTable = ({ resources, unlink, handleUpdateResources }) => {
    const [selectedResource, setSelectedResource] = useState(null);
    const [editResourceModalOpen, toggleEditResourceModal] = useAdminModal();

    console.log(selectedResource)
    
    // Open the edit modal for the selected resource
    const handleSelectedResource = (resource) => {
      setSelectedResource(resource);
      toggleEditResourceModal();
    };

    const PROXY_PREFIX = "https://libproxy.smith.edu/login?url=";

    // Toggle delete confirmation modal  
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
  

      const handleEdit = async (formData) => {
        const { resource_id, ...data } = formData;
        adjustProxy(data);
        try {
          const update = await adminResourceService.updateResource(resource_id, data);
          if (update) {
            toggleEditResourceModal();
            handleUpdateResources();
            toast.success('Resource updated successfully');
          } else {
            toast.error('Resource update failed');
          }
        } catch (error) {
          console.error('Resource Update Failed:', error);
          toast.error('Resource update failed' + error);
        }
      };

  if (!resources?.length) {
    return (
      <Alert color="info" className="text-center">
        No resources available. Add some resources to get started.
      </Alert>
    );
  }

  return (
    <div className="admin-resource-table">
      <Table bordered responsive hover>
        <thead>
          <tr>
            {TABLE_HEADERS.map(({ key, label }) => (
              <th key={key}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <ResourceTableRow
              key={resource.resource_id}
              resource={resource}
              onUnlink={unlink}
              handleSelectedResource={handleSelectedResource}
            />
          ))}
        </tbody>
      </Table>
      <AdminEditResourceModal
        isOpen={editResourceModalOpen}
        toggle={toggleEditResourceModal}
        onSubmit={handleEdit}
        resource={selectedResource}
      />
    </div>
  );
};

AdminResourceTable.propTypes = {
  resources: PropTypes.arrayOf(
    PropTypes.shape({
      resource_id: PropTypes.string.isRequired,
      name: PropTypes.string,
      item_url: PropTypes.string,
      description: PropTypes.string,
      material_type_name: PropTypes.string,
      course_resource_id: PropTypes.string,
    })
  ).isRequired,
  unlink: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  handleUpdateResources: PropTypes.func.isRequired,
};
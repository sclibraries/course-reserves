/**
 * @file AdminResourceTable component
 * @module AdminResourceTable
 * @description Displays a table of electronic resources associated with a course.
 * Supports unlinking resources from courses and editing resource details.
 * @requires react
 * @requires prop-types
 * @requires reactstrap
 * @requires react-toastify
 * @requires ../../../hooks/admin/useAdminModal
 * @requires ../../../services/admin/adminResourceService
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Alert } from 'reactstrap';
import { useAdminModal } from '../../../hooks/admin/useAdminModal';
import { AdminEditResourceModal } from '../../admin/modals/AdminEditResourceModel';
import { adminResourceService } from '../../../services/admin/adminResourceService';
import { toast } from 'react-toastify';

/**
 * Configuration for table headers
 * @constant {Array<{key: string, label: string}>}
 */
const TABLE_HEADERS = [
  { key: 'name', label: 'Name' },
  { key: 'item_url', label: 'Item URL' },
  { key: 'description', label: 'Description' },
  { key: 'material_type_name', label: 'Type' },
  { key: 'action', label: 'Action' },
];

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
  course_resource_id: PropTypes.string,
  links: PropTypes.arrayOf(PropTypes.shape({
    link_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    url: PropTypes.string.isRequired,
    title: PropTypes.string,
    description: PropTypes.string,
    use_proxy: PropTypes.bool
  }))
});

/**
 * Adjusts the proxy settings in a resource URL
 * 
 * Adds or removes the proxy prefix based on the use_proxy flag.
 * 
 * @function
 * @param {Object} data - Resource data
 * @param {string} data.link - The URL to adjust
 * @param {number} data.use_proxy - Whether to use proxy (1) or not (0)
 * @throws {Error} If data or link property is invalid
 * @returns {void}
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
 * Individual table row for a resource
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.resource - Resource data
 * @param {Function} props.onUnlink - Handler for unlinking a resource
 * @param {Function} props.handleSelectedResource - Handler for selecting a resource to edit
 * @returns {JSX.Element} Rendered table row
 */
const ResourceTableRow = React.memo(({ resource, onUnlink, handleSelectedResource }) => {
  const [showAdditionalLinks, setShowAdditionalLinks] = useState(false);
  
  // Check if we have additional links
  const hasAdditionalLinks = resource.links && resource.links.length > 0;
  console.log(resource)
  return (
    <>
      <tr className="resource-row">
        <td className="text-break">{resource.name}</td>
        <td className="text-break">
          {resource.item_url ? (
            <div>
              <a 
                href={resource.item_url} 
                target="_blank" 
                rel="noreferrer noopener"
                className="resource-link"
                aria-label={`Open ${resource.name} link in new tab`}
              >
                {resource.item_url}
              </a>
              
              {/* Show toggle button for additional links if they exist */}
              {hasAdditionalLinks && (
                <Button
                  color="link"
                  size="sm"
                  className="ms-2 p-0"
                  onClick={() => setShowAdditionalLinks(!showAdditionalLinks)}
                >
                  <span className="badge bg-primary">
                    {resource.links.length} additional {resource.links.length === 1 ? 'link' : 'links'}
                  </span>
                </Button>
              )}
            </div>
          ) : (
            <span className="text-muted">
              {hasAdditionalLinks ? (
                <Button
                  color="link"
                  size="sm" 
                  className="p-0"
                  onClick={() => setShowAdditionalLinks(!showAdditionalLinks)}
                >
                  <span className="badge bg-primary">
                    {resource.links.length} {resource.links.length === 1 ? 'link' : 'links'} available
                  </span>
                </Button>
              ) : (
                'N/A'
              )}
            </span>
          )}
        </td>
        <td className="text-break">{resource.description || '—'}</td>
        <td>{resource.material_type_name || '—'}</td>
        <td>
          <div className="d-flex gap-2">
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
              onClick={() => handleSelectedResource(resource)}
              aria-label={`Edit ${resource.name}`}
            >
              Edit  
            </Button>
          </div>
        </td>
      </tr>
      
      {/* Additional Links Row - Shown when expanded */}
      {showAdditionalLinks && (
        <tr className="additional-links-row bg-light">
          <td colSpan={5}>
            <div className="p-3">
              <h6>Additional Links</h6>
              <ul className="list-group">
                {resource.links.map((link, index) => (
                  <li key={link.link_id || index} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-top">
                      <div>
                        {link.title && <strong className="d-block">{link.title}</strong>}
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noreferrer noopener"
                          className="resource-link d-block text-truncate"
                          style={{ maxWidth: '500px' }}
                        >
                          {link.url}
                        </a>
                        {link.description && <div className="text-muted small mt-1">{link.description}</div>}
                      </div>
                      <div>
                        {link.use_proxy && (
                          <span className="badge bg-secondary ms-2">Proxy Enabled</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

ResourceTableRow.propTypes = {
  resource: resourceShape.isRequired,
  onUnlink: PropTypes.func.isRequired,
  handleSelectedResource: PropTypes.func.isRequired,
};

ResourceTableRow.displayName = 'ResourceTableRow';

/**
 * Administrative resource table component
 * 
 * Displays a table of resources with options to edit and unlink.
 * Includes modal for editing resource details.
 * 
 * @component
 * @example
 * const resources = [
 *   {
 *     resource_id: '123',
 *     name: 'Introduction to React',
 *     item_url: 'https://example.com/resource',
 *     description: 'A guide to React',
 *     material_type_name: 'E-Book',
 *     course_resource_id: '456'
 *   }
 * ];
 * 
 * return (
 *   <AdminResourceTable 
 *     resources={resources}
 *     unlink={handleUnlink}
 *     handleUpdateResources={refreshResources}
 *   />
 * );
 * 
 * @param {Object} props - Component props
 * @param {Array<Object>} props.resources - List of resources to display
 * @param {Function} props.unlink - Handler for unlinking resources
 * @param {Function} props.handleUpdateResources - Function to refresh resources after updates
 * @returns {JSX.Element} Resource table or empty state message
 */
export const AdminResourceTable = ({ 
  resources, 
  unlink, 
  handleUpdateResources 
}) => {
  /**
   * Currently selected resource for editing
   * @type {Object|null}
   */
  const [selectedResource, setSelectedResource] = useState(null);
  
  /**
   * Modal state and toggle from custom hook
   * @type {[boolean, Function]}
   */
  const [editResourceModalOpen, toggleEditResourceModal] = useAdminModal();

  /**
   * Opens the edit modal for a selected resource
   * 
   * @function
   * @param {Object} resource - The resource to edit
   * @returns {void}
   */
  const handleSelectedResource = (resource) => {
    setSelectedResource(resource);
    toggleEditResourceModal();
  };

  /**
   * Handle resource edit form submission
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
        handleUpdateResources();
        toast.success('Resource updated successfully');
      } else {
        toast.error('Resource update failed');
      }
    } catch (error) {
      console.error('Resource Update Failed:', error);
      toast.error(`Resource update failed: ${error.message || 'Unknown error'}`);
    }
  };

  // Show message if no resources are available
  if (!resources?.length) {
    return (
      <Alert color="info" className="text-center">
        No resources available. Add some resources to get started.
      </Alert>
    );
  }

  return (
    <div className="admin-resource-table">
      {/* Resources Table */}
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

      {/* Edit Resource Modal */}
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
  resources: PropTypes.arrayOf(resourceShape).isRequired,
  unlink: PropTypes.func.isRequired,
  handleUpdateResources: PropTypes.func.isRequired,
};
/**
 * @file AdminResourceTable component
 * @module AdminResourceTable
 * @description Displays a table of electronic resources associated with a course.
 * Supports unlinking resources from courses, editing resource details, and drag-and-drop reordering.
 * @requires react
 * @requires prop-types
 * @requires reactstrap
 * @requires react-toastify
 * @requires ../../../hooks/admin/useAdminModal
 * @requires ../../../services/admin/adminResourceService
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Alert } from 'reactstrap';
import { useAdminModal } from '../../../hooks/admin/useAdminModal';
import { AdminEditResourceModal } from '../../admin/modals/AdminEditResourceModel';
import { adminResourceService } from '../../../services/admin/adminResourceService';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useDrag, useDrop } from 'react-dnd';

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
 * Define item type for drag and drop
 * @constant {string}
 */
const RESOURCE_ITEM_TYPE = 'resource';

/**
 * Individual table row for a resource with drag-and-drop functionality
 */
const DraggableResourceRow = ({ 
  resource, 
  onUnlink, 
  handleSelectedResource,
  index,
  moveRow,
  onDrop
}) => {
  const [showAdditionalLinks, setShowAdditionalLinks] = useState(false);
  const hasAdditionalLinks = resource.links && resource.links.length > 0;
  const ref = useRef(null);
  
  const [, drop] = useDrop({
    accept: RESOURCE_ITEM_TYPE,
    hover(item) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;
      
      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      
      moveRow(dragIndex, hoverIndex);
      
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for performance reasons
      item.index = hoverIndex;
    },
    drop() {
        onDrop && onDrop();
    }
  });
  
  const [{ isDragging }, drag] = useDrag({
    type: RESOURCE_ITEM_TYPE,
    item: { id: resource.resource_id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  
  // Initialize drag and drop refs
  drag(drop(ref));
  
  return (
    <>
      <tr 
        ref={ref} 
        className={isDragging ? 'dragging' : ''}
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
        <td className="drag-handle">
          <FontAwesomeIcon icon="fa-solid fa-grip-vertical" />
        </td>
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
      
      {showAdditionalLinks && (
        <tr className="additional-links-row bg-light">
          <td colSpan={6}>
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
};

DraggableResourceRow.propTypes = {
  resource: resourceShape.isRequired,
  onUnlink: PropTypes.func.isRequired,
  handleSelectedResource: PropTypes.func.isRequired,
  index: PropTypes.number.isRequired,
  moveRow: PropTypes.func.isRequired,
  onDrop: PropTypes.func.isRequired
};

/**
 * Administrative resource table component
 */
export const AdminResourceTable = ({ 
  resources, 
  unlink, 
  onReorder,
  handleUpdateResources 
}) => {
  const [selectedResource, setSelectedResource] = useState(null);
  const [editResourceModalOpen, toggleEditResourceModal] = useAdminModal();
  const [sortedResources, setSortedResources] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Initialize resources with order
  useEffect(() => {
    if (!Array.isArray(resources)) {
      setSortedResources([]);
      return;
    }
    
    const resourcesWithOrder = resources.map((res, index) => ({
      ...res,
      order: res.order || index + 1
    }));
    
    resourcesWithOrder.sort((a, b) => a.order - b.order);
    setSortedResources(resourcesWithOrder);
  }, [resources]);
  
  // Handle moving rows (drag and drop)
  const moveRow = useCallback(
    (dragIndex, hoverIndex) => {
      setIsDragging(true);
      const draggedRow = sortedResources[dragIndex];
      const newOrder = [...sortedResources];
      
      // Remove the dragged item
      newOrder.splice(dragIndex, 1);
      // Insert it at the new position
      newOrder.splice(hoverIndex, 0, draggedRow);
      
      // Update order property on each item
      const updatedItems = newOrder.map((item, index) => ({
        ...item,
        order: index + 1
      }));
      
      setSortedResources(updatedItems);
    },
    [sortedResources],
  );
  
  // Save the new order when drag ends
  const handleDragEnd = useCallback(() => {
    if (onReorder && sortedResources.length > 0 && isDragging) {
      console.log('Saving electronic resource order to backend');
      onReorder(sortedResources);
      setIsDragging(false);
    }
  }, [sortedResources, onReorder, isDragging]);
  
  const handleSelectedResource = (resource) => {
    setSelectedResource(resource);
    toggleEditResourceModal();
  };

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

  if (!resources?.length) {
    return (
      <Alert color="info" className="text-center">
        No resources available. Add some resources to get started.
      </Alert>
    );
  }

  return (
    <div className="admin-resource-table">
      <div className="mb-3">
        <small className="text-muted">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-1" />
          Drag and drop resources to reorder them.
        </small>
      </div>
      
      <Table bordered responsive hover>
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            {TABLE_HEADERS.map(({ key, label }) => (
              <th key={key}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedResources.map((resource, index) => (
            <DraggableResourceRow
              key={resource.resource_id}
              resource={resource}
              onUnlink={unlink}
              handleSelectedResource={handleSelectedResource}
              index={index}
              moveRow={moveRow}
              onDrop={handleDragEnd}
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
  resources: PropTypes.arrayOf(resourceShape).isRequired,
  unlink: PropTypes.func.isRequired,
  onReorder: PropTypes.func,
  handleUpdateResources: PropTypes.func.isRequired,
};
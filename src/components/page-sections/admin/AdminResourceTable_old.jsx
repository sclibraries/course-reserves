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
  { key: 'notes', label: 'Notes' },
  { key: 'material_type_name', label: 'Type' },
  { key: 'action', label: 'Action' },
];

/**
 * Resource shape definition for PropTypes
 * @constant {Object}
 */
const resourceShape = PropTypes.shape({
  resource_id: PropTypes.string.isRequired,
  name: PropTypes.string,
  item_url: PropTypes.string,
  description: PropTypes.string,
  internal_note: PropTypes.string,
  external_note: PropTypes.string,
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
  const [showFullNotes, setShowFullNotes] = useState(false);
  const hasAdditionalLinks = resource.links && resource.links.length > 0;
  
  // Check if there are notes to display
  const hasInternalNote = resource.internal_note && resource.internal_note.trim() !== '';
  const hasExternalNote = resource.external_note && resource.external_note.trim() !== '';
  const hasAnyNotes = hasInternalNote || hasExternalNote;
  
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
        <td className="notes-column" style={{ maxWidth: '200px', fontSize: '0.9em' }}>
          {hasAnyNotes ? (
            <div>
              {hasInternalNote && (
                <div className="mb-1">
                  <span className="badge bg-danger text-white me-1" style={{ fontSize: '0.7em' }}>
                    <strong>Internal</strong>
                  </span>
                  <div className="text-dark" style={{ fontSize: '0.85em', fontWeight: '500' }}>
                    {resource.internal_note.length > 60 ? (
                      <>
                        {showFullNotes ? resource.internal_note : `${resource.internal_note.substring(0, 60)}...`}
                        <Button
                          color="link"
                          size="sm"
                          className="p-0 ms-1 text-primary"
                          style={{ fontSize: '0.75em' }}
                          onClick={() => setShowFullNotes(!showFullNotes)}
                        >
                          {showFullNotes ? 'Less' : 'More'}
                        </Button>
                      </>
                    ) : (
                      resource.internal_note
                    )}
                  </div>
                </div>
              )}
              {hasExternalNote && (
                <div>
                  <span className="badge bg-info text-white me-1" style={{ fontSize: '0.7em' }}>External</span>
                  <div className="text-muted" style={{ fontSize: '0.85em' }}>
                    {resource.external_note.length > 60 ? (
                      <>
                        {showFullNotes ? resource.external_note : `${resource.external_note.substring(0, 60)}...`}
                        <Button
                          color="link"
                          size="sm"
                          className="p-0 ms-1"
                          style={{ fontSize: '0.75em' }}
                          onClick={() => setShowFullNotes(!showFullNotes)}
                        >
                          {showFullNotes ? 'Less' : 'More'}
                        </Button>
                      </>
                    ) : (
                      resource.external_note
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            '—'
          )}
        </td>
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
          <td colSpan={7}>
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
 * Static (non-draggable) row component for sorted resources
 */
const StaticResourceRow = ({ 
  resource, 
  onUnlink, 
  handleSelectedResource
}) => {
  const [showAdditionalLinks, setShowAdditionalLinks] = useState(false);
  const [showFullNotes, setShowFullNotes] = useState(false);
  const hasAdditionalLinks = resource.links && resource.links.length > 0;
  
  // Check if there are notes to display
  const hasInternalNote = resource.internal_note && resource.internal_note.trim() !== '';
  const hasExternalNote = resource.external_note && resource.external_note.trim() !== '';
  const hasAnyNotes = hasInternalNote || hasExternalNote;
  
  return (
    <>
      <tr>
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
        <td className="notes-column" style={{ maxWidth: '200px', fontSize: '0.9em' }}>
          {hasAnyNotes ? (
            <div>
              {hasInternalNote && (
                <div className="mb-1">
                  <span className="badge bg-danger text-white me-1" style={{ fontSize: '0.7em' }}>
                    <strong>Internal</strong>
                  </span>
                  <div className="text-dark" style={{ fontSize: '0.85em', fontWeight: '500' }}>
                    {resource.internal_note.length > 60 ? (
                      <>
                        {showFullNotes ? resource.internal_note : `${resource.internal_note.substring(0, 60)}...`}
                        <Button
                          color="link"
                          size="sm"
                          className="p-0 ms-1 text-primary"
                          style={{ fontSize: '0.75em' }}
                          onClick={() => setShowFullNotes(!showFullNotes)}
                        >
                          {showFullNotes ? 'Less' : 'More'}
                        </Button>
                      </>
                    ) : (
                      resource.internal_note
                    )}
                  </div>
                </div>
              )}
              {hasExternalNote && (
                <div>
                  <span className="badge bg-info text-white me-1" style={{ fontSize: '0.7em' }}>External</span>
                  <div className="text-muted" style={{ fontSize: '0.85em' }}>
                    {resource.external_note.length > 60 ? (
                      <>
                        {showFullNotes ? resource.external_note : `${resource.external_note.substring(0, 60)}...`}
                        <Button
                          color="link"
                          size="sm"
                          className="p-0 ms-1"
                          style={{ fontSize: '0.75em' }}
                          onClick={() => setShowFullNotes(!showFullNotes)}
                        >
                          {showFullNotes ? 'Less' : 'More'}
                        </Button>
                      </>
                    ) : (
                      resource.external_note
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            '—'
          )}
        </td>
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

StaticResourceRow.propTypes = {
  resource: resourceShape.isRequired,
  onUnlink: PropTypes.func.isRequired,
  handleSelectedResource: PropTypes.func.isRequired
};

/**
 * Administrative resource table component
 */
export const AdminResourceTable = ({ 
  resources, 
  unlink, 
  onReorder,
  editResourceModal,
  currentSort: externalCurrentSort,
  onSortChange: externalOnSortChange,
  isDropdownOpen: externalIsDropdownOpen,
  setDropdownOpen: externalSetDropdownOpen
}) => {
  // Remove the local useResourceFormModal since we're using the one passed as prop
  const [isDragging, setIsDragging] = useState(false);
  const [sortedResources, setSortedResources] = useState([]);

  // Get sort state from Zustand store, fallback to props for unified view
  const { 
    electronicSort, 
    setElectronicSort
  } = useResourceSortStore();
  
  // Use external sort state if provided (unified view), fallback to store state (split view)
  const [internalIsDropdownOpen, setInternalDropdownOpen] = useState(false);
  
  const currentSort = externalCurrentSort !== undefined ? externalCurrentSort : electronicSort;
  const onSortChange = externalOnSortChange || setElectronicSort;
  const isDropdownOpen = externalIsDropdownOpen !== undefined ? externalIsDropdownOpen : internalIsDropdownOpen;
  const setDropdownOpen = externalSetDropdownOpen || setInternalDropdownOpen;

  // Handle sort change
  const handleSortChange = useCallback((newSortType) => {
    onSortChange(newSortType);
    
    if (isManualSort(newSortType)) {
      // For manual sort, don't change the order - just update the sorting method
      return;
    }
    
    // Apply the new sort and update backend if not manual
    const sortedData = applySortOrder(sortedResources.map(res => ({
      ...res,
      resourceType: 'electronic' // Add resourceType for sorting
    })), newSortType);
    
    // Remove the temporary resourceType we added
    const cleanedData = sortedData.map(({ resourceType: _, ...rest }) => rest);
    setSortedResources(cleanedData);
    
    // Send the new order to the backend
    if (onReorder && cleanedData.length > 0) {
      onReorder(cleanedData);
    }
  }, [sortedResources, onReorder, onSortChange, setSortedResources]);
  
  // Initialize resources with order and store in Zustand if in split view
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
  }, [resources, setSortedResources, externalCurrentSort]);
  
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
    [sortedResources, setSortedResources],
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
    editResourceModal.openEditResourceForm(resource);
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
      <ResourceSortDropdown
        currentSort={currentSort}
        onSortChange={handleSortChange}
        isDropdownOpen={isDropdownOpen}
        setDropdownOpen={setDropdownOpen}
      />
      
      <div className="mb-3">
        <small className="text-muted">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-1" />
          {currentSort === 'manual' 
            ? 'Drag and drop resources to reorder them.'
            : `Resources are sorted by ${currentSort.replace('-', ' ')}. Switch to Manual to enable drag and drop.`
          }
        </small>
      </div>
      
      <Table bordered responsive hover>
        <thead>
          <tr>
            {currentSort === 'manual' && <th style={{ width: '40px' }}></th>}
            {TABLE_HEADERS.map(({ key, label }) => (
              <th 
                key={key}
                style={key === 'notes' ? { width: '200px', minWidth: '150px' } : {}}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedResources.map((resource, index) => (
            currentSort === 'manual' ? (
              <DraggableResourceRow
                key={resource.resource_id}
                resource={resource}
                onUnlink={unlink}
                handleSelectedResource={handleSelectedResource}
                index={index}
                moveRow={moveRow}
                onDrop={handleDragEnd}
              />
            ) : (
              <StaticResourceRow
                key={resource.resource_id}
                resource={resource}
                onUnlink={unlink}
                handleSelectedResource={handleSelectedResource}
              />
            )
          ))}
        </tbody>
      </Table>
    </div>
  );
};

AdminResourceTable.propTypes = {
  resources: PropTypes.arrayOf(resourceShape).isRequired,
  unlink: PropTypes.func.isRequired,
  onReorder: PropTypes.func,
  editResourceModal: PropTypes.shape({
    openEditResourceForm: PropTypes.func.isRequired
  }).isRequired,
  currentSort: PropTypes.string,
  onSortChange: PropTypes.func,
  isDropdownOpen: PropTypes.bool,
  setDropdownOpen: PropTypes.func
};
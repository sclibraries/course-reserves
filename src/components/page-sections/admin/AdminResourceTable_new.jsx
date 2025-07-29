/**
 * @file AdminResourceTable component - Simplified view-only version
 * @module AdminResourceTable
 * @description Displays a table of electronic resources associated with a course.
 * This is now a view-only component that inherits sort order from the unified table.
 */

import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

/**
 * Resource shape definition for PropTypes
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
 * Static resource row component
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
 * Administrative resource table component - View only, inherits sort from unified table
 */
export const AdminResourceTable = ({ 
  resources, 
  unlink, 
  editResourceModal
}) => {
  const [sortedResources, setSortedResources] = useState([]);

  const handleSelectedResource = useCallback((resource) => {
    editResourceModal.openEditForm({ resource });
  }, [editResourceModal]);

  // Initialize sorted resources with order (inherits from unified table)
  useEffect(() => {
    if (!resources || resources.length === 0) {
      setSortedResources([]);
      return;
    }

    const resourcesWithOrder = resources.map((resource, index) => ({
      ...resource,
      order: resource.order || index + 1,
    }));

    // Sort by order (inherits from unified table)
    resourcesWithOrder.sort((a, b) => a.order - b.order);
    setSortedResources(resourcesWithOrder);
  }, [resources]);

  if (!sortedResources.length) {
    return (
      <Alert color="info">No electronic resources available.</Alert>
    );
  }

  return (
    <div className="admin-resource-table">
      <div className="mb-3">
        <small className="text-muted">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-1" />
          Resource order is controlled by the unified table view. Switch to &ldquo;Unified Table&rdquo; to modify sorting.
        </small>
      </div>
      
      <Table bordered responsive hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Item URL</th>
            <th>Description</th>
            <th>Notes</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedResources.map((resource) => (
            <StaticResourceRow
              key={resource.resource_id}
              resource={resource}
              onUnlink={unlink}
              handleSelectedResource={handleSelectedResource}
            />
          ))}
        </tbody>
      </Table>
    </div>
  );
};

AdminResourceTable.propTypes = {
  resources: PropTypes.arrayOf(resourceShape),
  unlink: PropTypes.func.isRequired,
  editResourceModal: PropTypes.shape({
    openEditForm: PropTypes.func.isRequired
  }).isRequired
};

export default AdminResourceTable;

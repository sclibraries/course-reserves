import React from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Alert } from 'reactstrap';

// Constants
const TABLE_HEADERS = [
  { key: 'name', label: 'Name' },
  { key: 'item_url', label: 'Item URL' },
  { key: 'description', label: 'Description' },
  { key: 'material_type_name', label: 'Type' },
  { key: 'action', label: 'Action' },
];

const ResourceTableRow = React.memo(({ resource, onUnlink }) => (
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
};

ResourceTableRow.displayName = 'ResourceTableRow';

export const AdminResourceTable = ({ resources, unlink }) => {
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
            />
          ))}
        </tbody>
      </Table>
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
};
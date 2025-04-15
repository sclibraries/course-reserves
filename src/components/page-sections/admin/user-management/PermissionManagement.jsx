import React, { useState } from 'react';
import { 
  Card, CardHeader, CardBody, Table, Spinner, Button, 
  Badge, TabContent, TabPane, Nav, NavItem, NavLink, 
  Row, Col, FormGroup, Label, Input, Alert
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';
import classnames from 'classnames';

const PermissionManagement = ({ 
  permissions, 
  availablePermissions, 
  loading, 
  updating, 
  togglePermission 
}) => {
  const [activeTab, setActiveTab] = useState(Object.keys(permissions)[0] || '');
  const [expandedInfo, setExpandedInfo] = useState({});
  
  // Toggle info panel for a permission
  const toggleInfo = (permKey) => {
    setExpandedInfo(prev => ({
      ...prev,
      [permKey]: !prev[permKey]
    }));
  };
  
  // Get a more readable description for a permission key
  const getPermissionDescription = (key) => {
    const descriptions = {
      'manage_courses': 'Allows users to create, edit, and manage courses in the system.',
      'manage_resources': 'Allows users to add, edit, and remove resources from courses.',
      'view_reports': 'Provides access to view usage and tracking reports.',
      'customize_smith.edu': 'Allows customization of Smith College\'s branding and settings.',
      'customize_hampshire.edu': 'Allows customization of Hampshire College\'s branding and settings.',
      'customize_amherst.edu': 'Allows customization of Amherst College\'s branding and settings.',
      'customize_mtholyoke.edu': 'Allows customization of Mount Holyoke College\'s branding and settings.',
      'customize_umass.edu': 'Allows customization of UMass Amherst\'s branding and settings.'
    };
    
    return descriptions[key] || 'No description available';
  };
  
  if (loading) {
    return (
      <Card className="shadow-sm mb-4">
        <CardHeader className="bg-white">
          <h5 className="mb-0">Institution Permissions</h5>
        </CardHeader>
        <CardBody className="text-center py-5">
          <Spinner color="primary" />
          <p className="mt-3 text-muted">Loading permissions...</p>
        </CardBody>
      </Card>
    );
  }
  
  // Check if we have permissions data
  const institutionKeys = Object.keys(permissions);
  if (institutionKeys.length === 0) {
    return (
      <Card className="shadow-sm mb-4">
        <CardHeader className="bg-white">
          <h5 className="mb-0">Institution Permissions</h5>
        </CardHeader>
        <CardBody>
          <Alert color="info">
            No permissions found. The system may not be configured for institutional permissions.
          </Alert>
        </CardBody>
      </Card>
    );
  }
  
  return (
    <Card className="shadow-sm mb-4">
      <CardHeader className="bg-white">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Institution Permissions</h5>
          <span className="text-muted small">
            Manage what features each institution can access
          </span>
        </div>
      </CardHeader>
      <CardBody>
        <Nav tabs className="mb-3">
          {institutionKeys.map(institution => (
            <NavItem key={institution}>
              <NavLink
                className={classnames({ active: activeTab === institution })}
                onClick={() => setActiveTab(institution)}
                style={{ cursor: 'pointer' }}
              >
                {availablePermissions.institutions[institution] || institution}
                <Badge color="light" className="ms-2" pill>
                  {permissions[institution].filter(p => p.granted).length}
                  /{permissions[institution].length}
                </Badge>
              </NavLink>
            </NavItem>
          ))}
        </Nav>
        
        <TabContent activeTab={activeTab}>
          {institutionKeys.map(institution => (
            <TabPane key={institution} tabId={institution}>
              <Table bordered hover responsive>
                <thead>
                  <tr>
                    <th className="w-25">Permission</th>
                    <th className="w-50">Description</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions[institution].map(permission => (
                    <React.Fragment key={permission.id}>
                      <tr>
                        <td>
                          {availablePermissions.permissions[permission.permission_key] || permission.permission_key}
                          <Button
                            color="link"
                            size="sm"
                            className="p-0 ms-2"
                            onClick={() => toggleInfo(permission.permission_key)}
                          >
                            <FontAwesomeIcon 
                              icon={expandedInfo[permission.permission_key] ? 'chevron-up' : 'info-circle'} 
                              size="sm"
                            />
                          </Button>
                        </td>
                        <td>
                          {getPermissionDescription(permission.permission_key)}
                        </td>
                        <td className="text-center">
                          <Badge color={permission.granted ? 'success' : 'danger'} pill>
                            {permission.granted ? 'Granted' : 'Denied'}
                          </Badge>
                        </td>
                        <td className="text-center">
                          <Button
                            color={permission.granted ? 'danger' : 'success'}
                            size="sm"
                            onClick={() => togglePermission(permission.id)}
                            disabled={updating}
                          >
                            {updating ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <FontAwesomeIcon 
                                  icon={permission.granted ? 'ban' : 'check'} 
                                  className="me-1"
                                />
                                {permission.granted ? 'Revoke' : 'Grant'}
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                      {expandedInfo[permission.permission_key] && (
                        <tr className="bg-light">
                          <td colSpan="4" className="p-3">
                            <div className="d-flex">
                              <div className="me-3">
                                <FontAwesomeIcon icon="info-circle" className="text-primary" size="lg" />
                              </div>
                              <div>
                                <h6>About this permission</h6>
                                <p className="mb-2">{getPermissionDescription(permission.permission_key)}</p>
                                <p className="small text-muted mb-0">
                                  Last updated: {new Date(permission.updated_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </Table>
            </TabPane>
          ))}
        </TabContent>
      </CardBody>
    </Card>
  );
};

PermissionManagement.propTypes = {
  permissions: PropTypes.object.isRequired,
  availablePermissions: PropTypes.object.isRequired,
  loading: PropTypes.bool.isRequired,
  updating: PropTypes.bool.isRequired,
  togglePermission: PropTypes.func.isRequired
};

export default PermissionManagement;

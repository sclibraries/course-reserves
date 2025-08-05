import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Card, CardHeader, CardBody, Table, ButtonGroup, Alert } from 'reactstrap';
import { AdminResourceTable } from '../../admin/AdminResourceTable';
import AdminPrintResourceTable from './AdminPrintResourceTable';
import AdminResourceActions from './AdminResourceActions';
import EmptyState from './EmptyState';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import UnifiedResourceTable from '../../admin/UnifiedResourceTable';
import { useResourceSortStore } from '../../../../store/resourceSortStore';

function AdminResourcesTabs({
  course,
  resources,
  printResources,
  linkedCourses,
  toggleNewResourceModal,
  toggleEDSResourceModal,
  toggleHitchcockModal,
  toggleReuseModal,
  toggleCrossLinkModal,
  unlinkResource,
  handleUpdateResources,
  handleUnifiedReorder,
  buildFolioCourseUrl,
  navigate,
  editResourceModal
}) {
  const [activeTab, setActiveTab] = useState('resources');
  const [resourceView, setResourceView] = useState('unified'); // 'unified' or 'separate' - unified first for better UX
  
  // Use Zustand store for sort state management
  const { 
    unifiedSort, 
    setUnifiedSort
  } = useResourceSortStore();

  // Refresh data from backend whenever view changes to ensure sync
  useEffect(() => {
    // Only refresh if course is available
    if (course?.offering_id) {
      handleUpdateResources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceView]); // Refresh on every view change

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="content-tabs">
        <ul className="custom-tabs">
          <li className={`tab-item ${activeTab === 'resources' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('resources')}>
              <FontAwesomeIcon icon="fa-solid fa-book-open" className="me-2" />
              Resources
            </button>
          </li>
          <li className={`tab-item ${activeTab === 'linkedCourses' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('linkedCourses')}>
              <FontAwesomeIcon icon="fa-solid fa-link" className="me-2" />
              Linked Courses
            </button>
          </li>
        </ul>

        <div className="tab-content">
          {/* Resources Tab */}
          {activeTab === 'resources' && (
            <div className="tab-pane active">
              {/* Resource Action Buttons */}
              <AdminResourceActions 
                toggleNewResourceModal={toggleNewResourceModal}
                toggleEDSResourceModal={toggleEDSResourceModal}
                toggleHitchcockModal={toggleHitchcockModal}
                toggleReuseModal={toggleReuseModal}
                toggleCrossLinkModal={toggleCrossLinkModal}
              />

              {/* View Toggle Buttons */}
              <div className="mb-4 text-end">
                <ButtonGroup>
                  <Button
                    color={resourceView === 'separate' ? 'primary' : 'secondary'}
                    onClick={() => setResourceView('separate')}
                    outline={resourceView !== 'separate'}
                  >
                    <FontAwesomeIcon icon="fa-solid fa-eye" className="me-1" />
                    View by Type
                  </Button>
                  <Button
                    color={resourceView === 'unified' ? 'primary' : 'secondary'}
                    onClick={() => setResourceView('unified')}
                    outline={resourceView !== 'unified'}
                  >
                    <FontAwesomeIcon icon="fa-solid fa-arrows-up-down" className="me-1" />
                    Sort & Manage
                  </Button>
                </ButtonGroup>
              </div>

              {resourceView === 'unified' ? (
                /* Unified Resource Table */
                <Card className="resource-card mb-4">
                  <CardHeader className="resource-card-header">
                    <h5 className="m-0">
                      <FontAwesomeIcon icon="fa-solid fa-layer-group" className="me-2" />
                      All Resources
                    </h5>
                    <Button color="light" className="refresh-btn" onClick={handleUpdateResources}>
                      <FontAwesomeIcon icon="fa-solid fa-arrows-rotate" className="me-1" />
                      Refresh
                    </Button>
                  </CardHeader>
                  <CardBody>
                    {resources.length > 0 || printResources.length > 0 ? (
                      <UnifiedResourceTable
                        electronicResources={resources}
                        printResources={printResources}
                        onReorder={handleUnifiedReorder}
                        unlinkResource={unlinkResource}
                        currentSort={unifiedSort}
                        onSortChange={setUnifiedSort}
                        editResourceModal={editResourceModal}
                      />
                    ) : (
                      <EmptyState 
                        icon="fa-solid fa-circle-info"
                        title="No Resources"
                        message="Add electronic or physical resources to get started."
                        buttonText="Add Resource"
                        buttonAction={toggleNewResourceModal}
                        buttonIcon="fa-solid fa-plus"
                      />
                    )}
                  </CardBody>
                </Card>
              ) : (
                /* Separate Resource Tables */
                <>
                  {/* Info Alert for View-Only Mode */}
                  <Alert color="info" className="mb-4">
                    <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-2" />
                    <strong>View Only Mode:</strong> These tables show resources organized by type. 
                    To sort, reorder, or manage resources, use the &ldquo;Sort &amp; Manage&rdquo; view above.
                  </Alert>

                  {/* Electronic Resources Section */}
                  <Card className="mb-4 resource-card">
                    <CardHeader className="resource-card-header">
                      <h5 className="m-0">
                        <FontAwesomeIcon icon="fa-solid fa-laptop" className="me-2" />
                        Electronic Resources (View Only)
                      </h5>
                      <Button color="light" className="refresh-btn" onClick={handleUpdateResources}>
                        <FontAwesomeIcon icon="fa-solid fa-arrows-rotate" className="me-1" />
                        Refresh
                      </Button>
                    </CardHeader>
                    <CardBody>
                      {resources.length > 0 ? (
                        <AdminResourceTable 
                          resources={resources} 
                          unlink={unlinkResource} 
                          editResourceModal={editResourceModal}
                        />
                      ) : (
                        <EmptyState 
                          icon="fa-solid fa-circle-info"
                          title="No Electronic Resources"
                          message="Add electronic resources using the buttons above."
                          buttonText="Add Resource"
                          buttonAction={toggleNewResourceModal}
                          buttonIcon="fa-solid fa-plus"
                        />
                      )}
                    </CardBody>
                  </Card>

                  {/* Physical Resources Section */}
                  <Card className="resource-card">
                    <CardHeader className="resource-card-header">
                      <h5 className="m-0">
                        <FontAwesomeIcon icon="fa-solid fa-book" className="me-2" />
                        Physical Resources (View Only)
                      </h5>
                      <div>
                        <a 
                          href={buildFolioCourseUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="folio-link-btn me-2"
                        >
                          <FontAwesomeIcon icon="fa-solid fa-external-link-alt" className="me-1" />
                          Manage in FOLIO
                        </a>
                        <Button color="light" className="refresh-btn" onClick={handleUpdateResources}>
                          <FontAwesomeIcon icon="fa-solid fa-arrows-rotate" className="me-1" />
                          Refresh
                        </Button>
                      </div>
                    </CardHeader>
                    <CardBody>
                      <div className="custom-alert info mb-3">
                        <FontAwesomeIcon icon="fa-solid fa-circle-info" className="me-3 mt-1" />
                        <div>
                          Physical resources are managed in FOLIO, but you can reorder them here for display in the course reserves system.
                        </div>
                      </div>
                      
                      {printResources.length > 0 ? (
                        <AdminPrintResourceTable 
                          printResources={printResources}
                        />
                      ) : (
                        <EmptyState 
                          icon="fa-solid fa-box"
                          title="No Physical Resources"
                          message="Add physical resources through FOLIO."
                          linkText="Manage in FOLIO"
                          linkUrl={buildFolioCourseUrl()}
                          linkIcon="fa-solid fa-external-link-alt"
                          isExternalLink={true}
                        />
                      )}
                    </CardBody>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* Linked Courses Tab */}
          {activeTab === 'linkedCourses' && (
            <div className="tab-pane active">
              <Card className="resource-card">
                <CardHeader className="resource-card-header">
                  <h5 className="m-0">
                    <FontAwesomeIcon icon="fa-solid fa-link" className="me-2" />
                    Linked Courses
                  </h5>
                  <Button color="primary" className="add-link-btn" onClick={toggleCrossLinkModal}>
                    <FontAwesomeIcon icon="fa-solid fa-plus" className="me-1" />
                    Cross-link Course
                  </Button>
                </CardHeader>
                <CardBody>
                  {linkedCourses.length > 0 ? (
                    <Table bordered hover responsive className="custom-table">
                      <thead>
                        <tr>
                          <th>Course Name</th>
                          <th>Course Number</th>
                          <th>Term</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedCourses.map(course => (
                          <tr key={course.course_id}>
                            <td>{course.course_name}</td>
                            <td>{course.course_number}</td>
                            <td>{course.term_name}</td>
                            <td>
                              <button 
                                className="view-btn"
                                onClick={() => navigate(`/admin/electronic/${course.folio_course_id}`)}
                              >
                                <FontAwesomeIcon icon="fa-solid fa-arrow-right" className="me-1" />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <EmptyState 
                      icon="fa-solid fa-link-slash"
                      title="No Linked Courses"
                      message="Link this course with others to share resources."
                      buttonText="Cross-link Course"
                      buttonAction={toggleCrossLinkModal}
                      buttonIcon="fa-solid fa-link"
                    />
                  )}
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DndProvider>
  );
}

AdminResourcesTabs.propTypes = {
  course: PropTypes.object,
  resources: PropTypes.array,
  printResources: PropTypes.array,
  linkedCourses: PropTypes.array,
  toggleNewResourceModal: PropTypes.func.isRequired,
  toggleEDSResourceModal: PropTypes.func.isRequired,
  toggleHitchcockModal: PropTypes.func.isRequired,
  toggleReuseModal: PropTypes.func.isRequired,
  toggleCrossLinkModal: PropTypes.func.isRequired,
  unlinkResource: PropTypes.func.isRequired,
  handleUpdateResources: PropTypes.func.isRequired,
  handleUnifiedReorder: PropTypes.func.isRequired,
  buildFolioCourseUrl: PropTypes.func.isRequired,
  navigate: PropTypes.func.isRequired,
  editResourceModal: PropTypes.object.isRequired
};

export default AdminResourcesTabs;

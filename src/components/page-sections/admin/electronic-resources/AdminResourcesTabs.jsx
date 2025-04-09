import { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Card, CardHeader, CardBody, Table } from 'reactstrap';
import { AdminResourceTable } from '../../admin/AdminResourceTable';
import AdminPrintResourceTable from './AdminPrintResourceTable';
import AdminResourceActions from './AdminResourceActions';
import EmptyState from './EmptyState';

function AdminResourcesTabs({
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
  handleReorder,
  buildFolioCourseUrl,
  navigate
}) {
  const [activeTab, setActiveTab] = useState('resources');

  return (
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

            {/* Electronic Resources Section */}
            <Card className="mb-4 resource-card">
              <CardHeader className="resource-card-header">
                <h5 className="m-0">
                  <FontAwesomeIcon icon="fa-solid fa-laptop" className="me-2" />
                  Electronic Resources
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
                    onReorder={handleReorder}
                    handleUpdateResources={handleUpdateResources}
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
                  Physical Resources
                </h5>
                <a 
                  href={buildFolioCourseUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="folio-link-btn"
                >
                  <FontAwesomeIcon icon="fa-solid fa-external-link-alt" className="me-1" />
                  Manage in FOLIO
                </a>
              </CardHeader>
              <CardBody>
                <div className="custom-alert info">
                  <FontAwesomeIcon icon="fa-solid fa-circle-info" className="me-3 mt-1" />
                  <div>
                    Physical resources are managed in FOLIO and displayed here for reference only.
                  </div>
                </div>
                
                {printResources.length > 0 ? (
                  <AdminPrintResourceTable printResources={printResources} />
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
  handleReorder: PropTypes.func.isRequired,
  buildFolioCourseUrl: PropTypes.func.isRequired,
  navigate: PropTypes.func.isRequired
};

export default AdminResourcesTabs;

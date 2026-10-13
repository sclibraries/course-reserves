import { Row, Col, Spinner, Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faExclamationCircle, faLaptop } from '@fortawesome/free-solid-svg-icons';
import RecordCard from './RecordCard';
import RecordTable from './RecordTable';
import { useCourseView } from '../../../contexts/CourseViewContext';

function isItemVisible(item, isAuthenticated) {
  if (item.isElectronic && item.resource) {
    if (isAuthenticated) return true;
    const now = new Date();
    if (item.resource.start_visibility !== null || item.resource.end_visibility !== null) {
      const start = item.resource.start_visibility ? new Date(item.resource.start_visibility + 'T00:00:00') : null;
      const end = item.resource.end_visibility ? new Date(item.resource.end_visibility + 'T23:59:59') : null;
      if (start && now < start) return false;
      if (end && now > end) return false;
    }
  }
  return true;
}

export default function MaterialsDisplay({
  isLoading, error, materials, combinedResults, availability,
  openAccordions, toggleAccordion, displayMode, viewMode,
  hiddenCount, visibleCount, nextAvailableDate,
}) {
  const { customizationProps, courseInfo, collegeParam, isAuthenticated } = useCourseView();
  const { recordsDiscoverLinkBgColor } = customizationProps;

  if (isLoading) {
    return (
      <div className="text-center">
        <Spinner color="primary" />
        <p className="mt-2">Loading records...</p>
      </div>
    );
  }

  if (error) return <Alert color="danger" fade={false}>{error}</Alert>;

  if (!materials || materials.length === 0) return <p>No records found.</p>;

  if (!isAuthenticated && visibleCount === 0 && hiddenCount > 0) {
    return (
      <Alert color="warning" fade={false} className="d-flex align-items-center">
        <FontAwesomeIcon icon={faExclamationCircle} className="me-3 fa-lg" />
        <div>
          <h4 className="alert-heading">Course Materials Not Currently Available</h4>
          <p>
            {hiddenCount} {hiddenCount === 1 ? 'resource is' : 'resources are'} scheduled for this course,
            but {hiddenCount === 1 ? 'it is' : 'they are'} not currently available.
          </p>
          {nextAvailableDate && (
            <p className="mb-0">
              <strong>Next available date:</strong> {nextAvailableDate.toLocaleDateString()}
            </p>
          )}
        </div>
      </Alert>
    );
  }

  if (displayMode === 'table') {
    return (
      <RecordTable
        combinedResults={combinedResults}
        availability={availability}
        customization={customizationProps}
        hasElectronicReserves={materials.some(r => r.isElectronic)}
        courseInfo={courseInfo}
        collegeParam={collegeParam}
        viewMode={viewMode}
        records={materials}
      />
    );
  }

  // Split card view
  if (viewMode === 'split') {
    return (
      <Row>
        <Col md={6} className="print-resources">
          <div className="column-header mb-3">
            <h3 className="h4"><FontAwesomeIcon icon={faBook} className="text-success me-2" />Physical Materials</h3>
          </div>
          {materials.filter(item => !item.isElectronic && isItemVisible(item, isAuthenticated)).length === 0 ? (
            <p className="text-muted">No physical materials available for this course.</p>
          ) : (
            materials
              .filter(item => !item.isElectronic && isItemVisible(item, isAuthenticated))
              .sort((a, b) => a.copiedItem.title.localeCompare(b.copiedItem.title))
              .map(item => (
                <RecordCard
                  key={item.id}
                  recordItem={item}
                  availability={availability}
                  openAccordions={openAccordions}
                  toggleAccordion={toggleAccordion}
                  customization={customizationProps}
                  courseInfo={courseInfo}
                  collegeParam={collegeParam}
                  isAuthenticated={isAuthenticated}
                />
              ))
          )}
        </Col>
        <Col md={6} className="electronic-resources">
          <div className="column-header mb-3">
            <h3 className="h4"><FontAwesomeIcon icon={faLaptop} className="text-info me-2" />Electronic Materials</h3>
          </div>
          {materials.filter(item => item.isElectronic && isItemVisible(item, isAuthenticated)).length === 0 ? (
            <p className="text-muted">No electronic materials available for this course.</p>
          ) : (
            materials
              .filter(item => item.isElectronic && isItemVisible(item, isAuthenticated))
              .sort((a, b) => a.copiedItem.title.localeCompare(b.copiedItem.title))
              .map(item => (
                <RecordCard
                  key={item.id}
                  recordItem={item}
                  availability={availability}
                  openAccordions={openAccordions}
                  toggleAccordion={toggleAccordion}
                  customization={customizationProps}
                  courseInfo={courseInfo}
                  collegeParam={collegeParam}
                  isAuthenticated={isAuthenticated}
                />
              ))
          )}
        </Col>
      </Row>
    );
  }

  // Combined card view
  return (
    <>
      {combinedResults.map((result) => {
        if (result.folder) {
          const visibleItems = result.items.filter(item => isItemVisible(item, isAuthenticated));
          if (visibleItems.length === 0) return null;
          return (
            <div key={`folder-${result.folder}`} className="folder-group mb-5">
              <header className="folder-header text-white p-3 rounded-top" style={{ backgroundColor: recordsDiscoverLinkBgColor }}>
                {result.folder}
              </header>
              <div className="folder-items border-start border-end border-bottom p-3">
                <Row className="g-4">
                  {visibleItems.map(recordItem => (
                    <Col xs="12" key={recordItem.id}>
                      <RecordCard
                        recordItem={recordItem}
                        availability={availability}
                        openAccordions={openAccordions}
                        toggleAccordion={toggleAccordion}
                        customization={customizationProps}
                        courseInfo={courseInfo}
                        collegeParam={collegeParam}
                        isAuthenticated={isAuthenticated}
                        isGrouped
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            </div>
          );
        }
        if (!isItemVisible(result, isAuthenticated)) return null;
        return (
          <Row className="g-4 mb-4" key={result.id}>
            <Col xs="12">
              <RecordCard
                recordItem={result}
                availability={availability}
                openAccordions={openAccordions}
                toggleAccordion={toggleAccordion}
                customization={customizationProps}
                courseInfo={courseInfo}
                collegeParam={collegeParam}
                isAuthenticated={isAuthenticated}
              />
            </Col>
          </Row>
        );
      })}
    </>
  );
}

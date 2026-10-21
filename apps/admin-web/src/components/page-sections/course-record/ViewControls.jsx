import PropTypes from 'prop-types';
import { Button, Row, Col } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faLaptop, faLayerGroup, faTableColumns, faTableList } from '@fortawesome/free-solid-svg-icons';
import { trackingService } from '../../../services/trackingService';
import { useCourseView } from '../../../contexts/CourseViewContext';

export default function ViewControls({ viewMode, setViewMode, filter, onFilterChange, records }) {
  const { courseInfo, collegeParam } = useCourseView();

  const trackViewMode = (newMode) => {
    trackingService.trackEvent({
      college: collegeParam || 'Unknown',
      event_type: 'view_mode_change',
      course_id: courseInfo?.courseListingId ?? 'N/A',
      term: courseInfo?.courseListingObject?.termObject?.name ?? 'N/A',
      metadata: { old_mode: viewMode, new_mode: newMode },
    }).catch(err => console.error('Error tracking view mode change:', err));
  };

  return (
    <div className="view-controls mb-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div className="view-toggle">
          <div className="btn-group" role="group" aria-label="Select view mode">
            <Button
              color={viewMode === 'combined' ? 'primary' : 'outline-primary'}
              onClick={() => { trackViewMode('combined'); setViewMode('combined'); }}
              className="px-3"
            >
              <FontAwesomeIcon icon={faTableList} className="me-2" />Combined View
            </Button>
            <Button
              color={viewMode === 'split' ? 'primary' : 'outline-primary'}
              onClick={() => { trackViewMode('split'); setViewMode('split'); }}
              className="px-3"
            >
              <FontAwesomeIcon icon={faTableColumns} className="me-2" />Split View
            </Button>
          </div>
        </div>
        {viewMode === 'combined' && (
          <div className="filters d-flex gap-2">
            <Button color={filter === 'all' ? 'primary' : 'outline-secondary'} size="sm" className="rounded-pill" onClick={() => onFilterChange('all')}>
              <FontAwesomeIcon icon={faLayerGroup} className="me-1" /> All Materials
            </Button>
            <Button color={filter === 'print' ? 'success' : 'outline-success'} size="sm" className="rounded-pill" onClick={() => onFilterChange('print')}>
              <FontAwesomeIcon icon={faBook} className="me-1" /> Physical Only
            </Button>
            <Button color={filter === 'electronic' ? 'info' : 'outline-info'} size="sm" className="rounded-pill" onClick={() => onFilterChange('electronic')}>
              <FontAwesomeIcon icon={faLaptop} className="me-1" /> Electronic Only
            </Button>
          </div>
        )}
      </div>
      {viewMode === 'split' && (
        <div className="resource-stats text-muted small mt-2">
          <Row>
            <Col md={6}><span className="badge bg-success me-2">Physical</span>{records.filter(r => !r.isElectronic).length} items</Col>
            <Col md={6}><span className="badge bg-info me-2">Electronic</span>{records.filter(r => r.isElectronic).length} items</Col>
          </Row>
        </div>
      )}
    </div>
  );
}

ViewControls.propTypes = {
  viewMode: PropTypes.string.isRequired,
  setViewMode: PropTypes.func.isRequired,
  filter: PropTypes.string.isRequired,
  onFilterChange: PropTypes.func.isRequired,
  records: PropTypes.array.isRequired,
};

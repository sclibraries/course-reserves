// src/pages/CourseRecords.jsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { config } from '../config';
import useRecordStore from '../store/recordStore';
import useCustomizationStore from '../store/customizationStore';
import { trackingService } from '../services/trackingService';
import { adminCourseService } from '../services/admin/adminCourseService';
import { useAuth } from '../contexts/AuthContext';
import { useRecordsTextStore, selectCourseRecordsText } from '../store/recordsTextStore';
import { canBypassVisibility, isStudentPreview, withStudentPreview } from '../util/studentPreview';

import { useCourseMaterials } from '../hooks/useCourseMaterials';
import CourseViewContext from '../contexts/CourseViewContext';
import CourseHeader from '../components/page-sections/course-record/CourseHeader';
import ViewControls from '../components/page-sections/course-record/ViewControls';
import MaterialsDisplay from '../components/page-sections/course-record/MaterialsDisplay';

function CourseRecords() {
  const location = useLocation();
  const navigate = useNavigate();
  const { uuid, courseCode, sectionParam: _sp } = useParams();

  const searchParams = new URLSearchParams(location.search);
  const collegeParam = searchParams.get('college');
  const courseListingIdParam = searchParams.get('courseListingId') || searchParams.get('id');
  const sectionParam = searchParams.get('section');

  const { record, setRecord } = useRecordStore();
  const { isAuthenticated } = useAuth();
  const studentPreview = isStudentPreview(location.search);
  const canBypassResourceVisibility = canBypassVisibility(isAuthenticated, studentPreview);
  const courseRecordsText = useRecordsTextStore(selectCourseRecordsText);

  const setStudentPreview = useCallback((enabled) => {
    navigate({
      pathname: location.pathname,
      search: withStudentPreview(location.search, enabled),
      hash: location.hash,
    }, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  const [displayMode, setDisplayMode] = useState('card');
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('combined');
  const [searchQuery, setSearchQuery] = useState('');

  // Resolve UUID → FOLIO courseListingId
  useEffect(() => {
    if (!uuid) return;
    adminCourseService.getFolioCourseId(uuid, sectionParam)
      .then(res => { if (res?.exists) setRecord(res.folio_course_id); })
      .catch(e => console.info('No course found for this uuid' + e));
  }, [uuid, sectionParam, setRecord]);

  // Resolve courseCode → FOLIO courseListingId
  useEffect(() => {
    if (!courseCode) return;
    const resolve = async () => {
      try {
        const response = await fetch(`${config.api.urls.folio}${config.api.endpoints.folioSearch.courses}?query=(courseNumber=="${courseCode}")`);
        if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
        const result = await response.json();
        if (result?.data?.courses?.length > 0) {
          const currentCourse = result.data.courses
            .sort((a, b) => new Date(b.courseListingObject.termObject.startDate) - new Date(a.courseListingObject.termObject.startDate))[0];
          if (currentCourse?.courseListingId) setRecord(currentCourse.courseListingId);
          else console.info('Course listing ID not found for the current course.');
        } else {
          console.info('No courses found matching the course code provided.');
        }
      } catch (e) {
        console.error(`Failed to fetch course data: ${e.message}`);
      }
    };
    resolve();
  }, [courseCode, setRecord]);

  // Sync URL courseListingId param → record store
  useEffect(() => {
    if (courseListingIdParam && courseListingIdParam !== record) {
      setRecord(courseListingIdParam);
    }
  }, [courseListingIdParam, record, setRecord]);

  const {
    materials, course, isLoading, error, availability, hasElectronicReserves,
    openAccordions, toggleAccordion, combinedResults, hiddenCount, visibleCount, nextAvailableDate,
  } = useCourseMaterials(record, { filter, searchQuery, canBypassVisibility: canBypassResourceVisibility });

  const courseInfo = useMemo(() => (course.length > 0 ? course[0] : null), [course]);

  // Resolve customization from availability or collegeParam
  const [customization, setCustomization] = useState(
    useCustomizationStore.getState().getCustomization()
  );
  useEffect(() => {
    if (availability && Object.keys(availability).length > 0 && !collegeParam) {
      let reserveLocation = null;
      for (const instanceId in availability) {
        const holdings = availability[instanceId]?.holdings || [];
        const firstReserveHolding = holdings.find(h => h.location?.includes('Reserve'));
        if (firstReserveHolding) { reserveLocation = firstReserveHolding.location; break; }
      }
      setCustomization(useCustomizationStore.getState().getCustomizationByReserve(reserveLocation));
    } else if (collegeParam) {
      setCustomization(useCustomizationStore.getState().getCustomizationForCollege(collegeParam));
    }
  }, [availability, collegeParam]);

  const {
    recordsCardTitleTextColor = customization.cardTextColor,
    recordsCardTextColor = customization.cardTextColor,
    recordsDiscoverLinkText = 'View in Discover Advanced',
    recordsDiscoverLinkBgColor = customization.buttonSecondaryColor,
    recordsDiscoverLinkBaseUrl = customization.discoverLinkBaseUrl,
    accordionHeaderBgColor = customization.buttonPrimaryColor,
    accordionHeaderTextColor = customization.cardTextColor,
  } = customization;

  const customizationProps = {
    recordsCardTitleTextColor, recordsCardTextColor, recordsDiscoverLinkText,
    recordsDiscoverLinkBgColor, recordsDiscoverLinkBaseUrl,
    accordionHeaderBgColor, accordionHeaderTextColor,
  };

  const handleToggleDisplay = () => {
    const newMode = displayMode === 'card' ? 'table' : 'card';
    trackingService.trackEvent({
      college: collegeParam || 'Unknown',
      event_type: newMode === 'card' ? 'switched_to_card_view' : 'switched_to_table_view',
      course_id: courseInfo?.courseListingId ?? 'N/A',
      term: courseInfo?.courseListingObject?.termObject?.name ?? 'N/A',
      course_name: courseInfo?.name ?? '',
      course_code: `${courseInfo?.courseNumber ?? ''}${courseInfo?.sectionName ? `-${courseInfo.sectionName}` : ''}`,
      instructor: courseInfo?.courseListingObject?.instructorObjects?.map(i => ({ name: i.name })) || [],
      metadata: { old_mode: displayMode, new_mode: newMode },
    }).catch(err => console.error('Error tracking view toggle:', err));
    setDisplayMode(newMode);
  };

  const handleFilterChange = (newFilter) => {
    trackingService.trackEvent({
      college: collegeParam || 'Unknown',
      event_type: 'filter_change',
      course_id: courseInfo?.courseListingId ?? 'N/A',
      term: courseInfo?.courseListingObject?.termObject?.name ?? 'N/A',
      course_name: courseInfo?.name ?? '',
      course_code: `${courseInfo?.courseNumber ?? ''}${courseInfo?.sectionName ? `-${courseInfo.sectionName}` : ''}`,
      instructor: courseInfo?.courseListingObject?.instructorObjects?.map(i => ({ name: i.name })) || [],
      metadata: { old_filter: filter, new_filter: newFilter },
    }).catch(err => console.error('Error tracking filter change:', err));
    setFilter(newFilter);
  };

  const courseViewValue = { courseInfo, customizationProps, collegeParam };

  return (
    <CourseViewContext.Provider value={courseViewValue}>
      <div className="container mt-4">
        <CourseHeader onBack={() => navigate(-1)} />

        {isAuthenticated && !studentPreview && (
          <div className="mb-3 d-flex justify-content-end">
            <Button color="warning" outline onClick={() => setStudentPreview(true)}>
              {courseRecordsText.previewAsStudent}
            </Button>
          </div>
        )}

        {studentPreview && (
          <Alert color="warning" className="d-flex justify-content-between align-items-center">
            <span>
              <strong>{courseRecordsText.studentPreviewActive}</strong>{' '}
              {courseRecordsText.studentPreviewDescription}
            </span>
            <Button color="warning" outline onClick={() => setStudentPreview(false)}>
              {courseRecordsText.exitStudentPreview}
            </Button>
          </Alert>
        )}

        <div className="mb-3 d-flex justify-content-end">
          <Button color="link" className="p-0 icon-button" onClick={handleToggleDisplay}>
            {displayMode === 'card' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-list" viewBox="0 0 16 16" aria-hidden="true">
                <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-grid" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z" />
              </svg>
            )}
            <span className="ms-1 visually-hidden">
              {displayMode === 'card' ? 'Switch to Compact (Table) View' : 'Switch to Detailed (Card) View'}
            </span>
          </Button>
        </div>

        {hasElectronicReserves && (
          <ViewControls
            viewMode={viewMode}
            setViewMode={setViewMode}
            filter={filter}
            onFilterChange={handleFilterChange}
            records={materials}
          />
        )}

        <div className="mb-3 search-container">
          <div className="input-group">
            <span className="input-group-text bg-white border-end-0">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="text-muted" />
            </span>
            <input
              type="text"
              className="form-control border-start-0 ps-0"
              placeholder="Search for titles or authors..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search records"
            />
            {searchQuery && (
              <button className="btn btn-outline-secondary border-start-0" type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>
          {searchQuery && combinedResults.length > 0 && (
            <div className="search-results-info text-muted small mt-1">
              Found {combinedResults.length} matching {combinedResults.length === 1 ? 'record' : 'records'}
            </div>
          )}
          {searchQuery && combinedResults.length === 0 && (
            <div className="search-results-info text-muted small mt-1">No records match your search</div>
          )}
        </div>

        <MaterialsDisplay
          isLoading={isLoading}
          error={error}
          materials={materials}
          combinedResults={combinedResults}
          availability={availability}
          openAccordions={openAccordions}
          toggleAccordion={toggleAccordion}
          displayMode={displayMode}
          viewMode={viewMode}
          hiddenCount={hiddenCount}
          visibleCount={visibleCount}
          nextAvailableDate={nextAvailableDate}
          canBypassVisibility={canBypassResourceVisibility}
        />
      </div>
    </CourseViewContext.Provider>
  );
}

export default CourseRecords;

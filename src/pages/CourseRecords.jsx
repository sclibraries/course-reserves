// src/pages/CourseRecords.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Row, Col, Button, Spinner, Alert, ButtonGroup, Badge } from 'reactstrap';
import { config } from '../config';
import useRecordStore from '../store/recordStore';
import useCustomizationStore from '../store/customizationStore';
import { trackingService } from '../services/trackingService';
import { adminCourseService } from '../services/admin/adminCourseService';
import {  useParams } from 'react-router-dom';

import {
  fetchRecords,
  fetchCourseData,
  fetchElectronicReserves,
  fetchItemAvailabilityData,
  fetchCrossLinkedCourses
} from '../components/page-sections/course-record/api';

import RecordCard from '../components/page-sections/course-record/RecordCard';
import RecordTable from '../components/page-sections/course-record/RecordTable';

function CourseRecords() {
  const location = useLocation();
  const navigate = useNavigate();
  const { uuid, courseCode } = useParams();

  const searchParams = new URLSearchParams(location.search);
  const collegeParam = searchParams.get('college');
  const courseListingIdParam = searchParams.get('courseListingId');

  const { record, setRecord } = useRecordStore();
  const [records, setRecords] = useState([]);
  const [course, setCourse] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState({});
  const [openAccordions, setOpenAccordions] = useState({});
  const [hasElectronicReserves, setHasElectronicReserves] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  // Display mode: "card" (detailed) vs. "table" (compact)
  const [displayMode, setDisplayMode] = useState('card');
  const [filter, setFilter] = useState('all'); // 'all', 'print', 'electronic'

  // Extract the first course from the course details array
  const courseInfo = useMemo(() => (course.length > 0 ? course[0] : null), [course]);

  //check if this request is a uuid request
  useEffect(() => {
    if (uuid) {
      const fetchFOLIOCourseListingId = async () => {
        try {
          const courseListingId = await adminCourseService.getFolioCourseId(uuid);
          if(courseListingId) {
            if(courseListingId?.exists == true){
              setRecord(courseListingId?.folio_course_id);
            }
          }
        } catch (e) {
          console.info('No course found for this uuid' + e);
        }
      };
      fetchFOLIOCourseListingId();
    }
  }, [uuid]);

  useEffect(() => {
    if (!courseCode) return;
  
    const fetchFOLIOCourseListingId = async () => {
      try {
        const response = await fetch(`${config.api.urls.folio}${config.api.endpoints.folioSearch.courses}?query=(courseNumber=="${courseCode}")`);
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status}`);
        }
  
        const result = await response.json();
  
        if (result?.data?.courses?.length > 0) {
          // Sort courses by startDate descending to find the most recent
          const currentCourse = result.data.courses
            .sort((a, b) => new Date(b.courseListingObject.termObject.startDate) - new Date(a.courseListingObject.termObject.startDate))[0];
  
          if (currentCourse?.courseListingId) {
            setRecord(currentCourse.courseListingId);
          } else {
            console.info('Course listing ID not found for the current course.');
          }
        } else {
          console.info('No courses found matching the course code provided.');
        }
      } catch (e) {
        console.error(`Failed to fetch course data: ${e.message}`);
      }
    };
  
    fetchFOLIOCourseListingId();
  
  }, [courseCode, config.api.urls.folio]);
            
      //We need to grab the courseListingId from the uuid


  // Update record from URL parameter (if it differs)
  useEffect(() => {
    if (courseListingIdParam && courseListingIdParam !== record) {
      setRecord(courseListingIdParam);
    }
  }, [courseListingIdParam, record, setRecord]);

  // Fetch data when `record` changes
  useEffect(() => {
    if (record) {
      fetchAllData();
    }
  }, [record]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Fetch all required data (print reserves, course data, electronic reserves)
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use Promise.allSettled to gracefully handle potential errors
      const [printResult, courseResult, electronicResult, crossLinkedResult] = await Promise.allSettled([
        fetchRecords(record),
        fetchCourseData(record),
        fetchElectronicReserves(record).catch(() => []),
        fetchCrossLinkedCourses(record).catch(() => [])
      ]);

      if (printResult.status === 'rejected') {
        throw new Error('Failed to fetch print reserves');
      }
      const printReserves = printResult.value;

      if (courseResult.status === 'rejected') {
        throw new Error('Failed to fetch course information');
      }
      const courseData = courseResult.value;

      // For electronic reserves, use the value if fulfilled; otherwise, use an empty array.
      const electronicReserves = electronicResult.status === 'fulfilled'
        ? electronicResult.value
        : [];
        
      setHasElectronicReserves(electronicReserves.length > 0);

      // Transform electronic reserves so they match the print reserves structure.
      const electronicReservesTransformed = electronicReserves.map(resource => ({
        id: resource.resource_id,
        folder_id: resource.folder_id || null,
        folder_name: resource.folder_name || 'Electronic Resources',
        copiedItem: {
          instanceId: resource.resource_id,
          title: resource.name,
          contributors: [],
          publication: [],
          callNumber: '',
        },
        isElectronic: true,
        resource,
      }));

      //Check for cross linked courses
      const crossLinkedCourses = crossLinkedResult.status === 'fulfilled'
        ? crossLinkedResult.value
        : [];

      setHasElectronicReserves(crossLinkedCourses.length > 0);

      const crossLinkedCoursesTransformed = crossLinkedCourses.map(resource => ({
        id: resource.resource_id,
        folder_id: resource.folder_id || null,
        folder_name: resource.folder_name || 'Electronic Resources',
        copiedItem: {
          instanceId: resource.resource_id,
          title: resource.name,
          contributors: [],
          publication: [],
          callNumber: '',
        },
        isElectronic: true,
        resource,
      }));

      // Merge print and electronic reserves
      const mergedReserves = [...printReserves, ...electronicReservesTransformed, ...crossLinkedCoursesTransformed];

      if (mergedReserves.length === 0 && courseData.length === 0) {
        throw new Error('No course data found');
      }

      setRecords(mergedReserves);
      setCourse(courseData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [record]);

  // For print reserves only: Fetch item availability data.
  useEffect(() => {
    (async function loadAvailability() {
      for (const recordItem of records) {
        if (!recordItem.isElectronic && recordItem.copiedItem.instanceId) {
          const { instanceId } = recordItem.copiedItem;
          try {
            const holding = await fetchItemAvailabilityData(instanceId);
            setAvailability(prev => ({
              ...prev,
              [instanceId]: { holdings: holding },
            }));
          } catch (err) {
            console.error('Error fetching item availability:', err);
          }
        }
      }
    })();
  }, [records]);

  // Initialize open accordions for print reserves
  useEffect(() => {
    const initialOpen = {};
    records.forEach(recordItem => {
      if (!recordItem.isElectronic && recordItem.copiedItem.instanceId) {
        const instanceId = recordItem.copiedItem.instanceId;
        initialOpen[instanceId] = [`reserves-${instanceId}`];
      }
    });
    setOpenAccordions(initialOpen);
  }, [records]);

  // Toggle handler for the accordion (for print reserves)
  const toggleAccordion = useCallback((instanceId, accordionId) => {
    setOpenAccordions(prev => {
      const isOpen = prev[instanceId]?.includes(accordionId);
      let newOpen;
      if (isOpen) {
        newOpen = prev[instanceId].filter(id => id !== accordionId);
      } else {
        newOpen = [...(prev[instanceId] || []), accordionId];
      }
      return {
        ...prev,
        [instanceId]: newOpen,
      };
    });
  }, []);


  // NEW: Combine grouped and ungrouped items into a single alphabetically sorted list
  // so that folder groups (using the folder name as the sort key) are interleaved
  // with individual records.
  const combinedResults = useMemo(() => {

    const filteredBySearch = searchQuery.trim() !== '' 
    ? records.filter(item => 
        item.copiedItem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.copiedItem.contributors && 
         item.copiedItem.contributors.some(c => 
           c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())
         ))
      )
    : records;

    // Separate records into groups and individual items.
    const groupedTemp = {};
    let ungroupedTemp = [];
    filteredBySearch.forEach(item => {
      if (item.folder_id) {
        const groupName = item.folder_name;
        if (!groupedTemp[groupName]) {
          groupedTemp[groupName] = [];
        }
        groupedTemp[groupName].push(item);
      } else {
        ungroupedTemp.push(item);
      }
    });


    // Apply filtering if needed.
    if (filter !== 'all') {
      const filterFunc = filter === 'print' ? item => !item.isElectronic : item => item.isElectronic;
      for (const groupName in groupedTemp) {
        groupedTemp[groupName] = groupedTemp[groupName].filter(filterFunc);
        if (groupedTemp[groupName].length === 0) {
          delete groupedTemp[groupName];
        }
      }
      ungroupedTemp = ungroupedTemp.filter(filterFunc);
    }

    // Sort ungrouped items alphabetically by title.
    ungroupedTemp.sort((a, b) =>
      a.copiedItem.title.toLowerCase().localeCompare(b.copiedItem.title.toLowerCase())
    );

    // Create an array of grouped items (each with a folder header and its sorted items).
    let groupedArray = Object.keys(groupedTemp).map(groupName => {
      const items = groupedTemp[groupName];
      items.sort((a, b) =>
        a.copiedItem.title.toLowerCase().localeCompare(b.copiedItem.title.toLowerCase())
      );
      return { folder: groupName, items };
    });
    // Sort groups alphabetically by folder name.
    groupedArray.sort((a, b) => a.folder.toLowerCase().localeCompare(b.folder.toLowerCase()));

    // Merge the two sorted arrays using a simple two‐pointer merge.
    let i = 0,
      j = 0;
    const merged = [];
    while (i < ungroupedTemp.length && j < groupedArray.length) {
      const ungroupedTitle = ungroupedTemp[i].copiedItem.title.toLowerCase();
      const groupTitle = groupedArray[j].folder.toLowerCase();
      if (ungroupedTitle.localeCompare(groupTitle) <= 0) {
        merged.push(ungroupedTemp[i]);
        i++;
      } else {
        merged.push(groupedArray[j]);
        j++;
      }
    }
    while (i < ungroupedTemp.length) {
      merged.push(ungroupedTemp[i]);
      i++;
    }
    while (j < groupedArray.length) {
      merged.push(groupedArray[j]);
      j++;
    }
    return merged;
  }, [records, filter, searchQuery]);

  // Get customization settings from the store.
  const [customization, setCustomization] = useState(
    useCustomizationStore.getState().getCustomization()
  );

  // Dynamically update customization based on availability or collegeParam.
  useEffect(() => {
    if (availability && Object.keys(availability).length > 0 && !collegeParam) {
      let reserveLocation = null;
      for (const instanceId in availability) {
        const holdings = availability[instanceId]?.holdings || [];
        const firstReserveHolding = holdings.find(holding =>
          holding.location?.includes('Reserve')
        );
        if (firstReserveHolding) {
          reserveLocation = firstReserveHolding.location;
          break;
        }
      }
      const newCustomization =
        useCustomizationStore.getState().getCustomizationByReserve(reserveLocation);
      setCustomization(newCustomization);
    } else if (collegeParam) {
      const newCustomization = useCustomizationStore
        .getState()
        .getCustomizationForCollege(collegeParam);
      setCustomization(newCustomization);
    }
  }, [availability, collegeParam]);

  // Extract customization values (with fallbacks).
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
    recordsCardTitleTextColor,
    recordsCardTextColor,
    recordsDiscoverLinkText,
    recordsDiscoverLinkBgColor,
    recordsDiscoverLinkBaseUrl,
    accordionHeaderBgColor,
    accordionHeaderTextColor,
  };

  // Toggle display mode between "card" and "table".
  const handleToggleDisplay = () => {
    const oldMode = displayMode;
    const newMode = oldMode === 'card' ? 'table' : 'card';
  
    // Fire tracking event
    trackingService.trackEvent({
      college: collegeParam || 'Unknown',
      event_type: newMode === 'card' ? 'switched_to_card_view' : 'switched_to_table_view',
      course_id: courseInfo?.courseListingId ?? 'N/A',
      term: courseInfo?.courseListingObject?.termObject?.name ?? 'N/A',
      course_name: courseInfo?.name ?? '',
      course_code: courseInfo?.courseNumber ?? '',
      instructor:
        courseInfo?.courseListingObject?.instructorObjects?.map((instr) => ({
          name: instr.name,
        })) || [],
      metadata: {
        old_mode: oldMode,
        new_mode: newMode,
      },
    }).catch((err) => console.error('Error tracking view toggle:', err));
  
    setDisplayMode(newMode);
  };

  const handleFilterChange = (newFilter) => {
    // Track the filter change
    trackingService.trackEvent({
      college: collegeParam || 'Unknown',
      event_type: 'filter_change',
      course_id: courseInfo?.courseListingId ?? 'N/A',
      term: courseInfo?.courseListingObject?.termObject?.name ?? 'N/A',
      course_name: courseInfo?.name ?? '',
      course_code: courseInfo?.courseNumber ?? '',
      instructor:
        courseInfo?.courseListingObject?.instructorObjects?.map((instr) => ({
          name: instr.name,
        })) || [],
      metadata: {
        old_filter: filter,
        new_filter: newFilter,
      },
    }).catch((err) => console.error('Error tracking filter change:', err));
  
    // Update the filter state
    setFilter(newFilter);
  };
  

  const renderFilterButtons = () => (
    <ButtonGroup className="mb-3">
      <Button
        style={{backgroundColor: recordsDiscoverLinkBgColor}}
        active={filter === 'all'}
        onClick={() => handleFilterChange('all')}
      >
        All
      </Button>
      <Button
        style={{backgroundColor: recordsDiscoverLinkBgColor}}
        active={filter === 'print'}
        onClick={() => handleFilterChange('print')}
      >
        Print
      </Button>
      <Button
        style={{backgroundColor: recordsDiscoverLinkBgColor}}
        active={filter === 'electronic'}
        onClick={() => handleFilterChange('electronic')}
      >
        Electronic
      </Button>
    </ButtonGroup>
  );

  return (
    <div className="container mt-4">
      {/* Back button and heading */}
      {courseInfo && (
        <div className="mb-3 d-flex align-items-center">
          <Button color="link" className="p-0 me-2" onClick={() => navigate(-1)} aria-label="Go back">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                className="bi bi-arrow-left-circle"
                viewBox="0 0 16 16"
                role="img"
                aria-hidden="true"
              >
              <path
                fillRule="evenodd"
                d="M8 15A7 7 0 1 1 8 .999a7 7 0 0 1 0 14.002ZM8 1.999A6 6 0 1 0 8 13.999a6 6 0 0 0 0-11.998Zm.146 3.646a.5.5 0 0 1 .708.708L6.707 7.5H12.5a.5.5 0 1 1 0 1H6.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3Z"
              />
            </svg>
            <span className="visually-hidden">Go Back</span>
          </Button>
          <h1 className="h4 mb-0">Back to results</h1>
        </div>
      )}

      {/* Course Information */}
      {courseInfo && (
        <div className="course-info mb-4 container-fluid py-2">
          <h2 className="display-5 fw-bold">
            {courseInfo.courseNumber}: {courseInfo.name}
          </h2>
          {courseInfo.courseListingObject?.instructorObjects?.length > 0 && (
            <h3 className="col-md-8 fs-4">
              <strong>Instructors:</strong>{' '}
              {courseInfo.courseListingObject.instructorObjects
                .map(instr => instr.name)
                .join(', ')}
            </h3>
          )}
          <Badge color="primary">{courseInfo?.courseListingObject?.termObject?.name}</Badge>
        </div>
      )}

      <div className="mb-3 d-flex justify-content-end">
        <Button color="link" className="p-0 icon-button" onClick={handleToggleDisplay}>
          {displayMode === 'card' ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="currentColor"
                className="bi bi-list"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"
                />
              </svg>
              <span className="ms-1 visually-hidden">Switch to Compact (Table) View</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="currentColor"
                className="bi bi-grid"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path
                  d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 15 10.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"
                />
              </svg>
              <span className="ms-1 visually-hidden">Switch to Detailed (Card) View</span>
            </>
          )}
        </Button>
      </div>

      {hasElectronicReserves && renderFilterButtons()}

      {/* Search Input */}
      <div className="mb-3 search-container">
        <div className="input-group">
          <span className="input-group-text bg-white border-end-0">
            <i className="fas fa-search text-muted"></i>
          </span>
          <input
            type="text"
            className="form-control border-start-0 ps-0"
            placeholder="Search for titles or authors..."
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search records"
          />
          {searchQuery && (
            <button 
              className="btn btn-outline-secondary border-start-0"
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
        {searchQuery && combinedResults.length > 0 && (
          <div className="search-results-info text-muted small mt-1">
            Found {combinedResults.length} matching {combinedResults.length === 1 ? 'record' : 'records'}
          </div>
        )}
        {searchQuery && combinedResults.length === 0 && (
          <div className="search-results-info text-muted small mt-1">
            No records match your search
          </div>
        )}
      </div>

      {/* Conditional Rendering: Loading / Error / Display */}
      {isLoading ? (
        <div className="text-center">
          <Spinner color="primary" />
          <p className="mt-2">Loading records...</p>
        </div>
      ) : error ? (
        <Alert color="danger">{error}</Alert>
      ) : records && records.length > 0 ? (
        displayMode === 'card' ? (
          <>
            {/* Card View: Render combined results (folders interleaved with individual records) */}
            {combinedResults.map((result) => {
              // If the item is a folder group (has a 'folder' property), render a folder block.
              if (result.folder) {
                return (
                  <div key={`folder-${result.folder}`} className="folder-group mb-5">
                    <header className="folder-header text-white p-3 rounded-top" style={{backgroundColor:recordsDiscoverLinkBgColor}}>
                      <div className="d-flex align-items-center gap-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20" 
                          height="20"
                          fill="currentColor"
                          className="bi bi-folder"
                          viewBox="0 0 16 16"
                        >
                          <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a2 2 0 0 1 .342-1.31zm6.339-1.577A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/>
                        </svg>
                        <h2 className="h5 mb-0">{result.folder}</h2>
                        <span className="badge bg-light text-dark ms-2">
                          {result.items.length} items
                        </span>
                      </div>
                    </header>
                    <div className="folder-items border-start border-end border-bottom p-3">
                      <Row className="g-4">
                        {result.items.map(recordItem => ( 
                          <Col xs="12" key={recordItem.id}>
                            <RecordCard
                              recordItem={recordItem}
                              availability={availability}
                              openAccordions={openAccordions}
                              toggleAccordion={toggleAccordion}
                              customization={customizationProps}
                              courseInfo={courseInfo}
                              collegeParam={collegeParam}
                              isGrouped
                            />
                          </Col>
                        ))}
                      </Row>
                    </div>
                  </div>
                );
              } else {
                // Render an individual (ungrouped) record.
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
                      />
                    </Col>
                  </Row>
                );
              }
            })}
          </>
        ) : (
          // Compact table view using the RecordTable component.
          <RecordTable
            combinedResults={combinedResults}
            availability={availability}
            customization={customizationProps}
            hasElectronicReserves={hasElectronicReserves}
            courseInfo={courseInfo}
            collegeParam={collegeParam}
          />

        )
      ) : (
        <p>No records found.</p>
      )}
    </div>
  );
}

export default CourseRecords;

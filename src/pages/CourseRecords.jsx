// src/pages/CourseRecords.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Row, Col, Button, Spinner, Alert,  Badge } from 'reactstrap';
import { config } from '../config';
import useRecordStore from '../store/recordStore';
import useCustomizationStore from '../store/customizationStore';
import { trackingService } from '../services/trackingService';
import { adminCourseService } from '../services/admin/adminCourseService';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle, faArrowAltCircleLeft } from '@fortawesome/free-solid-svg-icons';

import {
  fetchRecords,
  fetchCourseData,
  fetchItemAvailabilityData,
  fetchCrossLinkedCourses,
  fetchMergedResources,
} from '../components/page-sections/course-record/api';

import RecordCard from '../components/page-sections/course-record/RecordCard';
import RecordTable from '../components/page-sections/course-record/RecordTable';
import CoursePermalink from '../components/common/CoursePermalink';

function CourseRecords() {
  const location = useLocation();
  const navigate = useNavigate();
  const { uuid, courseCode, termSlug: _termSlug, courseSlug: _courseSlug, nameSlug: _nameSlug } = useParams();

  const searchParams = new URLSearchParams(location.search);
  const collegeParam = searchParams.get('college');
  const courseListingIdParam = searchParams.get('courseListingId') || searchParams.get('id');
  const sectionParam = searchParams.get('section');

  const { record, setRecord } = useRecordStore();
  const [records, setRecords] = useState([]);
  const [course, setCourse] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState({});
  // Map of instanceId -> [barcodes] that are actually on reserve for this course
  const [reserveBarcodesByInstance, setReserveBarcodesByInstance] = useState({});
  const [openAccordions, setOpenAccordions] = useState({});
  const [hasElectronicReserves, setHasElectronicReserves] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { isAuthenticated } = useAuth();

  // Display mode: "card" (detailed) vs. "table" (compact)
  const [displayMode, setDisplayMode] = useState('card');
  const [filter, setFilter] = useState('all'); // 'all', 'print', 'electronic'

  // Add a new state variable for the view mode
  const [viewMode, setViewMode] = useState('combined'); // 'combined', 'split'

  // Extract the first course from the course details array
  const courseInfo = useMemo(() => (course.length > 0 ? course[0] : null), [course]);

  //check if this request is a uuid request
  useEffect(() => {
    if (uuid) {
      const fetchFOLIOCourseListingId = async () => {
        try {
          const courseListingId = await adminCourseService.getFolioCourseId(uuid, sectionParam);
          if (courseListingId) {
            if (courseListingId?.exists == true) {
              setRecord(courseListingId?.folio_course_id);
            }
          }
        } catch (e) {
          console.info('No course found for this uuid' + e);
        }
      };
      fetchFOLIOCourseListingId();
    }
  }, [uuid, sectionParam, setRecord]);

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

  }, [courseCode, setRecord]);

  // Update record from URL parameter (if it differs)
  useEffect(() => {
    if (courseListingIdParam && courseListingIdParam !== record) {
      // Clear previous course data before setting new record
      setCourse([]);
      setRecords([]);
      setRecord(courseListingIdParam);
    }
  }, [courseListingIdParam, record, setRecord]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Add this new function to fetch detailed inventory data
  const fetchInventoryDetails = useCallback(async (instanceId) => {
    if (!instanceId) return null;
    
    try {
      const response = await fetch(`https://libtools2.smith.edu/folio/web/search/search-inventory?query=id==${instanceId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch inventory details: ${response.status}`);
      }
      
      const data = await response.json();
      if (data?.data?.instances) {
        return data.data.instances[0];
      }
      return null;
    } catch (error) {
      console.warn(`Error fetching inventory details for ${instanceId}:`, error);
      return null;
    }
  }, []);

  // Fetch all required data (print reserves, course data, electronic reserves)
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
  
    try {
      // 1) try the merged endpoint; on 404 just pretend we got back an empty list
      let mergedResources = [];
      try {
        const { resources } = await fetchMergedResources(record);
        mergedResources = resources || [];
        console.log('Merged resources:', mergedResources); // Debug log
      } catch (err) {
        // if the server says "Not Found" (404), we fall back
        const is404 = err.status === 404 || (err.message && err.message.includes('404'));
        if (!is404) throw err;
        // else mergedResources stays []
      }
  
      // 2) ALWAYS fetch print reserves from FOLIO to ensure we have all physical items
      // This fixes the issue where new physical items added to FOLIO after backend sync
      // would be missing if the backend already had references to other physical items
      const printReserves = await fetchRecords(record);

      // Build a map of instanceId -> array of barcodes that are actually on reserve for this course
      const barcodeMap = {};
      for (const rec of printReserves) {
        const instId = rec?.copiedItem?.instanceId;
        const barcode = rec?.copiedItem?.barcode;
        if (!instId || !barcode) continue;
        if (!barcodeMap[instId]) barcodeMap[instId] = [];
        if (!barcodeMap[instId].includes(barcode)) barcodeMap[instId].push(barcode);
      }
      setReserveBarcodesByInstance(barcodeMap);
      
      // Convert FOLIO print reserves to our format
      const folioPhysical = printReserves.map(rec => ({
        _isFallbackPrint: true,
        __orig: rec
      }));
      
      // Get physical items that are already in the merged payload (have backend references)
      const mergedPhysical = mergedResources.filter(r => r.resource_type === 'physical');
      
      // Create a Set of instanceIds from merged physical items for deduplication
      const mergedPhysicalIds = new Set(mergedPhysical.map(item => item.id));
      
      // Filter FOLIO physical items to only include those NOT already in merged data
      const newFolioPhysical = folioPhysical.filter(item => 
        !mergedPhysicalIds.has(item.__orig.instanceId)
      );
      
      // Combine: electronic resources + existing physical (with backend order) + new physical (FOLIO only)
      let allMerged = [...mergedResources, ...newFolioPhysical];
      
      const hasAnyPhysical = mergedPhysical.length > 0 || newFolioPhysical.length > 0;
      
      // Debug logging to help track the merge process
      console.log(`Physical resources summary:
        - Merged (with backend order): ${mergedPhysical.length}
        - New from FOLIO only: ${newFolioPhysical.length}
        - Total physical: ${hasAnyPhysical ? mergedPhysical.length + newFolioPhysical.length : 0}
        - Electronic + cross-linked: ${mergedResources.filter(r => r.resource_type === 'electronic').length}`);

  
      // 2.5) ADDED: Fetch cross-linked courses and merge them in
      let crossLinkedCourses = [];
      try {
        crossLinkedCourses = await fetchCrossLinkedCourses(record);
        console.log('Cross-linked courses:', crossLinkedCourses); // Debug log
      } catch (err) {
        console.warn('Failed to fetch cross-linked courses:', err);
        crossLinkedCourses = [];
      }

      if (crossLinkedCourses.length > 0) {
        const crossLinkedResources = crossLinkedCourses.map(resource => ({
          _isCrossLinked: true,
          id: resource.resource_id,
          resource_type: 'electronic',
          title: resource.name,
          folder_id: resource.folder_id || null,
          folder_name: resource.folder_name || 'Cross-linked Courses',
          __resource: resource
        }));
        
        allMerged = [...allMerged, ...crossLinkedResources];
      }

      // 3) normalize everything *and* copy over the `order` field
      let normalized = allMerged.map(item => {
        if (item._isFallbackPrint) {
          return item.__orig;
        }

        // Cross-linked course handling
        if (item._isCrossLinked) {
          return {
            id: item.id,
            order: item.order != null ? Number(item.order) : null,
            isElectronic: true,
            folder_id: item.folder_id,
            folder_name: item.folder_name,
            resource: {
              resource_id: item.id,
              name: item.title,
              item_url: item.__resource.item_url,
              description: item.__resource.description,
              external_note: item.__resource.external_note,
              internal_note: item.__resource.internal_note,
              start_visibility: item.__resource.start_visibility,
              end_visibility: item.__resource.end_visibility,
              use_proxy: item.__resource.use_proxy,
              use_primary_link_visibility: item.__resource.use_primary_link_visibility,
              primary_link_start_visibility: item.__resource.primary_link_start_visibility,
              primary_link_end_visibility: item.__resource.primary_link_end_visibility,
              links: item.__resource.links || [],

              metadata: item.__resource.metadata || []
            },
            copiedItem: {
              instanceId: item.id,
              title: item.title,
              contributors: [],
              publication: [],
              callNumber: ''
            }
          };
        }
  
        // pull numeric order out of the merged payload
        const order = item.order != null ? Number(item.order) : null;
  
        if (item.resource_type === 'electronic') {
          return {
            id: item.id,
            order,               // ← now everyone has `order`
            isElectronic: true,
            folder_id: item.folder_id,
            folder_name: item.folder_name,
            resource: {
              resource_id:     item.id,
              name:            item.title,
              item_url:        item.item_url,
              description:     item.description,
              external_note:   item.external_note,
              internal_note:   item.internal_note,
              start_visibility:item.start_visibility,
              end_visibility:  item.end_visibility,
              use_proxy:       item.use_proxy,
              use_primary_link_visibility: item.use_primary_link_visibility,
              primary_link_start_visibility: item.primary_link_start_visibility,
              primary_link_end_visibility: item.primary_link_end_visibility,
              links:           item.links || [],
              metadata:        item.metadata || []
            },
            copiedItem: {
              instanceId:     item.id,
              title:          item.title,
              contributors:   [],
              publication:    [],
              callNumber:     ''
            }
          };
        } else {
          return {
            id: item.id,
            order,             
            isElectronic: false,
            resource: null,
            copiedItem: {
              instanceId:   item.id,
              title:        item.title,
              contributors: [],
              publication:  [],
              callNumber:   item.callNumber  || '',
              barcode:      item.barcode     || '',
              holdingsId:   item.holdingsId  || '',
              instanceHrid: item.instanceHrid|| ''
            }
          };
        }
      });

      // NEW STEP: Enhance physical resources with complete inventory data
      if (hasAnyPhysical) {
        const physicalResources = normalized.filter(item => 
          !item.isElectronic);
        
        
        // Fetch detailed inventory data for each physical resource in parallel
        const detailPromises = physicalResources.map(async (item) => {
          // Use the instanceId directly for lookup
          const instanceId = item.id;

          const instanceDetails = await fetchInventoryDetails(instanceId);

          if (instanceDetails) {
            // Process contributors if available
            let contributors = [];
            if (instanceDetails.contributors) {
              if (Array.isArray(instanceDetails.contributors)) {
                contributors = instanceDetails.contributors.map(c => ({ name: c.name }));
              } else if (instanceDetails.contributors) {
                contributors = [{ name: instanceDetails.contributors.name }];
              }
            }
            
            // Process publication if available
            let publication = [];
            if (instanceDetails.publication) {
              if (Array.isArray(instanceDetails.publication)) {
                publication = instanceDetails.publication.map(p => ({
                  publisher: p.publisher || '',
                  place: p.place || '',
                  dateOfPublication: p.dateOfPublication || ''
                }));
              } else if (instanceDetails.publication) {
                publication = [{
                  publisher: instanceDetails.publication.publisher || '',
                  place: instanceDetails.publication.place || '',
                  dateOfPublication: instanceDetails.publication.dateOfPublication || ''
                }];
              }
            }
            console.log('Publication:', publication); // Debug publication

            // Return enhanced item with contributors and publication data
            const enhancedItem = {
              ...item,
              copiedItem: {
                ...item.copiedItem,
                contributors,
                publication
              }
            };
            console.log('Enhanced item:', enhancedItem.id, enhancedItem.copiedItem.contributors?.length, enhancedItem.copiedItem.publication?.length); // Debug enhanced item
            return enhancedItem;
          }
          return item;
        });
        
        // Wait for all detail fetches to complete
        const enhancedItems = await Promise.all(detailPromises);
        
        // Replace the physical items with their enhanced versions
        normalized = normalized.map(item => {
          if (!item.isElectronic) {
            const enhancedItem = enhancedItems.find(enhanced => enhanced.id === item.id);
            if (enhancedItem) {
              console.log('Using enhanced data for item:', item.id); // Debug log
              return enhancedItem;
            }
            console.log('No enhanced data found for item:', item.id); // Debug log
            return item;
          }
          return item;
        });

        // Add a log to verify what data is actually in the records after enhancement
        console.log('First 3 records after enhancement:', 
          normalized.slice(0, 3).map(r => ({
            id: r.id,
            title: r.copiedItem.title,
            isElectronic: r.isElectronic,
            contributors: r.copiedItem.contributors?.length || 0,
            publication: r.copiedItem.publication?.length || 0
          }))
        );
      }

      // NEW: dedupe by instanceId
      {
        const seen = new Set();
        normalized = normalized.filter(item => {
          const instId = item.copiedItem?.instanceId;
          if (!instId || seen.has(instId)) return false;
          seen.add(instId);
          return true;
        });
      }
  
      setRecords(normalized);
  
      // 4) finally fetch course info & set the electronic‐flag
      const courseData = await fetchCourseData(record);
      setCourse(courseData);
      // Update hasElectronicReserves to check for both regular electronic resources and cross-linked courses
      setHasElectronicReserves(normalized.some(r => r.isElectronic));
  
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load course materials');
    } finally {
      setIsLoading(false);
    }
  }, [record, fetchInventoryDetails]);

  // Clear data immediately when record changes to prevent showing stale data
  useEffect(() => {
    setCourse([]);
    setRecords([]);
    setError(null);
    setAvailability({});
    setReserveBarcodesByInstance({});
  }, [record]);

  // Fetch data when `record` changes
  useEffect(() => {
    if (record) {
      fetchAllData();
    }
  }, [record, fetchAllData]);

  // For print reserves only: Fetch item availability data, then filter to barcodes that are actually on reserve.
  useEffect(() => {
    (async function loadAvailability() {
      for (const recordItem of records) {
        if (!recordItem.isElectronic && recordItem.copiedItem.instanceId) {
          const { instanceId } = recordItem.copiedItem;
          try {
            const holdings = await fetchItemAvailabilityData(instanceId);
            const barcodes = new Set(reserveBarcodesByInstance[instanceId] || []);
            const filtered = Array.isArray(holdings)
              ? holdings.filter(h => !barcodes.size || (h.barcode && barcodes.has(h.barcode)))
              : [];
            setAvailability(prev => ({
              ...prev,
              [instanceId]: { holdings: filtered, allHoldings: holdings },
            }));
          } catch (err) {
            console.error('Error fetching item availability:', err);
          }
        }
      }
    })();
  }, [records, reserveBarcodesByInstance]);

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

  // Helper function to check if a record should be visible
  const isRecordVisible = useCallback((item) => {
    if (item.isElectronic && item.resource) {
      if (isAuthenticated) return true;

      const now = new Date();
      
      // Always check resource-level visibility dates if they're set
      if (item.resource.start_visibility !== null || item.resource.end_visibility !== null) {
        const startVisibility = item.resource.start_visibility
          ? new Date(item.resource.start_visibility + 'T00:00:00')
          : null;
        const endVisibility = item.resource.end_visibility
          ? new Date(item.resource.end_visibility + 'T23:59:59')
          : null;

        if ((startVisibility && now < startVisibility)) {
          return false;
        }

        if ((endVisibility && now > endVisibility)) {
          return false;
        }
      }
    }
    return true;
  }, [isAuthenticated]);

  // NEW: Combine grouped and ungrouped items with improved ordering logic
  // Handle different sorting scenarios based on order values
  const combinedResults = useMemo(() => {
    // 1) Filter by search string
    const filteredBySearch = searchQuery.trim() !== ''
      ? records.filter(item =>
          item.copiedItem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.copiedItem.contributors?.some(c =>
            c.name?.toLowerCase().includes(searchQuery.toLowerCase())
          ))
        )
      : records;
  
    // 2) Filter by print/electronic if needed
    const filtered = filter === 'all'
      ? filteredBySearch
      : filteredBySearch.filter(item =>
          filter === 'electronic' ? item.isElectronic : !item.isElectronic
        );

    // 3) Filter by visibility - hide resources that aren't currently visible
    const visibilityFiltered = filtered.filter(item => isRecordVisible(item));
  
        // 4) Determine sorting strategy based on order values
    const electronicResources = visibilityFiltered.filter(item => item.isElectronic);
    const hasElectronic = electronicResources.length > 0;
    
    // Check if all electronic resources have order 999 (auto-assigned)
    const allElectronicHave999 = hasElectronic && 
      electronicResources.every(item => item.order === 999 || item.order === "999");
    
    // Check if there are any specific orders (not 999 and not null)
    const hasSpecificOrders = visibilityFiltered.some(item => 
      item.order != null && item.order !== 999 && item.order !== "999"
    );

    // CASE 1: No electronic resources OR all electronic resources have order 999
    // Use original server order (preserve the order from the API response)
    if (!hasElectronic || (allElectronicHave999 && !hasSpecificOrders)) {
      console.log('Using original server order - no electronic or all 999 orders');
      
      // Still need to handle folder grouping even when preserving server order
      const groupedTemp = {};
      let ungroupedTemp = [];
    
      visibilityFiltered.forEach(item => {
        if (item.folder_id) {
          const key = item.folder_name;
          (groupedTemp[key] ||= []).push(item);
        } else {
          ungroupedTemp.push(item);
        }
      });
    
      // Build sorted groups (maintain original order within groups)
      const groupedArray = Object.entries(groupedTemp)
        .map(([folder, items]) => ({
          folder,
          items // Keep original order from server
        }))
        .sort((a, b) =>
          a.folder.toLowerCase().localeCompare(b.folder.toLowerCase())
        );
    
      // Merge ungrouped and grouped items maintaining server order
      const merged = [];
      let i = 0, j = 0;
      while (i < ungroupedTemp.length && j < groupedArray.length) {
        // For server order, we'll interleave based on the first item in each group
        const firstUngrouped = ungroupedTemp[i];
        const firstInGroup = groupedArray[j].items[0];
        
        // Get the original indices to maintain server order
        const ungroupedIndex = visibilityFiltered.indexOf(firstUngrouped);
        const groupedIndex = visibilityFiltered.indexOf(firstInGroup);
        
        if (ungroupedIndex <= groupedIndex) {
          merged.push(ungroupedTemp[i++]);
        } else {
          merged.push(groupedArray[j++]);
        }
      }
      // flush any leftovers
      while (i < ungroupedTemp.length) merged.push(ungroupedTemp[i++]);
      while (j < groupedArray.length)   merged.push(groupedArray[j++]);
    
      return merged;
    }
    
    // CASE 2: There are specific orders (not 999) - sort by order values
    if (hasSpecificOrders) {
      console.log('Using specific order sorting');
      const sortedFiltered = visibilityFiltered
        .slice() // copy so we don't mutate state
        .sort((a, b) => {
          const ao = a.order != null ? Number(a.order) : Infinity;
          const bo = b.order != null ? Number(b.order) : Infinity;
          
          // If both have order 999, maintain their original relative position
          if (ao === 999 && bo === 999) {
            return 0; // Keep original order
          }
          
          // Sort by order value
          if (ao !== bo) return ao - bo;
          
          // tie‑break alphabetically
          return a.copiedItem.title
            .toLowerCase()
            .localeCompare(b.copiedItem.title.toLowerCase());
        });

      // Handle folder grouping for sorted items
      const groupedTemp = {};
      let ungroupedTemp = [];
    
      sortedFiltered.forEach(item => {
        if (item.folder_id) {
          const key = item.folder_name;
          (groupedTemp[key] ||= []).push(item);
        } else {
          ungroupedTemp.push(item);
        }
      });
    
      // Build sorted groups
      const groupedArray = Object.entries(groupedTemp)
        .map(([folder, items]) => ({
          folder,
          items // Items are already sorted from sortedFiltered
        }))
        .sort((a, b) =>
          a.folder.toLowerCase().localeCompare(b.folder.toLowerCase())
        );
    
      // Merge maintaining sort order
      const merged = [];
      let i = 0, j = 0;
      while (i < ungroupedTemp.length && j < groupedArray.length) {
        const firstUngrouped = ungroupedTemp[i];
        const firstInGroup = groupedArray[j].items[0];
        
        // Get the sorted indices
        const ungroupedIndex = sortedFiltered.indexOf(firstUngrouped);
        const groupedIndex = sortedFiltered.indexOf(firstInGroup);
        
        if (ungroupedIndex <= groupedIndex) {
          merged.push(ungroupedTemp[i++]);
        } else {
          merged.push(groupedArray[j++]);
        }
      }
      // flush any leftovers
      while (i < ungroupedTemp.length) merged.push(ungroupedTemp[i++]);
      while (j < groupedArray.length)   merged.push(groupedArray[j++]);
    
      return merged;
    }
  
    // CASE 3: Fallback to old grouping + ABC merge logic for edge cases
    console.log('Using fallback grouping logic');
    const groupedTemp = {};
    let ungroupedTemp = [];
  
    visibilityFiltered.forEach(item => {
      if (item.folder_id) {
        const key = item.folder_name;
        (groupedTemp[key] ||= []).push(item);
      } else {
        ungroupedTemp.push(item);
      }
    });
  
    // Sort the ungrouped ABC
    ungroupedTemp.sort((a, b) =>
      a.copiedItem.title.toLowerCase()
        .localeCompare(b.copiedItem.title.toLowerCase())
    );
  
    // Build sorted groups
    const groupedArray = Object.entries(groupedTemp)
      .map(([folder, items]) => ({
        folder,
        items: items.sort((a, b) =>
          a.copiedItem.title.toLowerCase()
            .localeCompare(b.copiedItem.title.toLowerCase())
        )
      }))
      .sort((a, b) =>
        a.folder.toLowerCase().localeCompare(b.folder.toLowerCase())
      );
  
    // Merge two lists with two‑pointer method
    const merged = [];
    let i = 0, j = 0;
    while (i < ungroupedTemp.length && j < groupedArray.length) {
      const titleA = ungroupedTemp[i].copiedItem.title.toLowerCase();
      const titleG = groupedArray[j].folder.toLowerCase();
      if (titleA <= titleG) {
        merged.push(ungroupedTemp[i++]);
      } else {
        merged.push(groupedArray[j++]);
      }
    }
    // flush any leftovers
    while (i < ungroupedTemp.length) merged.push(ungroupedTemp[i++]);
    while (j < groupedArray.length)   merged.push(groupedArray[j++]);
  
    return merged;
  }, [records, filter, searchQuery, isRecordVisible]);

  // Process visibility for all records (similar to RecordTable component)
  const processedRecords = useMemo(() => {
    let hiddenCount = 0;
    let visibleCount = 0;
    let upcomingDates = [];

    // Check record visibility
    const checkRecordVisibility = (item) => {
      if (item.isElectronic && item.resource) {
        if (isAuthenticated) return { isVisible: true };

        const now = new Date();
        
        // Check if primary link visibility is enabled
        const usePrimaryLinkVisibility = item.resource.use_primary_link_visibility === "1" || 
                                       item.resource.use_primary_link_visibility === 1 || 
                                       item.resource.use_primary_link_visibility === true;
        
        if (usePrimaryLinkVisibility) {
          // Use primary link visibility dates
          const startVisibility = item.resource.primary_link_start_visibility
            ? new Date(item.resource.primary_link_start_visibility + 'T00:00:00')
            : null;
          const endVisibility = item.resource.primary_link_end_visibility
            ? new Date(item.resource.primary_link_end_visibility + 'T23:59:59')
            : null;
            
          // If current time is before the start of the primary link visibility window
          if (startVisibility && now < startVisibility) {
            upcomingDates.push(startVisibility);
            return { isVisible: false, startDate: startVisibility };
          }
          
          // If current time is after the end of the primary link visibility window
          if (endVisibility && now > endVisibility) {
            return { isVisible: false };
          }
        } else {
          // Check if resource-level visibility is enabled
          const useResourceVisibility = item.resource.use_resource_visibility === "1" || 
                                       item.resource.use_resource_visibility === 1 || 
                                       item.resource.use_resource_visibility === true;
          
          if (useResourceVisibility) {
            // Use resource-level visibility dates
            const startVisibility = item.resource.start_visibility
              ? new Date(item.resource.start_visibility + 'T00:00:00')
              : null;
            const endVisibility = item.resource.end_visibility
              ? new Date(item.resource.end_visibility + 'T23:59:59')
              : null;

            if ((startVisibility && now < startVisibility)) {
              upcomingDates.push(startVisibility);
              return { isVisible: false, startDate: startVisibility };
            }

            if ((endVisibility && now > endVisibility)) {
              return { isVisible: false };
            }
          }
        }
      }
      return { isVisible: true };
    };

    // Check visibility for all records
    records.forEach(record => {
      const visibility = checkRecordVisibility(record);
      if (visibility.isVisible) {
        visibleCount++;
      } else {
        hiddenCount++;
      }
    });

    // Find the closest upcoming date
    const nextAvailableDate = upcomingDates.length > 0
      ? new Date(Math.min(...upcomingDates.map(d => d.getTime())))
      : null;

    return {
      hiddenCount,
      visibleCount,
      totalCount: hiddenCount + visibleCount,
      nextAvailableDate
    };
  }, [records, isAuthenticated]);

  const { hiddenCount, visibleCount, nextAvailableDate } = processedRecords;

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
      course_code: `${courseInfo?.courseNumber ?? ''}${courseInfo?.sectionName ? `-${courseInfo.sectionName}` : ''}`,
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
      course_code: `${courseInfo?.courseNumber ?? ''}${courseInfo?.sectionName ? `-${courseInfo.sectionName}` : ''}`,
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


  // Replace the renderFilterButtons function with this enhanced ViewControls component
  const renderViewControls = () => {
    if (!hasElectronicReserves) return null;
    
    return (
      <div className="view-controls mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          {/* Left side: View mode toggle */}
          <div className="view-toggle">
            <div className="btn-group" role="group" aria-label="Select view mode">
              <Button 
                color={viewMode === 'combined' ? 'primary' : 'outline-primary'}
                onClick={() => {
                  trackingService.trackEvent({
                    college: collegeParam || 'Unknown',
                    event_type: 'view_mode_change',
                    course_id: courseInfo?.courseListingId ?? 'N/A',
                    term: courseInfo?.courseListingObject?.termObject?.name ?? 'N/A',
                    metadata: { old_mode: viewMode, new_mode: 'combined' },
                  }).catch(err => console.error('Error tracking view mode change:', err));
                  setViewMode('combined');
                }}
                className="px-3"
              >
                <i className="fas fa-th-list me-2"></i>
                Combined View
              </Button>
              <Button 
                color={viewMode === 'split' ? 'primary' : 'outline-primary'}
                onClick={() => {
                  trackingService.trackEvent({
                    college: collegeParam || 'Unknown',
                    event_type: 'view_mode_change',
                    course_id: courseInfo?.courseListingId ?? 'N/A',
                    term: courseInfo?.courseListingObject?.termObject?.name ?? 'N/A',
                    metadata: { old_mode: viewMode, new_mode: 'split' },
                  }).catch(err => console.error('Error tracking view mode change:', err));
                  setViewMode('split');
                }}
                className="px-3"
              >
                <i className="fas fa-columns me-2"></i>
                Split View
              </Button>
            </div>
          </div>

          {/* Right side: Filter pills (only in combined view) */}
          {viewMode === 'combined' && (
            <div className="filters d-flex gap-2">
              <Button
                color={filter === 'all' ? 'primary' : 'outline-secondary'}
                size="sm"
                className="rounded-pill"
                onClick={() => handleFilterChange('all')}
              >
                <i className="fas fa-layer-group me-1"></i> All Materials
              </Button>
              <Button
                color={filter === 'print' ? 'success' : 'outline-success'}
                size="sm"
                className="rounded-pill"
                onClick={() => handleFilterChange('print')}
              >
                <i className="fas fa-book me-1"></i> Physical Only
              </Button>
              <Button
                color={filter === 'electronic' ? 'info' : 'outline-info'}
                size="sm"
                className="rounded-pill"
                onClick={() => handleFilterChange('electronic')}
              >
                <i className="fas fa-laptop me-1"></i> Electronic Only
              </Button>
            </div>
          )}
        </div>
        
        {/* Split view mode stats */}
        {viewMode === 'split' && (
          <div className="resource-stats text-muted small mt-2">
            <Row>
              <Col md={6}>
                <span className="badge bg-success me-2">Physical</span>
                {records.filter(r => !r.isElectronic).length} items
              </Col>
              <Col md={6}>
                <span className="badge bg-info me-2">Electronic</span>
                {records.filter(r => r.isElectronic).length} items
              </Col>
            </Row>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mt-4">
      {/* Back button and heading */}
      {courseInfo && (
        <div className="mb-3 d-flex align-items-center">
          <Button
            color="link"
            className="p-0 me-2 text-primary"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <FontAwesomeIcon icon={faArrowAltCircleLeft} size="lg" />
            <span className="visually-hidden">Go Back</span>
          </Button>
          <h1 className="h4 mb-0">Back to results</h1>
        </div>
      )}

      {/* Course Information */}
      {courseInfo && (
        <div className="course-info mb-4 container-fluid py-2">
          <h2 className="display-5 fw-bold">
            {courseInfo.courseNumber}
            {courseInfo.sectionName && `-${courseInfo.sectionName}`}: {courseInfo.name}
          </h2>
          {courseInfo.courseListingObject?.instructorObjects?.length > 0 && (
            <h3 className="col-md-8 fs-4">
              <strong>Instructors:</strong>{' '}
              {courseInfo.courseListingObject.instructorObjects
                .map(instr => instr.name)
                .join(', ')}
            </h3>
          )}
          <div className="d-flex align-items-center gap-3 mt-2">
            <Badge color="primary">{courseInfo?.courseListingObject?.termObject?.name}</Badge>
            {courseInfo?.sectionName && (
              <Badge color="secondary">Section {courseInfo.sectionName}</Badge>
            )}
            <CoursePermalink course={courseInfo} compact />
          </div>
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
                  d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 15 10.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"
                />
              </svg>
              <span className="ms-1 visually-hidden">Switch to Detailed (Card) View</span>
            </>
          )}
        </Button>
      </div>

      {hasElectronicReserves && renderViewControls()}

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
        <>
          {/* Show unavailable message if all items are hidden and user is not authenticated */}
          {!isAuthenticated && visibleCount === 0 && hiddenCount > 0 ? (
            <Alert color="warning" className="d-flex align-items-center">
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
          ) : (
            displayMode === 'card' ? (
              <>
                {/* Card View: Render combined results or split view */}
                {viewMode === 'combined' ? (
                  // Original rendering logic for combined view
                  combinedResults.map((result) => {
                    // If the item is a folder group (has a 'folder' property), render a folder block.
                    if (result.folder) {
                      // Filter out invisible items from the folder
                      const visibleItems = result.items.filter(item => isRecordVisible(item));
                      
                      // Skip rendering the folder completely if it has no visible items
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
                    } else {
                      // Render an individual (ungrouped) record.
                      // Check visibility before creating Row/Col structure
                      if (!isRecordVisible(result)) {
                        return null;
                      }
                      
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
                    }
                  })
                ) : (
                  // New split-view rendering with two columns
                  <Row>
                    {/* Print resources column */}
                    <Col md={6} className="print-resources">
                      <div className="column-header mb-3">
                        <h3 className="h4">
                          <i className="fas fa-book text-success me-2"></i>
                          Physical Materials
                        </h3>
                      </div>
                      {records.filter(item => !item.isElectronic && isRecordVisible(item)).length === 0 ? (
                        <p className="text-muted">No physical materials available for this course.</p>
                      ) : (
                        records
                          .filter(item => !item.isElectronic && isRecordVisible(item))
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
                    
                    {/* Electronic resources column */}
                    <Col md={6} className="electronic-resources">
                      <div className="column-header mb-3">
                        <h3 className="h4">
                          <i className="fas fa-laptop text-info me-2"></i>
                          Electronic Materials
                        </h3>
                      </div>
                      {records.filter(item => item.isElectronic && isRecordVisible(item)).length === 0 ? (
                        <p className="text-muted">No electronic materials available for this course.</p>
                      ) : (
                        records
                          .filter(item => item.isElectronic && isRecordVisible(item))
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
                )}
              </>
            ) : (
              // Table view - keep the existing RecordTable but pass viewMode
              <RecordTable
                combinedResults={combinedResults}
                availability={availability}
                customization={customizationProps}
                hasElectronicReserves={hasElectronicReserves}
                courseInfo={courseInfo}
                collegeParam={collegeParam}
                viewMode={viewMode}
                records={records} // Pass all records for split view
              />
            )
          )}
        </>
      ) : (
        <p>No records found.</p>
      )}
    </div>
  );
}

export default CourseRecords;

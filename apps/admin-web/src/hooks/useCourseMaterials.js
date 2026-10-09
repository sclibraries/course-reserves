import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  fetchRecords,
  fetchCourseData,
  fetchItemAvailabilityData,
  fetchCrossLinkedCourses,
  fetchMergedResources,
} from '../components/page-sections/course-record/api';

export function useCourseMaterials(record, { filter = 'all', searchQuery = '', isAuthenticated = false } = {}) {
  const [records, setRecords] = useState([]);
  const [course, setCourse] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState({});
  const [reserveBarcodesByInstance, setReserveBarcodesByInstance] = useState({});
  const [openAccordions, setOpenAccordions] = useState({});
  const [hasElectronicReserves, setHasElectronicReserves] = useState(false);

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

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
  
    try {
      let mergedResources = [];
      try {
        const { resources } = await fetchMergedResources(record);
        mergedResources = resources || [];
        console.log('Merged resources:', mergedResources);
      } catch (err) {
        const is404 = err.status === 404 || (err.message && err.message.includes('404'));
        if (!is404) throw err;
      }
  
      const printReserves = await fetchRecords(record);

      const barcodeMap = {};
      for (const rec of printReserves) {
        const instId = rec?.copiedItem?.instanceId;
        const barcode = rec?.copiedItem?.barcode;
        if (!instId || !barcode) continue;
        if (!barcodeMap[instId]) barcodeMap[instId] = [];
        if (!barcodeMap[instId].includes(barcode)) barcodeMap[instId].push(barcode);
      }
      setReserveBarcodesByInstance(barcodeMap);
      
      const folioPhysical = printReserves.map(rec => ({
        _isFallbackPrint: true,
        __orig: rec
      }));
      
      const mergedPhysical = mergedResources.filter(r => r.resource_type === 'physical');
      
      const mergedPhysicalIds = new Set(mergedPhysical.map(item => item.id));
      
      const newFolioPhysical = folioPhysical.filter(item => 
        !mergedPhysicalIds.has(item.__orig.instanceId)
      );
      
      let allMerged = [...mergedResources, ...newFolioPhysical];
      
      const hasAnyPhysical = mergedPhysical.length > 0 || newFolioPhysical.length > 0;
      
      console.log(`Physical resources summary:
        - Merged (with backend order): ${mergedPhysical.length}
        - New from FOLIO only: ${newFolioPhysical.length}
        - Total physical: ${hasAnyPhysical ? mergedPhysical.length + newFolioPhysical.length : 0}
        - Electronic + cross-linked: ${mergedResources.filter(r => r.resource_type === 'electronic').length}`);

      let crossLinkedCourses = [];
      try {
        crossLinkedCourses = await fetchCrossLinkedCourses(record);
        console.log('Cross-linked courses:', crossLinkedCourses);
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

      let normalized = allMerged.map(item => {
        if (item._isFallbackPrint) {
          return item.__orig;
        }

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
  
        const order = item.order != null ? Number(item.order) : null;
  
        if (item.resource_type === 'electronic') {
          return {
            id: item.id,
            order,
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

      if (hasAnyPhysical) {
        const physicalResources = normalized.filter(item => !item.isElectronic);
        
        const detailPromises = physicalResources.map(async (item) => {
          const instanceId = item.id;
          const instanceDetails = await fetchInventoryDetails(instanceId);

          if (instanceDetails) {
            let contributors = [];
            if (instanceDetails.contributors) {
              if (Array.isArray(instanceDetails.contributors)) {
                contributors = instanceDetails.contributors.map(c => ({ name: c.name }));
              } else if (instanceDetails.contributors) {
                contributors = [{ name: instanceDetails.contributors.name }];
              }
            }
            
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
            console.log('Publication:', publication);

            const enhancedItem = {
              ...item,
              copiedItem: {
                ...item.copiedItem,
                contributors,
                publication
              }
            };
            console.log('Enhanced item:', enhancedItem.id, enhancedItem.copiedItem.contributors?.length, enhancedItem.copiedItem.publication?.length);
            return enhancedItem;
          }
          return item;
        });
        
        const enhancedItems = await Promise.all(detailPromises);
        
        normalized = normalized.map(item => {
          if (!item.isElectronic) {
            const enhancedItem = enhancedItems.find(enhanced => enhanced.id === item.id);
            if (enhancedItem) {
              console.log('Using enhanced data for item:', item.id);
              return enhancedItem;
            }
            console.log('No enhanced data found for item:', item.id);
            return item;
          }
          return item;
        });

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
  
      const courseData = await fetchCourseData(record);
      setCourse(courseData);
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

  const isRecordVisible = useCallback((item) => {
    if (item.isElectronic && item.resource) {
      if (isAuthenticated) return true;

      const now = new Date();
      
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

  const combinedResults = useMemo(() => {
    const filteredBySearch = searchQuery.trim() !== ''
      ? records.filter(item =>
          item.copiedItem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.copiedItem.contributors?.some(c =>
            c.name?.toLowerCase().includes(searchQuery.toLowerCase())
          ))
        )
      : records;
  
    const filtered = filter === 'all'
      ? filteredBySearch
      : filteredBySearch.filter(item =>
          filter === 'electronic' ? item.isElectronic : !item.isElectronic
        );

    const visibilityFiltered = filtered.filter(item => isRecordVisible(item));
  
    const electronicResources = visibilityFiltered.filter(item => item.isElectronic);
    const hasElectronic = electronicResources.length > 0;
    
    const allElectronicHave999 = hasElectronic && 
      electronicResources.every(item => item.order === 999 || item.order === "999");
    
    const hasSpecificOrders = visibilityFiltered.some(item => 
      item.order != null && item.order !== 999 && item.order !== "999"
    );

    if (!hasElectronic || (allElectronicHave999 && !hasSpecificOrders)) {
      console.log('Using original server order - no electronic or all 999 orders');
      
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
    
      const groupedArray = Object.entries(groupedTemp)
        .map(([folder, items]) => ({
          folder,
          items
        }))
        .sort((a, b) =>
          a.folder.toLowerCase().localeCompare(b.folder.toLowerCase())
        );
    
      const merged = [];
      let i = 0, j = 0;
      while (i < ungroupedTemp.length && j < groupedArray.length) {
        const firstUngrouped = ungroupedTemp[i];
        const firstInGroup = groupedArray[j].items[0];
        
        const ungroupedIndex = visibilityFiltered.indexOf(firstUngrouped);
        const groupedIndex = visibilityFiltered.indexOf(firstInGroup);
        
        if (ungroupedIndex <= groupedIndex) {
          merged.push(ungroupedTemp[i++]);
        } else {
          merged.push(groupedArray[j++]);
        }
      }
      while (i < ungroupedTemp.length) merged.push(ungroupedTemp[i++]);
      while (j < groupedArray.length)   merged.push(groupedArray[j++]);
    
      return merged;
    }
    
    if (hasSpecificOrders) {
      console.log('Using specific order sorting');
      const sortedFiltered = visibilityFiltered
        .slice()
        .sort((a, b) => {
          const ao = a.order != null ? Number(a.order) : Infinity;
          const bo = b.order != null ? Number(b.order) : Infinity;
          
          if (ao === 999 && bo === 999) {
            return 0;
          }
          
          if (ao !== bo) return ao - bo;
          
          return a.copiedItem.title
            .toLowerCase()
            .localeCompare(b.copiedItem.title.toLowerCase());
        });

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
    
      const groupedArray = Object.entries(groupedTemp)
        .map(([folder, items]) => ({
          folder,
          items
        }))
        .sort((a, b) =>
          a.folder.toLowerCase().localeCompare(b.folder.toLowerCase())
        );
    
      const merged = [];
      let i = 0, j = 0;
      while (i < ungroupedTemp.length && j < groupedArray.length) {
        const firstUngrouped = ungroupedTemp[i];
        const firstInGroup = groupedArray[j].items[0];
        
        const ungroupedIndex = sortedFiltered.indexOf(firstUngrouped);
        const groupedIndex = sortedFiltered.indexOf(firstInGroup);
        
        if (ungroupedIndex <= groupedIndex) {
          merged.push(ungroupedTemp[i++]);
        } else {
          merged.push(groupedArray[j++]);
        }
      }
      while (i < ungroupedTemp.length) merged.push(ungroupedTemp[i++]);
      while (j < groupedArray.length)   merged.push(groupedArray[j++]);
    
      return merged;
    }
  
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
  
    ungroupedTemp.sort((a, b) =>
      a.copiedItem.title.toLowerCase()
        .localeCompare(b.copiedItem.title.toLowerCase())
    );
  
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
    while (i < ungroupedTemp.length) merged.push(ungroupedTemp[i++]);
    while (j < groupedArray.length)   merged.push(groupedArray[j++]);
  
    return merged;
  }, [records, filter, searchQuery, isRecordVisible]);

  const processedRecords = useMemo(() => {
    let hiddenCount = 0;
    let visibleCount = 0;
    let upcomingDates = [];

    const checkRecordVisibility = (item) => {
      if (item.isElectronic && item.resource) {
        if (isAuthenticated) return { isVisible: true };

        const now = new Date();
        
        const usePrimaryLinkVisibility = item.resource.use_primary_link_visibility === "1" || 
                                       item.resource.use_primary_link_visibility === 1 || 
                                       item.resource.use_primary_link_visibility === true;
        
        if (usePrimaryLinkVisibility) {
          const startVisibility = item.resource.primary_link_start_visibility
            ? new Date(item.resource.primary_link_start_visibility + 'T00:00:00')
            : null;
          const endVisibility = item.resource.primary_link_end_visibility
            ? new Date(item.resource.primary_link_end_visibility + 'T23:59:59')
            : null;
            
          if (startVisibility && now < startVisibility) {
            upcomingDates.push(startVisibility);
            return { isVisible: false, startDate: startVisibility };
          }
          
          if (endVisibility && now > endVisibility) {
            return { isVisible: false };
          }
        } else {
          const useResourceVisibility = item.resource.use_resource_visibility === "1" || 
                                       item.resource.use_resource_visibility === 1 || 
                                       item.resource.use_resource_visibility === true;
          
          if (useResourceVisibility) {
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

    records.forEach(record => {
      const visibility = checkRecordVisibility(record);
      if (visibility.isVisible) {
        visibleCount++;
      } else {
        hiddenCount++;
      }
    });

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

  return {
    materials: records,
    course,
    isLoading,
    error,
    availability,
    reserveBarcodesByInstance,
    hasElectronicReserves,
    openAccordions,
    toggleAccordion,
    combinedResults,
    hiddenCount,
    visibleCount,
    nextAvailableDate,
    refetch: fetchAllData,
  };
}

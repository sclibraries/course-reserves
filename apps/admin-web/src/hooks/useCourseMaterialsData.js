import { useCallback, useEffect, useState } from 'react';
import {
  fetchRecords,
  fetchCourseData,
  fetchItemAvailabilityData,
  fetchCrossLinkedCourses,
  fetchMergedResources,
} from '../components/page-sections/course-record/api';
import { folioSearchService } from '../services/folioSearchService';
import { enrichCourseMaterials } from '../util/courseMaterials/enrichCourseMaterials';
import { normalizeCourseMaterials } from '../util/courseMaterials/normalizeCourseMaterials';
import { prepareCourseMaterials } from '../util/courseMaterials/prepareCourseMaterials';

export function useCourseMaterialsData(record) {
  const [records, setRecords] = useState([]);
  const [course, setCourse] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState({});
  const [reserveBarcodesByInstance, setReserveBarcodesByInstance] = useState({});
  const [hasElectronicReserves, setHasElectronicReserves] = useState(false);

  const fetchInventoryDetails = useCallback(async (instanceId) => {
    if (!instanceId) return null;
    try {
      const response = await folioSearchService.getInventory(instanceId);
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

      const preparedMaterials = prepareCourseMaterials(mergedResources, printReserves);

      let crossLinkedCourses = [];
      try {
        crossLinkedCourses = await fetchCrossLinkedCourses(record);
        console.log('Cross-linked courses:', crossLinkedCourses);
      } catch (err) {
        console.warn('Failed to fetch cross-linked courses:', err);
        crossLinkedCourses = [];
      }

      const normalized = normalizeCourseMaterials({
        ...preparedMaterials,
        crossLinkedCourses,
      });
      const enrichedRecords = await enrichCourseMaterials(
        normalized.records,
        normalized.hasAnyPhysical,
        fetchInventoryDetails,
      );

      setRecords(enrichedRecords);

      const courseData = await fetchCourseData(record);
      setCourse(courseData);
      setHasElectronicReserves(enrichedRecords.some(resource => resource.isElectronic));

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

  return {
    records,
    course,
    isLoading,
    error,
    availability,
    reserveBarcodesByInstance,
    hasElectronicReserves,
    refetch: fetchAllData,
  };
}

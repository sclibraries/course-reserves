import { useMemo } from 'react';
import { buildCombinedResults } from '../util/courseMaterials/buildCombinedResults';
import { getVisibilityCounts } from '../util/courseMaterials/getVisibilityCounts';
import { useCourseMaterialsAccordions } from './useCourseMaterialsAccordions';
import { useCourseMaterialsData } from './useCourseMaterialsData';

export function useCourseMaterials(
  record,
  { filter = 'all', searchQuery = '', canBypassVisibility = false } = {},
) {
  const data = useCourseMaterialsData(record);
  const { openAccordions, toggleAccordion } = useCourseMaterialsAccordions(data.records);

  const combinedResults = useMemo(
    () => buildCombinedResults(data.records, filter, searchQuery, canBypassVisibility),
    [data.records, filter, searchQuery, canBypassVisibility],
  );
  const { hiddenCount, visibleCount, nextAvailableDate } = useMemo(
    () => getVisibilityCounts(data.records, canBypassVisibility),
    [data.records, canBypassVisibility],
  );

  return {
    materials: data.records,
    course: data.course,
    isLoading: data.isLoading,
    error: data.error,
    availability: data.availability,
    reserveBarcodesByInstance: data.reserveBarcodesByInstance,
    hasElectronicReserves: data.hasElectronicReserves,
    openAccordions,
    toggleAccordion,
    combinedResults,
    hiddenCount,
    visibleCount,
    nextAvailableDate,
    refetch: data.refetch,
  };
}

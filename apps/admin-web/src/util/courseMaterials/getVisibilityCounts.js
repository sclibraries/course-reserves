import { getItemVisibility } from '../resourceVisibility';

export function getVisibilityCounts(records, canBypassVisibility) {
  let hiddenCount = 0;
  let visibleCount = 0;
  const upcomingDates = [];

  records.forEach(record => {
    const visibility = getItemVisibility(record, canBypassVisibility);
    if (visibility.isVisible) {
      visibleCount++;
    } else {
      hiddenCount++;
      if (visibility.startDate) upcomingDates.push(visibility.startDate);
    }
  });

  const nextAvailableDate = upcomingDates.length > 0
    ? new Date(Math.min(...upcomingDates.map(date => date.getTime())))
    : null;

  return {
    hiddenCount,
    visibleCount,
    totalCount: hiddenCount + visibleCount,
    nextAvailableDate,
  };
}

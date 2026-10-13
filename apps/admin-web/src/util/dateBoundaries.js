const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a date boundary without converting date-only values to UTC.
 * Timestamp values keep their exact time and timezone semantics.
 *
 * @param {string|Date|null} value - Date boundary value
 * @param {'start'|'end'} boundary - Boundary side to parse
 * @returns {Date|null} Parsed boundary, or null when absent/invalid
 */
export const parseDateBoundary = (value, boundary = 'start') => {
  if (!value) return null;

  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(
      DATE_ONLY_PATTERN.test(value)
        ? `${value}T${boundary === 'end' ? '23:59:59.999' : '00:00:00.000'}`
        : value
    );

  return Number.isNaN(date.getTime()) ? null : date;
};

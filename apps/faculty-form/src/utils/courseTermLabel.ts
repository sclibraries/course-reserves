export const formatAcademicPeriod = (academicPeriod?: string | null): string => {
  const value = academicPeriod?.trim() || '';
  const match = /^AP_(\d{4})(\d{2})$/.exec(value);
  if (!match) return value;

  const month = Number(match[2]);
  if (month < 1 || month > 12) return value;

  const season = month <= 5 ? 'Spring' : month <= 8 ? 'Summer' : 'Fall';
  return `${season} ${match[1]}`;
};

export const getCourseTermLabel = (
  folioTermName?: string | null,
  academicPeriod?: string | null,
): string => folioTermName?.trim() || formatAcademicPeriod(academicPeriod) || 'Unknown Term';

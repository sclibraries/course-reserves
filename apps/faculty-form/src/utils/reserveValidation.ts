export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface CourseInfoLike {
  courseCode?: string | null;
  courseTitle?: string | null;
}

interface ReserveItemLike {
  title?: string | null;
  materialType?: string | null;
  isbn?: string | null;
  doi?: string | null;
  url?: string | null;
  displayStartDate?: Date | string | null;
  displayEndDate?: Date | string | null;
}

interface ReserveLike extends CourseInfoLike {
  items?: ReserveItemLike[];
}

const hasControlCharacters = (value: string) =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127);
  });

const normalizeDate = (value?: Date | string | null) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateCourseInfo = (course: CourseInfoLike): ValidationResult => {
  const errors: string[] = [];
  const courseCode = (course.courseCode || '').trim();
  const courseTitle = (course.courseTitle || '').trim();

  if (!courseCode) {
    errors.push('Course code is required.');
  } else {
    if (courseCode.length > 64) {
      errors.push('Course code must be 64 characters or fewer.');
    }
    if (!/[A-Za-z]/u.test(courseCode) || !/\d/u.test(courseCode)) {
      errors.push('Course code must include both letters and numbers.');
    }
    if (hasControlCharacters(courseCode)) {
      errors.push('Course code cannot contain control characters.');
    }
  }

  if (!courseTitle) {
    errors.push('Course title is required.');
  } else {
    if (courseTitle.length < 2 || courseTitle.length > 500) {
      errors.push('Course title must be between 2 and 500 characters.');
    }
    if (hasControlCharacters(courseTitle)) {
      errors.push('Course title cannot contain control characters.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateReserveItem = (item: ReserveItemLike): ValidationResult => {
  const errors: string[] = [];
  const title = (item.title || '').trim();
  const materialType = (item.materialType || '').trim();
  const isbn = (item.isbn || '').trim();
  const doi = (item.doi || '').trim();
  const url = (item.url || '').trim();
  const displayStartDate = normalizeDate(item.displayStartDate);
  const displayEndDate = normalizeDate(item.displayEndDate);

  if (!title) {
    errors.push('Item title is required.');
  } else {
    if (hasControlCharacters(title)) {
      errors.push('Item title cannot contain control characters.');
    }
  }

  if (!materialType) {
    errors.push('Material type is required.');
  }

  if (isbn) {
    const compactIsbn = isbn.replace(/[-\s]/gu, '');
    if (!/^\d{10}$|^\d{13}$/u.test(compactIsbn)) {
      errors.push('ISBN must be a valid 10 or 13 digit ISBN.');
    }
  }

  if (doi && !/^10\.\d{4,9}\/\S+$/u.test(doi)) {
    errors.push('DOI must start with 10. and include a suffix.');
  }

  if (url && !isValidHttpUrl(url)) {
    errors.push('URL must start with http:// or https://.');
  }

  if ((item.displayStartDate && !displayStartDate) || (item.displayEndDate && !displayEndDate)) {
    errors.push('Display dates must be valid dates.');
  }

  if (displayStartDate && displayEndDate && displayEndDate < displayStartDate) {
    errors.push('Display end date must be on or after the start date.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateReserveForSubmission = (reserve: ReserveLike): ValidationResult => {
  const errors = [...validateCourseInfo(reserve).errors];

  (reserve.items || []).forEach((item, index) => {
    validateReserveItem(item).errors.forEach((error) => {
      const title = (item.title || '').trim();
      const itemLabel = title ? ` "${title.length > 80 ? `${title.slice(0, 77)}...` : title}"` : '';
      errors.push(`Item ${index + 1}${itemLabel}: ${error}`);
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

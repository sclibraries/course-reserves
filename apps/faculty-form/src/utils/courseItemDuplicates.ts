import type { CourseItem } from '@/store/courseReservesStore';

export interface DuplicateCourseItemMatch {
  item: CourseItem;
  matchField: 'barcode' | 'doi' | 'isbn' | 'url' | 'titleAuthors';
}

export function findDuplicateCourseItem(
  existingItems: CourseItem[],
  candidate: Partial<CourseItem>
): DuplicateCourseItemMatch | undefined {
  for (const item of existingItems) {
    if (sameNormalizedValue(normalizeText(item.barcode), normalizeText(candidate.barcode))) {
      return { item, matchField: 'barcode' };
    }

    if (sameNormalizedValue(normalizeDoi(item.doi), normalizeDoi(candidate.doi))) {
      return { item, matchField: 'doi' };
    }

    if (sameNormalizedValue(normalizeIsbn(item.isbn), normalizeIsbn(candidate.isbn))) {
      return { item, matchField: 'isbn' };
    }

    if (sameNormalizedValue(normalizeUrl(item.url), normalizeUrl(candidate.url))) {
      return { item, matchField: 'url' };
    }

    if (
      sameNormalizedValue(normalizeText(item.title), normalizeText(candidate.title)) &&
      sameNormalizedValue(normalizeText(item.authors), normalizeText(candidate.authors))
    ) {
      return { item, matchField: 'titleAuthors' };
    }
  }

  return undefined;
}

function sameNormalizedValue(left?: string, right?: string): boolean {
  return Boolean(left && right && left === right);
}

function normalizeText(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized || undefined;
}

function normalizeDoi(value?: string): string | undefined {
  return normalizeText(value)
    ?.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '');
}

function normalizeIsbn(value?: string): string | undefined {
  const normalized = value?.replace(/[^0-9xX]/g, '').toUpperCase();
  return normalized || undefined;
}

function normalizeUrl(value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value);
    url.hash = '';
    const pathname = url.pathname.replace(/\/$/, '');
    return `${url.hostname.toLowerCase()}${pathname}${url.search}` || undefined;
  } catch {
    return normalizeText(value);
  }
}

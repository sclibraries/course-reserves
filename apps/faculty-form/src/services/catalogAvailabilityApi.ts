import { API_ENDPOINTS, DEFAULT_CONFIG } from '@/config/endpoints';
import { getAuthHeaders } from '@/store/authStore';

export interface CatalogAvailabilityCopy {
  library: string | null;
  location: string | null;
  callNumber: string | null;
  status: string | null;
  loanType: string | null;
}

export interface CatalogAvailability {
  instanceId: string | null;
  copies?: CatalogAvailabilityCopy[];
  error?: true;
  reference?: string;
}

interface CatalogAvailabilityResponse {
  records?: Record<string, CatalogAvailability>;
}

export const CATALOG_AVAILABILITY_BATCH_SIZE = 20;
export const CATALOG_AVAILABILITY_CACHE_TTL_MS = 2 * 60 * 1000;

interface CachedCatalogAvailability {
  promise: Promise<CatalogAvailability>;
  expiresAt: number;
}

const availabilityByAn = new Map<string, CachedCatalogAvailability>();

export function getCatalogAvailabilityExpiresAt(accessionNumber: string): number | undefined {
  return availabilityByAn.get(accessionNumber)?.expiresAt;
}

export async function getCatalogAvailability(accessionNumbers: string[]): Promise<Record<string, CatalogAvailability>> {
  const uniqueAccessionNumbers = Array.from(new Set(accessionNumbers));
  const uncached = uniqueAccessionNumbers.filter((an) => {
    const cached = availabilityByAn.get(an);
    if (!cached) return true;
    if (cached.expiresAt > Date.now()) return false;
    availabilityByAn.delete(an);
    return true;
  });

  for (let index = 0; index < uncached.length; index += CATALOG_AVAILABILITY_BATCH_SIZE) {
    const batch = uncached.slice(index, index + CATALOG_AVAILABILITY_BATCH_SIZE);
    const request = requestCatalogAvailability(batch);
    batch.forEach((an) => {
      let cached: CachedCatalogAvailability;
      const promise = request.then((records) => {
        const entry = records[an];
        if (!entry) throw new Error('Availability lookup failed');
        cached.expiresAt = Date.now() + CATALOG_AVAILABILITY_CACHE_TTL_MS;
        return entry;
      }).catch((error: unknown) => {
        if (availabilityByAn.get(an) === cached) availabilityByAn.delete(an);
        throw error;
      });
      cached = { promise, expiresAt: Number.POSITIVE_INFINITY };
      availabilityByAn.set(an, cached);
    });
  }

  const entries = await Promise.all(uniqueAccessionNumbers.map(async (an) => (
    [an, await availabilityByAn.get(an)!.promise] as [string, CatalogAvailability]
  )));
  return Object.fromEntries(entries);
}

async function requestCatalogAvailability(accessionNumbers: string[]): Promise<Record<string, CatalogAvailability>> {
  const params = new URLSearchParams({ an: accessionNumbers.join(',') });
  const url = API_ENDPOINTS.COURSE_RESERVES.BASE_URL
    + API_ENDPOINTS.COURSE_RESERVES.CATALOG_AVAILABILITY + '?' + params.toString();
  const response = await fetch(url, {
    method: 'GET',
    headers: { ...DEFAULT_CONFIG.headers, ...getAuthHeaders() },
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Availability lookup failed');

  const payload = await response.json() as CatalogAvailabilityResponse;
  if (!payload.records) throw new Error('Availability lookup failed');
  return payload.records;
}

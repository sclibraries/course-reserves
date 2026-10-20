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

const availabilityByPendingAn = new Map<string, Promise<CatalogAvailability>>();

export async function getCatalogAvailability(accessionNumbers: string[]): Promise<Record<string, CatalogAvailability>> {
  const uniqueAccessionNumbers = Array.from(new Set(accessionNumbers));
  const newAccessionNumbers = uniqueAccessionNumbers.filter((an) => !availabilityByPendingAn.has(an));
  if (newAccessionNumbers.length > 0) {
    const request = requestCatalogAvailability(newAccessionNumbers);
    newAccessionNumbers.forEach((an) => {
      const pending = request.then((records) => {
        if (!records[an]) throw new Error('Availability lookup failed');
        return records[an];
      }).finally(() => {
        if (availabilityByPendingAn.get(an) === pending) availabilityByPendingAn.delete(an);
      });
      availabilityByPendingAn.set(an, pending);
    });
  }

  const entries = await Promise.all(uniqueAccessionNumbers.map(async (an) => (
    [an, await availabilityByPendingAn.get(an)!] as [string, CatalogAvailability]
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

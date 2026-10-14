import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { adminCustomizationService } from './adminCustomizationService';

const courseApi = config.api.urls.courseReserves;
const token = 'Bearer synthetic-aw043-token';
const headers = {
  'Content-Type': 'application/json',
  Authorization: token,
};
const result = { id: 17, enabled: true };

let fetchMock;

beforeEach(() => {
  document.cookie = 'accessToken=synthetic-aw043-token; path=/';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  document.cookie = 'accessToken=; Max-Age=0; path=/';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('adminCustomizationService characterization', () => {
  it('keeps customization reads unauthenticated', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(result) });

    await expect(adminCustomizationService.getCustomization()).resolves.toEqual(result);

    expect(fetchMock.mock.calls).toEqual([[
      `${courseApi}${config.api.endpoints.customizations.getCustomizations}`,
    ]]);
  });

  it('sends the cookie token while updating a customization', async () => {
    const data = { enabled: false, notes: 'Synthetic setting' };
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(result) });

    await expect(adminCustomizationService.updateCustomization(18, data)).resolves.toEqual(result);

    expect(fetchMock.mock.calls).toEqual([[
      `${courseApi}${config.api.endpoints.customizations.updateCustomizations}/18`,
      { method: 'PUT', headers, body: JSON.stringify(data) },
    ]]);
  });

  it('sends the cookie token while updating a customization section', async () => {
    const section = { section_name: 'visibility', visible: true };
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(result) });

    await expect(adminCustomizationService.updateCustomizationSection(19, section)).resolves.toEqual(result);

    expect(fetchMock.mock.calls).toEqual([[
      `${courseApi}${config.api.endpoints.customizations.updateCustomizations}/19`,
      { method: 'PUT', headers, body: JSON.stringify(section) },
    ]]);
  });

  it('preserves the customization update error when the API rejects the request', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(adminCustomizationService.updateCustomization(18, { enabled: false }))
      .rejects.toThrow('Error updating customization data.');
    expect(fetchMock.mock.calls).toEqual([[
      `${courseApi}${config.api.endpoints.customizations.updateCustomizations}/18`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ enabled: false }),
      },
    ]]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { adminMaterialTypeService } from './adminMaterialTypeService';

vi.mock('../../config', () => ({
  config: {
    api: {
      urls: { courseReserves: 'https://configured-api.example/course-reserves' },
      getAuthToken: () => 'Bearer synthetic-aw048-token',
      endpoints: {
        courseReserves: {
          materialTypes: { all: '/material-type/all', fields: '/material-type/fields' },
        },
      },
    },
  },
}));

describe('adminMaterialTypeService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gets material types from the configured course-reserves endpoint', async () => {
    const materialTypes = [{ id: 1, name: 'Book' }];
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(materialTypes) });

    await expect(adminMaterialTypeService.getMaterialTypes()).resolves.toBe(materialTypes);

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.api.urls.courseReserves}${config.api.endpoints.courseReserves.materialTypes.all}`,
      { headers: { Authorization: 'Bearer synthetic-aw048-token' } },
    );
  });

  it('gets fields for the requested material type from the configured endpoint', async () => {
    const fields = [{ name: 'author' }];
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(fields) });

    await expect(adminMaterialTypeService.getMaterialTypeFields(42)).resolves.toBe(fields);

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.api.urls.courseReserves}${config.api.endpoints.courseReserves.materialTypes.fields}?material_type_id=42`,
      { headers: { Authorization: 'Bearer synthetic-aw048-token' } },
    );
  });

  it('encodes material type IDs in the exact authenticated request URL', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([]) });

    await adminMaterialTypeService.getMaterialTypeFields('42 & 43');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://configured-api.example/course-reserves/material-type/fields?material_type_id=42%20%26%2043',
      { headers: { Authorization: 'Bearer synthetic-aw048-token' } },
    );
  });

  it('keeps the material type error when the server rejects the request', async () => {
    fetchMock.mockResolvedValue({ ok: false });

    await expect(adminMaterialTypeService.getMaterialTypes()).rejects.toThrow(
      'Failed to fetch material types'
    );
  });
});

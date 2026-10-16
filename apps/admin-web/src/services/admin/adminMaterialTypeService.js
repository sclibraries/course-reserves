import { config } from '../../config';
import { authFetch } from '../http/authFetch';

export const adminMaterialTypeService = {
  async getMaterialTypes() {
    const response = await authFetch(
      `${config.api.urls.courseReserves}${config.api.endpoints.courseReserves.materialTypes.all}`
    );
    if (!response.ok) throw new Error("Failed to fetch material types");
    return response.json();
  },

  async getMaterialTypeFields(materialTypeId) {
    const response = await authFetch(
      `${config.api.urls.courseReserves}${config.api.endpoints.courseReserves.materialTypes.fields}?material_type_id=${encodeURIComponent(materialTypeId)}`
    );
    if (!response.ok) throw new Error("Failed to fetch material type fields");
    return response.json();
  },
};

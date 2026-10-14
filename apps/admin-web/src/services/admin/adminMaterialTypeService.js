import { config } from '../../config';

export const adminMaterialTypeService = {
  async getMaterialTypes() {
    const response = await fetch(
      `${config.api.urls.courseReserves}${config.api.endpoints.courseReserves.materialTypes.all}`
    );
    if (!response.ok) throw new Error("Failed to fetch material types");
    return response.json();
  },

  async getMaterialTypeFields(materialTypeId) {
    const response = await fetch(
      `${config.api.urls.courseReserves}${config.api.endpoints.courseReserves.materialTypes.fields}?material_type_id=${materialTypeId}`
    );
    if (!response.ok) throw new Error("Failed to fetch material type fields");
    return response.json();
  },
};

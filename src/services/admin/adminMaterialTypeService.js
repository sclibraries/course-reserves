const API_BASE = "https://libtools2.smith.edu/course-reserves/backend/web/material-type";

export const adminMaterialTypeService = {
  async getMaterialTypes() {
    const response = await fetch(`${API_BASE}/all`);
    if (!response.ok) throw new Error("Failed to fetch material types");
    return response.json();
  },

  async getMaterialTypeFields(materialTypeId) {
    const response = await fetch(`${API_BASE}/fields?material_type_id=${materialTypeId}`);
    if (!response.ok) throw new Error("Failed to fetch material type fields");
    return response.json();
  },
};

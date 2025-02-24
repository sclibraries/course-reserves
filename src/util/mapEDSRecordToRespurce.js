import { EDS_TO_DB_FIELD_MAPPING } from "../constants/edsFieldMapping";
import { adminMaterialTypeService } from "../services/admin/adminMaterialTypeService";

// Optionally, you could cache material types outside of this function if needed.
let cachedMaterialTypes = null;

/**
 * Maps an EDS record to a resource object for the local database.
 * Fetches material types and fields to determine the proper mapping.
 *
 * @param {Object} record - The EDS record to be transformed.
 * @returns {Promise<Object>} The mapped resource object.
 */
export const mapEdsRecordToResource = async (record) => {
  try {
    const items = record.Items || [];
    const recordInfo = record.RecordInfo?.BibRecord?.BibEntity || {};

    // Extract title (with fallback)
    const title =
      items.find((it) => it.Name === "Title")?.plainText ||
      recordInfo.Titles?.[0]?.TitleFull ||
      "(No Title)";

    // Extract link (PLink or URL)
    const link =
      items.find((it) => it.Name === "URL")?.links?.[0]?.href ||
      record.PLink ||
      "";

    // Extract author (fallback to BibEntity if needed)
    const author =
      items.find((it) => it.Name === "Author")?.plainText ||
      (recordInfo.Authors ? recordInfo.Authors.map((a) => a.Name).join(", ") : "") ||
      "";

    // Extract publication type (TypePub)
    const typePub =
      items.find((it) => it.Name === "TypePub")?.plainText || "Unknown";

    // Determine material type using keywords from typePub
    let materialType = "website"; // default fallback
    if (typePub.toLowerCase().includes("book")) {
      materialType = "book";
    } else if (typePub.toLowerCase().includes("article")) {
      materialType = "article";
    } else if (typePub.toLowerCase().includes("video") || typePub.toLowerCase().includes("media")) {
      materialType = "media";
    }

    // Cache material types to avoid repeated network calls.
    if (!cachedMaterialTypes) {
      const materialTypesResponse = await adminMaterialTypeService.getMaterialTypes();
      cachedMaterialTypes = materialTypesResponse.data;
    }
    const materialTypeObj = cachedMaterialTypes.find((t) => t.name === materialType);
    const materialTypeId = materialTypeObj ? parseInt(materialTypeObj.material_type_id, 10) : null;

    // Fetch fields for this material type if an ID is found.
    let materialTypeFields = [];
    if (materialTypeId) {
      const materialTypeResponse = await adminMaterialTypeService.getMaterialTypeFields(materialTypeId);
      materialTypeFields = materialTypeResponse.data || [];
    }

    // Initialize resource structure.
    const resourceData = {
      title,
      link,
      material_type: materialTypeId, // numeric ID now
      metadata: {}
    };

    // Get the mapping for this material type.
    const fieldMapping = EDS_TO_DB_FIELD_MAPPING[materialType] || {};

    // Map EDS fields to the resource's metadata.
    materialTypeFields.forEach((field) => {
      // The mapping defines which EDS field corresponds to this db field.
      const edsFieldName = fieldMapping[field.field_name];
      if (!edsFieldName) return;

      // Extract value from EDS response.
      let edsFieldValue =
        items.find((it) => it.Name === edsFieldName)?.plainText ||
        recordInfo[edsFieldName] ||
        "";

      // Special handling for the `is_ebook` field.
      if (field.field_name === "is_ebook") {
        edsFieldValue = typePub.toLowerCase().includes("ebook") ? "Yes" : "No";
      }

      // Store the mapped value.
      resourceData.metadata[field.field_name] = edsFieldValue;
    });

    // Optionally add the author field if desired.
    // resourceData.metadata.author = author;

    return resourceData;
  } catch (err) {
    console.error("Error in mapEdsRecordToResource:", err);
    throw err;
  }
};

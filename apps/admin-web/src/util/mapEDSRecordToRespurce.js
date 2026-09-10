import { EDS_TO_DB_FIELD_MAPPING } from "../constants/edsFieldMapping";
import { adminMaterialTypeService } from "../services/admin/adminMaterialTypeService";

let cachedMaterialTypes = null;

/**
 * Decode HTML entities in text
 */
const decodeHtmlEntities = (text) => {
  if (!text) return text;
  if (typeof text !== 'string') return text;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

/**
 * Maps an EDS record to a resource object for the local database.
 * Updated to work with the new robust EBSCO backend API structure.
 * Fetches material types and fields to determine the proper mapping.
 *
 * @param {Object} record - The EDS record to be transformed (new structure with Items.Ti, Items.Au, etc.)
 * @returns {Promise<Object>} The mapped resource object.
 */
export const mapEdsRecordToResource = async (record) => {
  try {
    const items = record.Items || {};
    const recordInfo = record.RecordInfo?.BibEntity || {};

    // Extract title from new CleanData structure
    const titleData = items.Ti?.[0]?.CleanData;
    const rawTitle = (typeof titleData === 'string' ? titleData : titleData?.[0]) ||
                     recordInfo.Titles?.[0]?.TitleFull ||
                     "(No Title)";
    const title = decodeHtmlEntities(rawTitle);

    // Extract link - prioritize FullTextCustomLinks, then URL from items
    const urlData = items.URL?.[0]?.CleanData;
    const urlFromItems = typeof urlData === 'string' ? urlData : urlData?.[0];
    const link = record.FullTextCustomLinks?.[0]?.Url ||
                 urlFromItems ||
                 record.PLink ||
                 "";

    // Extract publication type from top-level pubType (recommended in new structure)
    const typePub = record.pubType || "Unknown";

    // Determine material type using keywords from typePub
    let materialType = "website"; // default fallback
    const typePubLower = typePub.toLowerCase();
    if (typePubLower.includes("book")) {
      materialType = "book";
    } else if (typePubLower.includes("article") || typePubLower.includes("journal")) {
      materialType = "article";
    } else if (typePubLower.includes("video") || typePubLower.includes("media")) {
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

    // Map EDS fields to the resource's metadata using new structure
    materialTypeFields.forEach((field) => {
      // The mapping defines which EDS field corresponds to this db field.
      const edsFieldName = fieldMapping[field.field_name];
      if (!edsFieldName) return;

      // Extract value from new EDS Items structure (CleanData)
      let edsFieldValue = "";
      
      // Map old field names to new structure
      const fieldMap = {
        'Title': 'Ti',
        'Author': 'Au',
        'Source': 'Src',
        'Subject': 'Su',
        'Abstract': 'Ab',
        'URL': 'URL',
        'TypePub': null // Now in top-level pubType
      };
      
      const newFieldKey = fieldMap[edsFieldName] || edsFieldName;
      
      if (newFieldKey && items[newFieldKey]) {
        const fieldData = items[newFieldKey][0]?.CleanData;
        if (typeof fieldData === 'string') {
          edsFieldValue = decodeHtmlEntities(fieldData);
        } else if (Array.isArray(fieldData)) {
          edsFieldValue = fieldData.map(v => decodeHtmlEntities(v)).join('; ');
        } else {
          edsFieldValue = decodeHtmlEntities(items[newFieldKey][0]?.Data) || "";
        }
      } else if (edsFieldName === 'TypePub') {
        edsFieldValue = typePub;
      } else {
        edsFieldValue = decodeHtmlEntities(recordInfo[edsFieldName]) || "";
      }

      // Special handling for the `is_ebook` field.
      if (field.field_name === "is_ebook") {
        edsFieldValue = typePubLower.includes("ebook") ? "Yes" : "No";
      }

      // Store the mapped value.
      if (edsFieldValue) {
        resourceData.metadata[field.field_name] = edsFieldValue;
      }
    });

    // Add additional metadata from new structure
    const authorData = items.Au?.[0]?.CleanData;
    const authors = Array.isArray(authorData) ? authorData : (typeof authorData === 'string' ? [authorData] : []);
    if (authors.length > 0) {
      resourceData.metadata.author = authors.map(a => decodeHtmlEntities(a)).join('; ');
    }
    
    // Add abstract if available
    const abstractData = items.Ab?.[0]?.CleanData;
    const rawAbstract = typeof abstractData === 'string' ? abstractData : abstractData?.[0];
    if (rawAbstract) {
      resourceData.metadata.abstract = decodeHtmlEntities(rawAbstract);
    }
    
    // Add database information
    if (record.DbLabel) {
      resourceData.metadata.database = record.DbLabel;
    }
    
    // Add accession number for reference
    if (record.An) {
      resourceData.metadata.accession_number = record.An;
    }

    return resourceData;
  } catch (err) {
    console.error("Error in mapEdsRecordToResource:", err);
    throw err;
  }
};

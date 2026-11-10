import { parseEBSCORecord } from '@course-reserves/citations';
import { EDS_TO_DB_FIELD_MAPPING } from '../constants/edsFieldMapping';
import { adminMaterialTypeService } from '../services/admin/adminMaterialTypeService';
import { getEdsMaterialType } from './edsMaterialType';
import { metadataBoolean } from './metadataBoolean';

let cachedMaterialTypes = null;

const decodeHtmlEntities = (text) => {
  if (typeof text !== 'string') return text;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

const formatPublicationDate = ({ year, month, day } = {}) => {
  if (!year) return undefined;
  if (!month) return String(year);
  const date = `${year}-${String(month).padStart(2, '0')}`;
  return day ? `${date}-${String(day).padStart(2, '0')}` : date;
};

const firstPubGroupValue = (items) => {
  const item = Object.values(items || {}).flat().find(({ Group }) => Group === 'Pub');
  return Array.isArray(item?.CleanData) ? item.CleanData[0] : item?.CleanData;
};

const parsedValue = (record, parsed, field, materialType) => {
  if (field === 'authors') return parsed.authors.join('; ');
  if (field === 'isbns') return parsed.isbns.join('; ');
  if (field === 'publicationDate') return formatPublicationDate(parsed.publicationDate);
  if (field === 'is_ebook') return metadataBoolean(materialType === 'ebook' ? 'Yes' : 'No');
  if (field === 'publisher') return parsed.publisher || firstPubGroupValue(record.Items);
  return parsed[field];
};

const hasValue = (value) => value !== undefined && value !== null && value !== '';
const asText = (value) => Array.isArray(value)
  ? value.map(decodeHtmlEntities).filter(Boolean).join('; ')
  : decodeHtmlEntities(value);

const OTHER_DETAILS = {
  authors: 'author',
  isbns: 'isbn',
  issn: 'issn',
  doi: 'doi',
  publicationDate: 'publication_date',
  journalTitle: 'journal_title',
  volumeNumber: 'volume',
  issueNumber: 'issue',
  pages: 'pages',
  publisher: 'publisher',
  callNumber: 'call_number',
  location: 'location',
  database: 'database',
};

export const mapEdsRecordToResource = async (record) => {
  try {
    const parsed = parseEBSCORecord(record);
    const materialType = getEdsMaterialType(parsed);

    if (!cachedMaterialTypes) {
      const response = await adminMaterialTypeService.getMaterialTypes();
      cachedMaterialTypes = response.data;
    }
    const materialTypeObj = cachedMaterialTypes.find((type) => type.name === materialType);
    const materialTypeId = materialTypeObj ? Number.parseInt(materialTypeObj.material_type_id, 10) : null;
    const fieldMapping = EDS_TO_DB_FIELD_MAPPING[materialType] || {};
    const mappedFields = new Set(Object.values(fieldMapping));
    const metadata = {};

    Object.entries(fieldMapping).forEach(([fieldName, source]) => {
      const value = parsedValue(record, parsed, source, materialType);
      if (hasValue(value)) metadata[fieldName] = asText(value);
    });

    Object.entries(OTHER_DETAILS).forEach(([source, fieldName]) => {
      if (mappedFields.has(source)) return;
      const value = parsedValue(record, parsed, source, materialType);
      if (hasValue(value)) metadata[fieldName] = asText(value);
    });

    if (hasValue(parsed.id)) metadata.accession_number = asText(parsed.id);

    return {
      title: asText(parsed.title),
      description: asText(parsed.abstract) || '',
      link: record.FullTextCustomLinks?.[0]?.Url || parsed.url || parsed.pLink || '',
      material_type: materialTypeId,
      metadata,
    };
  } catch (error) {
    console.error('Error in mapEdsRecordToResource:', error);
    throw error;
  }
};

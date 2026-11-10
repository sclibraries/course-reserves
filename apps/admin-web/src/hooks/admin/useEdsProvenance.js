import { useMemo } from 'react';
import { EDS_TO_DB_FIELD_MAPPING, OTHER_DETAILS } from '../../constants/edsFieldMapping';

const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const EMPTY_METADATA = Object.freeze({});
const EMPTY_MAPPING = Object.freeze({});
const materialTypeName = (types, id) => types.find((type) => String(type.material_type_id) === String(id))?.name;

export const useEdsProvenance = ({
  initialData = {},
  sourceType,
  materialTypes = [],
  usage,
}) => {
  const metadata = initialData.metadata || EMPTY_METADATA;
  const initialTypeId = initialData.material_type || '';
  const initialTypeName = materialTypeName(materialTypes, initialTypeId);
  const initialMapping = EDS_TO_DB_FIELD_MAPPING[initialTypeName] || EMPTY_MAPPING;
  const isEdsSession = sourceType === 'eds';
  const savedAccession = metadata.accession_number;

  const baseline = useMemo(() => {
    if (!isEdsSession) return null;
    const baselineMetadata = { ...metadata };
    Object.keys(initialMapping).forEach((field) => {
      if (!owns(baselineMetadata, field)) baselineMetadata[field] = '';
    });
    return {
      title: initialData.title || '',
      link: initialData.link,
      material_type_id: String(initialTypeId),
      metadata: baselineMetadata,
    };
  }, [initialData, initialMapping, initialTypeId, isEdsSession, metadata]);

  const sourceValues = useMemo(() => {
    if (!isEdsSession) return {};
    const mappedSources = new Set(Object.values(initialMapping));
    const sourceFields = [
      ...Object.entries(initialMapping).map(([field, source]) => [source, field]),
      ...Object.entries(OTHER_DETAILS).filter(([source]) => !mappedSources.has(source)),
    ];
    return Object.fromEntries(sourceFields.map(([source, field]) => [source, {
      field,
      present: owns(metadata, field),
      value: metadata[field] ?? '',
    }]));
  }, [initialMapping, isEdsSession, metadata]);

  const markerFor = (field, value, typeId = initialTypeId) => {
    if (!baseline) return null;
    if (field === 'link' || field === 'material_type_id') {
      return value === baseline[field] || String(value) === baseline[field] ? 'guessed' : null;
    }
    if (owns(baseline.metadata, field) && value === baseline.metadata[field]) return 'from EDS';
    const typeMap = EDS_TO_DB_FIELD_MAPPING[materialTypeName(materialTypes, typeId)] || EMPTY_MAPPING;
    const source = typeMap[field];
    return source && value === sourceValues[source]?.value ? 'from EDS' : null;
  };

  const remapMetadata = (typeId, currentMetadata, currentTypeId = initialTypeId) => {
    if (!isEdsSession) return currentMetadata;
    const nextMapping = EDS_TO_DB_FIELD_MAPPING[materialTypeName(materialTypes, typeId)] || EMPTY_MAPPING;
    const currentMapping = EDS_TO_DB_FIELD_MAPPING[materialTypeName(materialTypes, currentTypeId)] || EMPTY_MAPPING;
    const currentFieldsBySource = Object.fromEntries(Object.entries(currentMapping).map(([field, source]) => [source, field]));
    const editedSources = new Set(Object.entries(sourceValues)
      .filter(([source, sourceValue]) => {
        const field = currentFieldsBySource[source] || sourceValue.field;
        return field && (currentMetadata[field] ?? '') !== sourceValue.value;
      })
      .map(([source]) => source));
    const nextMetadata = { ...currentMetadata };

    Object.entries(currentMapping).forEach(([field, source]) => {
      const nextField = Object.entries(nextMapping).find(([, mappedSource]) => mappedSource === source)?.[0];
      if (nextField && nextField !== field && !editedSources.has(source)) delete nextMetadata[field];
    });
    Object.entries(nextMapping).forEach(([field, source]) => {
      const sourceValue = sourceValues[source];
      if (!editedSources.has(source) && sourceValue?.present) nextMetadata[field] = sourceValue.value;
    });
    return nextMetadata;
  };

  const accession = savedAccession;
  const title = initialData.title;
  const database = metadata.database;
  let source;
  if (isEdsSession) {
    const details = [title, database, accession && `AN ${accession}`].filter(Boolean).join(' · ');
    source = {
      summary: 'From EDS',
      text: `From EDS: ${details}`,
    };
  } else if (sourceType === 'reuse') {
    source = {
      summary: 'Reusing resource',
      text: usage ? `Reusing "Used in ${usage.course_count} courses"` : 'Reusing resource',
    };
  } else if (sourceType === 'hitchcock') {
    source = { summary: 'Hitchcock', text: 'Hitchcock' };
  } else if (savedAccession) {
    source = { summary: 'Created from EDS', text: `Created from EDS · AN ${savedAccession}` };
  } else {
    source = { summary: 'Manual', text: 'Manual' };
  }

  return { baseline, markerFor, remapMetadata, source };
};

export default useEdsProvenance;

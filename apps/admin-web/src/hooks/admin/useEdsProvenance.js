import { useMemo } from 'react';
import { EDS_TO_DB_FIELD_MAPPING } from '../../constants/edsFieldMapping';

const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const EMPTY_METADATA = Object.freeze({});
const EMPTY_MAPPING = Object.freeze({});
const materialTypeName = (types, id) => types.find((type) => String(type.material_type_id) === String(id))?.name;
const allMappings = Object.values(EDS_TO_DB_FIELD_MAPPING);

const fieldForSource = (source, metadata, typeMapping = {}) => Object.entries(typeMapping)
  .find(([, mappedSource]) => mappedSource === source)?.[0]
  || allMappings.flatMap((mapping) => Object.entries(mapping))
    .find(([field, mappedSource]) => mappedSource === source && owns(metadata, field))?.[0]
  || (owns(metadata, source) ? source : null);

export const useEdsProvenance = ({
  initialData = {},
  sourceType,
  sourceRecord,
  materialTypes = [],
  usage,
}) => {
  const metadata = initialData.metadata || EMPTY_METADATA;
  const initialTypeId = initialData.material_type_id ?? initialData.material_type ?? '';
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
      link: initialData.link || initialData.item_url || '',
      material_type_id: String(initialTypeId),
      metadata: baselineMetadata,
    };
  }, [initialData, initialMapping, initialTypeId, isEdsSession, metadata]);

  const sourceValues = useMemo(() => {
    if (!isEdsSession) return {};
    const sources = new Set(allMappings.flatMap((mapping) => Object.values(mapping)));
    return Object.fromEntries([...sources].map((source) => {
      const field = fieldForSource(source, metadata, initialMapping);
      return [source, { field, present: field !== null && owns(metadata, field), value: field && owns(metadata, field) ? metadata[field] : '' }];
    }));
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
    const editedSources = new Set(Object.entries(sourceValues)
      .filter(([source, sourceValue]) => {
        const field = fieldForSource(source, currentMetadata, currentMapping) || sourceValue.field;
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

  const liveRecord = sourceRecord?.parsedData || sourceRecord || {};
  const liveMetadata = liveRecord.metadata || metadata;
  const accession = liveMetadata.accession_number || savedAccession;
  const title = liveRecord.title || initialData.title || '';
  const database = liveMetadata.database || liveMetadata.library_database || '';
  let source;
  if (isEdsSession) {
    const details = [title, database, accession && `AN ${accession}`].filter(Boolean).join(' · ');
    source = {
      summary: 'From EDS',
      text: `From EDS: ${details}`,
    };
  } else if (sourceType === 'reuse') {
    source = { summary: 'Reusing resource', text: `Reusing "Used in ${usage?.course_count ?? 0} courses"` };
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

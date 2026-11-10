import { useCallback, useMemo, useState } from 'react';
import { EDS_TO_DB_FIELD_MAPPING, OTHER_DETAILS } from '../../constants/edsFieldMapping';

const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const EMPTY_METADATA = Object.freeze({});
const EMPTY_MAPPING = Object.freeze({});
const materialTypeName = (types, id) => types.find((type) => String(type.material_type_id) === String(id))?.name;
const RECORD_FIELDS = {
  title: ['title', 'name'],
  link: ['link', 'item_url'],
  notes: ['notes', 'description'],
  material_type_id: ['material_type_id', 'material_type'],
};

const snapshot = (record) => ({
  title: record.title || record.name || '',
  link: record.link || record.item_url || '',
  notes: record.notes || record.description || '',
  material_type_id: record.material_type_id || record.material_type || '',
  metadata: { ...(record.metadata || {}) },
});

const recordValue = (record, field) => {
  const key = RECORD_FIELDS[field].find((candidate) => owns(record, candidate));
  return key ? record[key] ?? '' : '';
};

const atBaseline = (field, value, baseline) => (
  field === 'material_type_id'
    ? String(value ?? '') === String(baseline ?? '')
    : value === baseline || (value == null && baseline === '')
);

const mergeChangedRecord = (currentData, baseline, nextRecord, savedMetadataKeys) => {
  const metadata = { ...(currentData.metadata || {}) };
  const nextMetadata = nextRecord.metadata || EMPTY_METADATA;
  const savedKeys = new Set(savedMetadataKeys);
  const keptFields = [];
  const data = { ...currentData, metadata };

  Object.keys(RECORD_FIELDS).forEach((field) => {
    const currentValue = currentData[field] ?? '';
    if (atBaseline(field, currentValue, baseline[field])) {
      data[field] = recordValue(nextRecord, field);
    } else {
      keptFields.push(field);
    }
  });

  new Set([
    ...Object.keys(baseline.metadata),
    ...Object.keys(metadata),
    ...Object.keys(nextMetadata),
  ]).forEach((field) => {
    const currentValue = metadata[field] ?? '';
    const baselineValue = baseline.metadata[field] ?? '';
    if (currentValue !== baselineValue) {
      keptFields.push(field);
    } else if (owns(nextMetadata, field)) {
      metadata[field] = nextMetadata[field];
    } else if (savedKeys.has(field)) {
      metadata[field] = null;
    } else {
      delete metadata[field];
    }
  });

  return { data, keptFields: [...new Set(keptFields)] };
};

const replacementValuesBySource = (record, mapping) => {
  const values = {};
  Object.entries(mapping).forEach(([field, source]) => {
    if (owns(record.metadata || EMPTY_METADATA, field)) values[source] = record.metadata[field];
  });
  Object.entries(OTHER_DETAILS).forEach(([source, field]) => {
    if (owns(record.metadata || EMPTY_METADATA, field)) values[source] = record.metadata[field];
  });
  return values;
};

const remapReplacementMetadata = (metadata, nextRecord, targetMapping, materialTypes, keptFields, savedKeys, originalMapping) => {
  const nextMapping = EDS_TO_DB_FIELD_MAPPING[materialTypeName(
    materialTypes,
    nextRecord.material_type_id || nextRecord.material_type,
  )] || EMPTY_MAPPING;
  const nextValues = replacementValuesBySource(nextRecord, nextMapping);
  const editedFields = new Set(keptFields);
  const editedSources = new Set([
    ...Object.entries(targetMapping),
    ...Object.entries(originalMapping),
    ...Object.entries(OTHER_DETAILS).map(([source, field]) => [field, source]),
  ].filter(([field]) => editedFields.has(field)).map(([, source]) => source));
  const targetFields = {
    ...Object.fromEntries(Object.entries(OTHER_DETAILS).map(([source, field]) => [source, field])),
    ...Object.fromEntries(Object.entries(targetMapping).map(([field, source]) => [source, field])),
  };
  const remapped = { ...metadata };

  Object.entries(nextMapping).forEach(([field, source]) => {
    const targetField = targetFields[source];
    if (targetField && targetField !== field && !editedSources.has(source)) {
      if (savedKeys.has(field)) remapped[field] = null;
      else delete remapped[field];
    }
  });
  Object.entries(targetFields).forEach(([source, field]) => {
    if (!editedSources.has(source) && owns(nextValues, source)) remapped[field] = nextValues[source];
  });
  return remapped;
};

export const useEdsProvenance = ({
  initialData = {},
  sourceType,
  materialTypes = [],
  usage,
}) => {
  const [activeRecord, setActiveRecord] = useState(initialData);
  const metadata = activeRecord.metadata || EMPTY_METADATA;
  const initialTypeId = activeRecord.material_type_id || activeRecord.material_type || '';
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
      title: activeRecord.title || activeRecord.name || '',
      link: activeRecord.link || activeRecord.item_url || '',
      material_type_id: String(initialTypeId),
      metadata: baselineMetadata,
    };
  }, [activeRecord, initialMapping, initialTypeId, isEdsSession, metadata]);

  const sourceValues = useMemo(() => {
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
  }, [initialMapping, metadata]);

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

  const replaceRecord = useCallback((currentData, nextRecord, savedMetadataKeys = []) => {
    const changeBaseline = baseline || snapshot(activeRecord);
    const targetMapping = EDS_TO_DB_FIELD_MAPPING[
      materialTypeName(materialTypes, currentData.material_type_id)
    ] || EMPTY_MAPPING;
    const manualType = !atBaseline('material_type_id', currentData.material_type_id, changeBaseline.material_type_id);
    const mergeBaseline = { ...changeBaseline, metadata: { ...changeBaseline.metadata } };

    if (isEdsSession && manualType) {
      Object.entries(targetMapping).forEach(([field, source]) => {
        const sourceValue = sourceValues[source]?.value ?? '';
        const oldField = Object.entries(initialMapping).find(([, oldSource]) => oldSource === source)?.[0];
        if (oldField && oldField !== field && (currentData.metadata[field] ?? '') === sourceValue) {
          mergeBaseline.metadata[oldField] = currentData.metadata[oldField] ?? '';
          mergeBaseline.metadata[field] = sourceValue;
        }
      });
    }

    const result = mergeChangedRecord(currentData, mergeBaseline, nextRecord, savedMetadataKeys);
    if (manualType) {
      result.data.metadata = remapReplacementMetadata(
        result.data.metadata,
        nextRecord,
        targetMapping,
        materialTypes,
        result.keptFields,
        new Set(savedMetadataKeys),
        initialMapping,
      );
    }
    setActiveRecord(nextRecord);
    return result;
  }, [activeRecord, baseline, initialMapping, isEdsSession, materialTypes, sourceValues]);

  const accession = savedAccession;
  const title = activeRecord.title || activeRecord.name;
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

  return { baseline, markerFor, remapMetadata, replaceRecord, source };
};

export default useEdsProvenance;

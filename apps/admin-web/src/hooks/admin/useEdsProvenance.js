import { useCallback, useMemo, useState } from 'react';
import { EDS_TO_DB_FIELD_MAPPING, OTHER_DETAILS } from '../../constants/edsFieldMapping';

const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const EMPTY_METADATA = Object.freeze({});
const EMPTY_MAPPING = Object.freeze({});
const EMPTY_KEYS = new Set();
const materialTypeName = (types, id) => types.find((type) => String(type.material_type_id) === String(id))?.name;
const FORM_FIELDS = ['title', 'link', 'notes', 'material_type_id'];

const snapshot = (record) => ({
  title: record.title || '',
  link: record.link || '',
  notes: record.notes || '',
  material_type_id: record.material_type_id || '',
  metadata: { ...(record.metadata || {}) },
});

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

  FORM_FIELDS.forEach((field) => {
    const currentValue = currentData[field] ?? '';
    if (atBaseline(field, currentValue, baseline[field])) {
      data[field] = nextRecord[field] ?? '';
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

const sourceValuesFor = (metadata, mapping) => {
  const mappedSources = new Set(Object.values(mapping));
  const fields = [
    ...Object.entries(mapping).map(([field, source]) => [source, field]),
    ...Object.entries(OTHER_DETAILS).filter(([source]) => !mappedSources.has(source)),
  ];
  return Object.fromEntries(fields.map(([source, field]) => [source, {
    field,
    present: owns(metadata, field),
    value: metadata[field] ?? '',
  }]));
};

const fieldsForType = (mapping) => {
  const mappedSources = new Set(Object.values(mapping));
  const otherFields = Object.fromEntries(
    Object.entries(OTHER_DETAILS)
      .filter(([source]) => !mappedSources.has(source))
      .map(([source, field]) => [field, source]),
  );
  return { ...otherFields, ...mapping };
};

const remapMetadataByType = (metadata, currentMapping, nextMapping, sourceValues, { keptFields = [], savedKeys = EMPTY_KEYS } = {}) => {
  const currentFieldsBySource = Object.fromEntries(
    Object.entries(currentMapping).map(([field, source]) => [source, field]),
  );
  const kept = new Set(keptFields);
  const editedSources = new Set([
    ...Object.entries(sourceValues)
      .filter(([source, sourceValue]) => {
        const field = currentFieldsBySource[source] || sourceValue.field;
        return field && (metadata[field] ?? '') !== sourceValue.value;
      })
      .map(([source]) => source),
    ...[...Object.entries(currentMapping), ...Object.entries(nextMapping)]
      .filter(([field]) => kept.has(field))
      .map(([, source]) => source),
  ]);
  const nextMetadata = { ...metadata };
  const nextFieldsBySource = Object.fromEntries(
    Object.entries(nextMapping).map(([field, source]) => [source, field]),
  );

  Object.entries(currentMapping).forEach(([field, source]) => {
    const nextField = nextFieldsBySource[source];
    if (nextField && nextField !== field && !editedSources.has(source)) {
      if (savedKeys.has(field)) nextMetadata[field] = null;
      else delete nextMetadata[field];
    }
  });
  Object.entries(nextMapping).forEach(([field, source]) => {
    const sourceValue = sourceValues[source];
    if (!editedSources.has(source) && sourceValue?.present) nextMetadata[field] = sourceValue.value;
  });
  return nextMetadata;
};

export const useEdsProvenance = ({
  initialData = {},
  sourceType,
  materialTypes = [],
  usage,
}) => {
  const [activeRecord, setActiveRecord] = useState(initialData);
  const metadata = activeRecord.metadata || EMPTY_METADATA;
  const initialTypeId = activeRecord.material_type_id || '';
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
      title: activeRecord.title || '',
      link: activeRecord.link || '',
      material_type_id: String(initialTypeId),
      metadata: baselineMetadata,
    };
  }, [activeRecord, initialMapping, initialTypeId, isEdsSession, metadata]);

  const sourceValues = useMemo(() => sourceValuesFor(metadata, initialMapping), [initialMapping, metadata]);

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
    const nextMapping = fieldsForType(EDS_TO_DB_FIELD_MAPPING[materialTypeName(materialTypes, typeId)] || EMPTY_MAPPING);
    const currentMapping = fieldsForType(EDS_TO_DB_FIELD_MAPPING[materialTypeName(materialTypes, currentTypeId)] || EMPTY_MAPPING);
    return remapMetadataByType(currentMetadata, currentMapping, nextMapping, sourceValues);
  };

  const replaceRecord = useCallback((currentData, nextRecord, savedMetadataKeys = []) => {
    const changeBaseline = baseline || snapshot(activeRecord);
    const targetMapping = fieldsForType(EDS_TO_DB_FIELD_MAPPING[
      materialTypeName(materialTypes, currentData.material_type_id)
    ] || EMPTY_MAPPING);
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
      const replacementTypeMapping = EDS_TO_DB_FIELD_MAPPING[
        materialTypeName(materialTypes, nextRecord.material_type_id)
      ] || EMPTY_MAPPING;
      result.data.metadata = remapMetadataByType(
        result.data.metadata,
        fieldsForType(replacementTypeMapping),
        targetMapping,
        sourceValuesFor(nextRecord.metadata || EMPTY_METADATA, replacementTypeMapping),
        { keptFields: result.keptFields, savedKeys: new Set(savedMetadataKeys) },
      );
    }
    setActiveRecord(nextRecord);
    return result;
  }, [activeRecord, baseline, initialMapping, isEdsSession, materialTypes, sourceValues]);

  const accession = savedAccession;
  const title = activeRecord.title;
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

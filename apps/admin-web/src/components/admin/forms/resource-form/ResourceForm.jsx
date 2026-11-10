import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Info } from 'lucide-react';
import { Alert } from '../../../ui/alert';
import { adminMaterialTypeService } from '../../../../services/admin/adminMaterialTypeService';
import { useResourceFormState } from '../../../../hooks/admin/useResourceFormState';
import { useResourceFormValidation } from '../../../../hooks/admin/useResourceFormValidation';
import { useResourceUsage } from '../../../../hooks/admin/useResourceUsage';
import { useEdsProvenance } from '../../../../hooks/admin/useEdsProvenance';
import { isHitchcockVideoUrl } from '../../../../util/externalLinks';
import { ErrorSummary } from './ErrorSummary';
import { FieldMarker } from './FieldMarker';
import { OtherDetails } from './OtherDetails';
import { SharedEditWarning } from './SharedEditWarning';
import { SourceStrip } from './SourceStrip';
import { StaffSection } from './StaffSection';
import { StudentSection } from './StudentSection';
import { WhatBasics } from './WhatBasics';
import WhereSection from './WhereSection';
import UnifiedVisibilityControl from '../common/UnifiedVisibilityControl';

export const ResourceForm = ({
  initialData = {}, onSubmit, formId, course, sourceType, usageResourceId, onChangeRecord, changeRecord,
}) => {
  const {
    defaultDates, formData, setFormData, useVisibilityDates, setUseVisibilityDates,
    cascadeVisibilityToLinks, setCascadeVisibilityToLinks, links, setLinks,
    materialTypes, setMaterialTypes, materialTypeFields, setMaterialTypeFields,
    errorMessage, setErrorMessage,
  } = useResourceFormState({ initialData, course });
  const { errors: validationErrors, validate, clearNameError } = useResourceFormValidation();
  const resourceUsage = useResourceUsage(usageResourceId);
  const provenance = useEdsProvenance({ initialData, sourceType, materialTypes, usage: resourceUsage.usage });
  const replaceRecord = provenance.replaceRecord;
  const [keptFields, setKeptFields] = useState([]);
  const handledRecord = useRef(null);
  const savedMetadataKeys = useRef(initialData.resource_id ? Object.keys(initialData.metadata || {}) : []);
  const canChangeRecord = sourceType === 'eds'
    || (sourceType === 'edit' && Boolean(initialData.metadata?.accession_number));

  useEffect(() => {
    if (!changeRecord || handledRecord.current === changeRecord) return;
    handledRecord.current = changeRecord;
    const result = replaceRecord(formData, changeRecord, savedMetadataKeys.current);
    setFormData(result.data);
    setKeptFields(result.keptFields);
  }, [changeRecord, formData, replaceRecord, setFormData]);
  const markedMaterialTypes = materialTypes.map((type) => ({
    ...type,
    marker: String(type.material_type_id) === String(formData.material_type_id)
      ? provenance.markerFor('material_type_id', formData.material_type_id)
      : null,
  }));
  const markedMaterialTypeFields = materialTypeFields.map((field) => ({
    ...field,
    marker: provenance.markerFor(field.field_name, formData.metadata[field.field_name] ?? '', formData.material_type_id),
  }));

  useEffect(() => {
    adminMaterialTypeService.getMaterialTypes().then(({ data }) => setMaterialTypes(data)).catch((error) => {
      console.error('Error fetching material types:', error);
      setErrorMessage('Failed to load material types');
    });
  }, [setErrorMessage, setMaterialTypes]);

  const fetchMaterialTypeFields = useCallback(async (typeId) => {
    if (!typeId) return;
    try {
      const { data } = await adminMaterialTypeService.getMaterialTypeFields(typeId);
      setMaterialTypeFields(data);
    } catch (error) {
      console.error('Error fetching material type fields:', error);
      setErrorMessage('Failed to load material type fields');
    }
  }, [setErrorMessage, setMaterialTypeFields]);

  useEffect(() => {
    if (formData.material_type_id) fetchMaterialTypeFields(formData.material_type_id);
  }, [formData.material_type_id, fetchMaterialTypeFields]);

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === 'title') clearNameError();
    if (type === 'checkbox') {
      setFormData((current) => ({ ...current, [name]: checked }));
    } else if (name in formData) {
      const next = { ...formData, [name]: value };
      if (name === 'link' && isHitchcockVideoUrl(value) && !next.use_primary_link_visibility) {
        next.use_primary_link_visibility = true;
        next.primary_link_start_visibility ||= defaultDates.startDate;
        next.primary_link_end_visibility ||= defaultDates.endDate;
      }
      setFormData((current) => ({ ...current, ...next }));
    } else {
      setFormData((current) => ({ ...current, metadata: { ...current.metadata, [name]: value } }));
    }
  };

  const handleMaterialTypeChange = (event) => {
    const { value } = event.target;
    setFormData((current) => ({
      ...current,
      material_type_id: value,
      metadata: provenance.remapMetadata(value, current.metadata, current.material_type_id),
    }));
    fetchMaterialTypeFields(value);
  };

  const handleVisibilityToggle = (enabled) => {
    setUseVisibilityDates(enabled);
    setFormData((current) => ({
      ...current,
      start_visibility: enabled ? current.start_visibility || defaultDates.startDate : '',
      end_visibility: enabled ? current.end_visibility || defaultDates.endDate : '',
    }));
  };

  const handlePrimaryLinkVisibilityToggle = (enabled) => setFormData((current) => ({
    ...current,
    use_primary_link_visibility: enabled,
    ...(enabled ? {} : { primary_link_start_visibility: '', primary_link_end_visibility: '' }),
  }));

  const handlePrimaryLinkDateChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    const dateField = name === 'primary_link_start_visibility' ? 'start_visibility' : 'end_visibility';
    if (name === 'primary_link_start_visibility' || name === 'primary_link_end_visibility') {
      setLinks((current) => current.map((link) => (
        link.use_link_visibility ? { ...link, [dateField]: value } : link
      )));
    }
  };

  const updateLinkField = (index, field, value) => setLinks((current) => current.map((link, linkIndex) => (
    linkIndex === index ? { ...link, [field]: value } : link
  )));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!validate(formData)) return;
    try {
      const processedLinks = links
        .filter((link) => link.url && link.url.trim() !== '')
        .map((link) => ({
          ...link,
          use_link_visibility: link.use_link_visibility ? 1 : 0,
          use_proxy: link.use_proxy ? 1 : 0,
        }));
      const isVideoType = formData.material_type_id === '3' || formData.material_type_id === 3;
      await onSubmit({
        ...formData,
        use_proxy: formData.use_proxy ? 1 : 0,
        use_primary_link_visibility: formData.use_primary_link_visibility ? 1 : 0,
        links: processedLinks,
        start_visibility: useVisibilityDates || isVideoType ? formData.start_visibility : '',
        end_visibility: useVisibilityDates || isVideoType ? formData.end_visibility : '',
      });
    } catch (error) {
      console.error('Error saving resource:', error);
      setErrorMessage("Couldn't save the resource");
    }
  };

  const handleInvalid = (event) => {
    if (event.target.name === 'title') {
      event.preventDefault();
      validate(formData);
    }
  };

  return (
    <>
      {errorMessage && <Alert variant="destructive" className="tw-mb-4">{errorMessage}</Alert>}
      <form id={formId} onInvalidCapture={handleInvalid} onSubmit={handleSubmit} className="tw-space-y-4">
        <SourceStrip
          source={provenance.source}
          canChangeRecord={canChangeRecord}
          onChangeRecord={onChangeRecord}
          keptFields={keptFields}
        />
        {formData.link && isHitchcockVideoUrl(formData.link) && formData.use_primary_link_visibility && (
          <Alert className="tw-flex tw-items-start tw-gap-2">
            <Info aria-hidden="true" className="tw-size-4 tw-shrink-0" />
            <p><strong>Automatic Link Visibility Applied:</strong> The primary link to this Hitchcock video can only be displayed during the current term. Link visibility dates have been automatically set to ensure compliance.</p>
          </Alert>
        )}
        <WhatBasics
          formData={formData}
          handleFieldChange={handleFieldChange}
          materialTypes={markedMaterialTypes}
          onTypeChange={handleMaterialTypeChange}
          materialTypeFields={markedMaterialTypeFields}
          titleError={validationErrors.title}
        />
        <WhereSection
          formData={formData}
          handleFieldChange={handleFieldChange}
          links={links}
          setLinks={setLinks}
          linkMarker={<FieldMarker marker={provenance.markerFor('link', formData.link)} />}
          resourceVisibilityDates={{ startDate: formData.start_visibility, endDate: formData.end_visibility }}
        />
        <OtherDetails
          metadata={formData.metadata}
          materialTypeFields={materialTypeFields}
          markerFor={provenance.markerFor}
          materialTypeId={formData.material_type_id}
        />
        <StudentSection
          formData={formData}
          handleFieldChange={handleFieldChange}
          handleFolderChange={handleFieldChange}
          setFormData={setFormData}
          sharedEditWarning={usageResourceId ? (
            <SharedEditWarning {...resourceUsage} />
          ) : null}
        />
        <div id="visibility-settings">
          <UnifiedVisibilityControl
            resourceStartDate={formData.start_visibility}
            resourceEndDate={formData.end_visibility}
            useResourceVisibility={useVisibilityDates}
            onResourceVisibilityToggle={handleVisibilityToggle}
            onResourceDateChange={handleFieldChange}
            primaryLinkStartDate={formData.primary_link_start_visibility}
            primaryLinkEndDate={formData.primary_link_end_visibility}
            usePrimaryLinkVisibility={formData.use_primary_link_visibility}
            onPrimaryLinkVisibilityToggle={handlePrimaryLinkVisibilityToggle}
            onPrimaryLinkDateChange={handlePrimaryLinkDateChange}
            hasPrimaryLink={!!(formData.link && formData.link.trim())}
            primaryUrl={formData.link}
            links={links}
            onLinkVisibilityChange={updateLinkField}
            onLinkDateChange={updateLinkField}
            materialTypeId={formData.material_type_id}
            cascadeVisibilityToLinks={cascadeVisibilityToLinks}
            onCascadeToggle={setCascadeVisibilityToLinks}
            termStartDate={defaultDates.startDate}
            termEndDate={defaultDates.endDate}
          />
        </div>
        <StaffSection formData={formData} handleFieldChange={handleFieldChange} />
        <ErrorSummary errors={validationErrors} />
      </form>
    </>
  );
};

ResourceForm.propTypes = {
  initialData: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  formId: PropTypes.string,
  course: PropTypes.object,
  mode: PropTypes.oneOf(['course', 'none']),
  sourceType: PropTypes.string.isRequired,
  usageResourceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChangeRecord: PropTypes.func,
  changeRecord: PropTypes.object,
};

export default ResourceForm;

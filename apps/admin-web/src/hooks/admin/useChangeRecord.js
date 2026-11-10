import { useCallback, useState } from 'react';
import { ResourceFormType } from '../../components/admin/forms/constants/formTypes';
import { notify } from '../../services/notify';
import { mapEdsRecordToResource } from '../../util/mapEDSRecordToRespurce';

const formRecord = ({ title, link, material_type: materialTypeId, description, metadata }) => ({
  title,
  link,
  notes: description || '',
  material_type_id: materialTypeId || '',
  metadata: { ...(metadata || {}) },
});

export function useChangeRecord({ formType, resetSearch, setError }) {
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [record, setRecord] = useState(null);

  const reset = useCallback(() => {
    setSelectedRecord(null);
    setShowEditForm(false);
    setPickerOpen(false);
    setRecord(null);
  }, []);

  const openPicker = useCallback(() => {
    resetSearch();
    setPickerOpen(true);
  }, [resetSearch]);

  const handleSelectRecord = useCallback(async (selected) => {
    try {
      const changing = isPickerOpen;
      if (formType === ResourceFormType.EDS || changing) {
        const mapped = await mapEdsRecordToResource(selected);
        if (changing) {
          setRecord(formRecord(mapped));
          setPickerOpen(false);
          notify.success('Resource details replaced from EDS');
          return;
        }
        setSelectedRecord({ ...selected, parsedData: formRecord(mapped) });
      } else {
        setSelectedRecord(selected);
      }

      setShowEditForm(true);
      if (formType === ResourceFormType.EDS) notify.success('Resource details filled from EDS');
    } catch (error) {
      console.error('Error selecting record:', error);
      setError('Failed to process selected record');
      if (formType === ResourceFormType.EDS || isPickerOpen) {
        notify.fromError(error, "Couldn't fill the resource from EDS");
      }
    }
  }, [formType, isPickerOpen, setError]);

  return {
    selectedRecord,
    showEditForm,
    setShowEditForm,
    isPickerOpen,
    record,
    openPicker,
    closePicker: () => setPickerOpen(false),
    handleSelectRecord,
    reset,
  };
}

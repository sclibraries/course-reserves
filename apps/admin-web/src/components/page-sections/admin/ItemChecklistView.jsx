import PropTypes from 'prop-types';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Spinner
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import useItemChecklist from '../../../hooks/admin/useItemChecklist';
import ChecklistTemplatePicker from './item-checklist/ChecklistTemplatePicker';
import ChecklistUnassigned from './item-checklist/ChecklistUnassigned';
import ChecklistTaskList from './item-checklist/ChecklistTaskList';
import ChecklistProgress from './item-checklist/ChecklistProgress';
import ChecklistCompletion from './item-checklist/ChecklistCompletion';

function ItemChecklistView({ itemId, onComplete }) {
  const state = useItemChecklist(itemId, onComplete);
  const {
    loading,
    saving,
    checklist,
    error,
    taskNotes,
    templates,
    showSelector,
    setShowSelector,
    noChecklistAssigned,
    filteredTemplates,
    progress,
    requiredRemaining,
    loadChecklist,
    handleAssignChecklist,
    handleTaskToggle,
    handleNotesChange,
    handleNotesBlur,
    handleCompleteAll,
    handleCloseSelector
  } = state;
  const templatePickerProps = {
    checklist,
    saving,
    templates: filteredTemplates,
    searchQuery: state.searchQuery,
    onSearchChange: state.setSearchQuery,
    selectedFormat: state.selectedFormat,
    onFormatChange: state.setSelectedFormat,
    selectedMaterialType: state.selectedMaterialType,
    onMaterialTypeChange: state.setSelectedMaterialType,
    formats: state.uniqueFormats,
    materialTypes: state.uniqueMaterialTypes,
    onSelect: handleAssignChecklist,
    onClose: handleCloseSelector
  };

  if (loading) {
    return (
      <Card>
        <CardBody className="text-center py-5">
          <Spinner color="primary" />
          <p className="mt-2">Loading checklist...</p>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <Alert color="danger">
            <h5>Error</h5>
            <p>{error}</p>
            <Button color="primary" size="sm" onClick={loadChecklist}>Try Again</Button>
          </Alert>
        </CardBody>
      </Card>
    );
  }

  if (!checklist && noChecklistAssigned) {
    return (
      <ChecklistUnassigned
        templates={templates}
        showSelector={showSelector}
        onShowSelector={() => setShowSelector(true)}
        saving={saving}
        pickerProps={templatePickerProps}
      />
    );
  }

  if (!checklist) {
    return (
      <Card>
        <CardBody>
          <Alert color="info">
            <FontAwesomeIcon icon="fa-solid fa-clipboard-list" className="me-2" />
            Loading checklist...
          </Alert>
        </CardBody>
      </Card>
    );
  }

  const allRequiredComplete = requiredRemaining === 0;

  return (
    <Card>
      <CardHeader className="bg-white">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-1">
              <FontAwesomeIcon icon="fa-solid fa-clipboard-check" className="me-2" />
              {checklist.template_name}
            </h5>
            {checklist.description && <p className="text-muted small mb-0">{checklist.description}</p>}
          </div>
          <div className="d-flex align-items-center gap-3">
            <Button color="outline-secondary" size="sm" onClick={() => setShowSelector(true)}>
              <FontAwesomeIcon icon="fa-solid fa-exchange-alt" className="me-1" />
              Change
            </Button>
            <div className="text-end">
              <div className="text-muted small mb-1">Progress</div>
              <h4 className="mb-0">{progress}%</h4>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {showSelector && (
          <Alert color="light" className="mb-3">
            <ChecklistTemplatePicker mode="change" {...templatePickerProps} />
          </Alert>
        )}
        <ChecklistProgress
          tasks={checklist.tasks}
          progress={progress}
          requiredRemaining={requiredRemaining}
        />
        <ChecklistTaskList
          tasks={checklist.tasks}
          taskNotes={taskNotes}
          saving={saving}
          onTaskToggle={handleTaskToggle}
          onNotesChange={handleNotesChange}
          onNotesBlur={handleNotesBlur}
        />
        <ChecklistCompletion
          saving={saving}
          allRequiredComplete={allRequiredComplete}
          onComplete={handleCompleteAll}
        />
      </CardBody>
    </Card>
  );
}

ItemChecklistView.propTypes = {
  itemId: PropTypes.number.isRequired,
  onComplete: PropTypes.func
};

export default ItemChecklistView;

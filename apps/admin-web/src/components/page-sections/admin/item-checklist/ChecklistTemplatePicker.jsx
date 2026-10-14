import PropTypes from 'prop-types';
import { Badge, Button, Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function TemplateFilters({
  searchQuery,
  onSearchChange,
  selectedFormat,
  onFormatChange,
  selectedMaterialType,
  onMaterialTypeChange,
  formats,
  materialTypes
}) {
  return (
    <div className="mb-3">
      <Input
        type="text"
        placeholder="Search templates by name or description..."
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        className="mb-2"
      />
      <div className="d-flex gap-2">
        <Input type="select" value={selectedFormat} onChange={(event) => onFormatChange(event.target.value)} bsSize="sm">
          <option value="all">All Formats</option>
          {formats.map(format => <option key={format} value={format}>{format}</option>)}
        </Input>
        <Input type="select" value={selectedMaterialType} onChange={(event) => onMaterialTypeChange(event.target.value)} bsSize="sm">
          <option value="all">All Material Types</option>
          {materialTypes.map(type => <option key={type} value={type}>{type}</option>)}
        </Input>
      </div>
    </div>
  );
}

TemplateFilters.propTypes = {
  searchQuery: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  selectedFormat: PropTypes.string.isRequired,
  onFormatChange: PropTypes.func.isRequired,
  selectedMaterialType: PropTypes.string.isRequired,
  onMaterialTypeChange: PropTypes.func.isRequired,
  formats: PropTypes.arrayOf(PropTypes.string).isRequired,
  materialTypes: PropTypes.arrayOf(PropTypes.string).isRequired
};

function TemplateList({ templates, mode, currentTemplateId, saving, onSelect }) {
  if (templates.length === 0) {
    return (
      <div className="list-group" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <div className="text-center text-muted py-4">
          <FontAwesomeIcon icon="fa-solid fa-search" size="2x" className="mb-2" />
          <p className="mb-0">No templates match your search criteria</p>
        </div>
      </div>
    );
  }

  return (
    <div className="list-group" style={{ maxHeight: '400px', overflowY: 'auto' }}>
      {templates.map(template => {
        const isCurrent = mode === 'change' && template.id === currentTemplateId;
        return (
          <button
            key={template.id}
            type="button"
            className={`list-group-item list-group-item-action ${isCurrent ? 'border-primary' : ''}`}
            onClick={() => onSelect(template.id)}
            disabled={saving || isCurrent}
            style={isCurrent ? { backgroundColor: '#e7f3ff', borderWidth: '2px' } : {}}
          >
            {mode === 'assign' ? (
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="mb-1">{template.name}</h6>
                  <p className="mb-1 text-muted small">{template.description}</p>
                  <div className="d-flex gap-2 mt-2">
                    <Badge color="secondary">{template.task_count} {template.task_count === 1 ? 'task' : 'tasks'}</Badge>
                    <Badge color="info">{template.format}</Badge>
                    {template.material_types && template.material_types.length > 0 && (
                      <Badge color="light">{template.material_types.join(', ')}</Badge>
                    )}
                  </div>
                </div>
                <FontAwesomeIcon icon="fa-solid fa-chevron-right" className="text-muted" />
              </div>
            ) : (
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <h6 className="mb-0">{template.name}</h6>
                    {isCurrent && <Badge color="primary">Current</Badge>}
                  </div>
                  {template.description && <p className="mb-2 small text-muted">{template.description}</p>}
                  <div className="d-flex gap-2 flex-wrap">
                    <Badge color="secondary">
                      <FontAwesomeIcon icon="fa-solid fa-tasks" className="me-1" />
                      {template.task_count} {template.task_count === 1 ? 'task' : 'tasks'}
                    </Badge>
                    <Badge color="info"><FontAwesomeIcon icon="fa-solid fa-book" className="me-1" />{template.format}</Badge>
                    {template.material_types && template.material_types.length > 0 && (
                      <Badge color="light" className="text-dark">
                        <FontAwesomeIcon icon="fa-solid fa-tag" className="me-1" />
                        {template.material_types.join(', ')}
                      </Badge>
                    )}
                  </div>
                </div>
                {!isCurrent && <FontAwesomeIcon icon="fa-solid fa-chevron-right" className="text-muted ms-2" />}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

TemplateList.propTypes = {
  templates: PropTypes.arrayOf(PropTypes.object).isRequired,
  mode: PropTypes.oneOf(['assign', 'change']).isRequired,
  currentTemplateId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  saving: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired
};

function ChecklistTemplatePicker({
  mode,
  checklist,
  saving,
  templates,
  searchQuery,
  onSearchChange,
  selectedFormat,
  onFormatChange,
  selectedMaterialType,
  onMaterialTypeChange,
  formats,
  materialTypes,
  onSelect,
  onClose
}) {
  const filters = (
    <TemplateFilters
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      selectedFormat={selectedFormat}
      onFormatChange={onFormatChange}
      selectedMaterialType={selectedMaterialType}
      onMaterialTypeChange={onMaterialTypeChange}
      formats={formats}
      materialTypes={materialTypes}
    />
  );
  const list = (
    <TemplateList
      templates={templates}
      mode={mode}
      currentTemplateId={checklist?.template_id}
      saving={saving}
      onSelect={onSelect}
    />
  );

  return mode === 'assign' ? (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Select Checklist Template</h5>
        <Button color="link" size="sm" onClick={onClose}>Cancel</Button>
      </div>
      {filters}
      {list}
    </>
  ) : (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Change Checklist Template</h6>
        <Button color="link" size="sm" className="text-decoration-none" onClick={onClose}>
          <FontAwesomeIcon icon="fa-solid fa-times" /> Cancel
        </Button>
      </div>
      {filters}
      {list}
    </>
  );
}

ChecklistTemplatePicker.propTypes = {
  mode: PropTypes.oneOf(['assign', 'change']).isRequired,
  checklist: PropTypes.object,
  saving: PropTypes.bool.isRequired,
  templates: PropTypes.arrayOf(PropTypes.object).isRequired,
  searchQuery: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  selectedFormat: PropTypes.string.isRequired,
  onFormatChange: PropTypes.func.isRequired,
  selectedMaterialType: PropTypes.string.isRequired,
  onMaterialTypeChange: PropTypes.func.isRequired,
  formats: PropTypes.arrayOf(PropTypes.string).isRequired,
  materialTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

export default ChecklistTemplatePicker;

import PropTypes from 'prop-types';
import { Alert, Button, Card, CardBody } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ChecklistTemplatePicker from './ChecklistTemplatePicker';

function ChecklistUnassigned({
  templates,
  showSelector,
  onShowSelector,
  saving,
  pickerProps
}) {
  return (
    <Card>
      <CardBody>
        {!showSelector ? (
          <>
            <Alert color="info">
              <h5>
                <FontAwesomeIcon icon="fa-solid fa-clipboard-list" className="me-2" />
                No Checklist Assigned
              </h5>
              <p>This item doesn&apos;t have a checklist assigned yet. Select a checklist template to get started.</p>
            </Alert>
            <Button color="primary" onClick={onShowSelector} disabled={templates.length === 0}>
              <FontAwesomeIcon icon="fa-solid fa-plus" className="me-2" />
              Assign Checklist
            </Button>
            {templates.length === 0 && (
              <p className="text-muted mt-2 mb-0">
                <small>No checklist templates available. Create templates in the Admin Checklists section.</small>
              </p>
            )}
          </>
        ) : (
          <ChecklistTemplatePicker mode="assign" saving={saving} {...pickerProps} />
        )}
      </CardBody>
    </Card>
  );
}

ChecklistUnassigned.propTypes = {
  templates: PropTypes.arrayOf(PropTypes.object).isRequired,
  showSelector: PropTypes.bool.isRequired,
  onShowSelector: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  pickerProps: PropTypes.object.isRequired
};

export default ChecklistUnassigned;

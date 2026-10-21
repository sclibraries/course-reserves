import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Spinner
} from 'reactstrap';
import { FaExchangeAlt } from 'react-icons/fa';
import { workflowService } from '../../../../services/admin/workflowService';
import { toast } from 'react-toastify';

const WorkflowPathSelector = ({ itemId, currentTemplateName, onWorkflowSwitch }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true);
      try {
        // Fetch all active item-level templates
        const allTemplates = await workflowService.listTemplates({
          type: 'item',
          active: true
        });
        setTemplates(allTemplates);
      } catch (error) {
        console.error('Failed to load workflow templates:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const handleSwitch = async (template) => {
    if (switching) return;
    
    if (!window.confirm(`Are you sure you want to switch to the "${template.template_name}" workflow? This will cancel the current workflow and start a new one.`)) {
      return;
    }

    setSwitching(true);
    try {
      await onWorkflowSwitch(itemId, template.id);
      toast.success(`Switched to ${template.template_name} workflow`);
    } catch (error) {
      console.error('Failed to switch workflow:', error);
      toast.error(error.message || 'Failed to switch workflow');
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return <Spinner size="sm" color="secondary" />;
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="d-flex align-items-center mb-3">
      <span className="me-2 text-muted small">Current Path:</span>
      <UncontrolledDropdown>
        <DropdownToggle caret color="outline-secondary" size="sm" disabled={switching}>
          {switching ? (
            <Spinner size="sm" className="me-1" />
          ) : (
            <FaExchangeAlt className="me-1" />
          )}
          {currentTemplateName || 'Select Workflow'}
        </DropdownToggle>
        <DropdownMenu>
          <DropdownItem header>Available Workflows</DropdownItem>
          {templates.map(template => (
            <DropdownItem 
              key={template.id} 
              onClick={() => handleSwitch(template)}
              active={template.template_name === currentTemplateName}
            >
              {template.template_name}
              {template.category && <span className="text-muted small ms-2">({template.category})</span>}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </UncontrolledDropdown>
    </div>
  );
};

WorkflowPathSelector.propTypes = {
  itemId: PropTypes.number.isRequired,
  currentWorkflowId: PropTypes.number,
  currentTemplateName: PropTypes.string,
  onWorkflowSwitch: PropTypes.func.isRequired
};

export default WorkflowPathSelector;

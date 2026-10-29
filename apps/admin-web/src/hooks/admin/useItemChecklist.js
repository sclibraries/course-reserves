import { useEffect, useState } from 'react';
import { notify } from '../../services/notify';
import { useAuth } from '../../contexts/AuthContext';
import { checklistService } from '../../services/admin/checklistService';
import {
  filterChecklistTemplates,
  getChecklistProgress,
  getRequiredTasksRemaining,
  getUniqueChecklistFormats,
  getUniqueChecklistMaterialTypes
} from '../../util/itemChecklist';

export default function useItemChecklist(itemId, onComplete) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState(null);
  const [error, setError] = useState(null);
  const [taskNotes, setTaskNotes] = useState({});
  const [templates, setTemplates] = useState([]);
  const [showSelector, setShowSelector] = useState(false);
  const [noChecklistAssigned, setNoChecklistAssigned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedMaterialType, setSelectedMaterialType] = useState('all');

  useEffect(() => {
    loadChecklist();
    loadTemplates();
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTemplates = async () => {
    try {
      const data = await checklistService.listTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const loadChecklist = async () => {
    try {
      setLoading(true);
      setError(null);
      setNoChecklistAssigned(false);
      const data = await checklistService.getItemChecklist(itemId);
      setChecklist(data);

      const notes = {};
      if (data.tasks) {
        data.tasks.forEach(task => {
          if (task.notes) {
            notes[task.id] = task.notes;
          }
        });
      }
      setTaskNotes(notes);
    } catch (err) {
      console.error('Failed to load checklist:', err);
      console.log(err);
      if (err.status === 404 || (err.message && err.message.toLowerCase().includes('No checklist assigned to this item'))) {
        setNoChecklistAssigned(true);
        setError(null);
      } else {
        setError('Failed to load checklist. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAssignChecklist = async (templateId) => {
    try {
      setSaving(true);
      await checklistService.assignChecklistToItem(itemId, templateId, user?.username);
      notify.success('Checklist assigned');
      setShowSelector(false);
      setNoChecklistAssigned(false);
      loadChecklist();
    } catch (err) {
      console.error('Failed to assign checklist:', err);
      notify.fromError(err, "Couldn't assign the checklist");
    } finally {
      setSaving(false);
    }
  };

  const handleTaskToggle = async (taskId, currentStatus) => {
    try {
      setSaving(true);
      const newStatus = !currentStatus;
      const notes = taskNotes[taskId] || null;
      await checklistService.updateTaskStatus(itemId, taskId, newStatus, notes, user?.username);
      setChecklist(prev => ({
        ...prev,
        tasks: prev.tasks.map(task => task.id === taskId
          ? { ...task, completed: newStatus, completed_at: newStatus ? new Date().toISOString() : null }
          : task)
      }));
      notify.success(newStatus ? 'Task completed' : 'Task reopened');
    } catch (err) {
      console.error('Failed to update task:', err);
      notify.fromError(err, "Couldn't update the checklist task");
    } finally {
      setSaving(false);
    }
  };

  const handleNotesChange = (taskId, notes) => {
    setTaskNotes(prev => ({ ...prev, [taskId]: notes }));
  };

  const handleNotesBlur = async (taskId, completed) => {
    try {
      const notes = taskNotes[taskId] || null;
      await checklistService.updateTaskStatus(itemId, taskId, completed, notes, user?.username);
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  };

  const handleCompleteAll = async () => {
    if (!window.confirm('Are you sure you want to mark all remaining tasks as complete and finish this item?')) {
      return;
    }

    try {
      setSaving(true);
      await checklistService.completeItemChecklist(itemId, user?.username);
      notify.success('Item completed');
      if (onComplete) onComplete();
    } catch (err) {
      console.error('Failed to complete checklist:', err);
      notify.fromError(err, "Couldn't complete the checklist");
      setSaving(false);
    }
  };

  const handleCloseSelector = () => {
    setShowSelector(false);
    setSearchQuery('');
    setSelectedFormat('all');
    setSelectedMaterialType('all');
  };

  const filteredTemplates = filterChecklistTemplates(
    templates,
    searchQuery,
    selectedFormat,
    selectedMaterialType
  );
  const progress = getChecklistProgress(checklist?.tasks);
  const requiredRemaining = getRequiredTasksRemaining(checklist?.tasks);

  return {
    loading,
    saving,
    checklist,
    error,
    taskNotes,
    templates,
    showSelector,
    setShowSelector,
    noChecklistAssigned,
    searchQuery,
    setSearchQuery,
    selectedFormat,
    setSelectedFormat,
    selectedMaterialType,
    setSelectedMaterialType,
    filteredTemplates,
    uniqueFormats: getUniqueChecklistFormats(templates),
    uniqueMaterialTypes: getUniqueChecklistMaterialTypes(templates),
    progress,
    requiredRemaining,
    loadChecklist,
    handleAssignChecklist,
    handleTaskToggle,
    handleNotesChange,
    handleNotesBlur,
    handleCompleteAll,
    handleCloseSelector
  };
}

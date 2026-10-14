export const filterChecklistTemplates = (templates, searchQuery, selectedFormat, selectedMaterialType) => {
  return templates.filter(template => {
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFormat = selectedFormat === 'all' || template.format === selectedFormat;
    const matchesMaterialType = selectedMaterialType === 'all' ||
      (template.material_types && template.material_types.includes(selectedMaterialType));
    return matchesSearch && matchesFormat && matchesMaterialType;
  });
};

export const getUniqueChecklistFormats = (templates) => {
  const formats = new Set(templates.map(template => template.format).filter(Boolean));
  return Array.from(formats).sort();
};

export const getUniqueChecklistMaterialTypes = (templates) => {
  const types = new Set();
  templates.forEach(template => {
    if (template.material_types && Array.isArray(template.material_types)) {
      template.material_types.forEach(type => types.add(type));
    }
  });
  return Array.from(types).sort();
};

export const getChecklistProgress = (tasks) => {
  if (!tasks || tasks.length === 0) return 0;
  const completed = tasks.filter(task => task.completed).length;
  return Math.round((completed / tasks.length) * 100);
};

export const getRequiredTasksRemaining = (tasks) => {
  if (!tasks) return 0;
  return tasks.filter(task => !task.optional && !task.completed).length;
};

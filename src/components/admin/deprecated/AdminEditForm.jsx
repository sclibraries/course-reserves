import PropTypes from 'prop-types';
import BaseResourceForm from './common/BaseResourceForm';
import { toast } from 'react-toastify';

/**
 * AdminEditForm - Form for editing resources using BaseResourceForm
 */
export const AdminEditForm = ({
  onSubmit,
  resource,
  buttonText = 'Save Changes'
}) => {
  // Transform the resource's metadata to the expected format
  const transformMetadata = (metadata) => {
    // Check if metadata is an array.
    if (!Array.isArray(metadata)) {
      console.error('Expected metadata to be an array but received:', metadata);
      return {};
    }
    // Reduce the array into an object where each key is the field_name.
    return metadata.reduce((acc, item) => {
      if (item && item.field_name) {
        acc[item.field_name] = item.field_value;
      }
      return acc;
    }, {});
  };

  // Create initial data from resource
  const initialData = {
    resource_id: resource.resource_id || null,
    title: resource.name || '',
    link: resource.item_url || '',
    use_proxy: resource.use_proxy || false,
    folder: resource.folder_id || null,
    notes: resource.description || '',
    internal_note: resource.internal_note || '',
    external_note: resource.external_note || '',
    start_visibility: resource.start_visibility || null,
    end_visibility: resource.end_visibility || null,
    material_type_id: resource.material_type_id || null,
    order: resource.order || null,
    created_at: resource.created_at || '',
    material_type_name: resource.material_type_name || '',
    course_count: resource.course_count || 0,
    metadata: transformMetadata(resource.metadata),
    links: resource.links || []
  };

  // Handle form submission for edit
  const handleEditSubmit = async (formData) => {
    try {
      await onSubmit(formData);
      toast.success('Resource updated successfully');
      return true;
    } catch (err) {
      console.error('Error updating resource:', err);
      throw err; // Let the BaseResourceForm handle the error
    }
  };

  return (
    <BaseResourceForm
      initialData={initialData}
      onSubmit={handleEditSubmit}
      title="Edit Resource"
      submitButtonText={buttonText}
      showCancel={false}
    />
  );
};

AdminEditForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  resource: PropTypes.object,
  buttonText: PropTypes.string
};

export default AdminEditForm;
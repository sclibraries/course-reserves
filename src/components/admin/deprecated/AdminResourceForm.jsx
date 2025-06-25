import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { adminCourseService } from '../../../services/admin/adminCourseService';
import { useAdminCourseStore } from '../../../store/adminCourseStore';
import { adjustProxy } from '../../../util/proxyUtil';
import BaseResourceForm from './common/BaseResourceForm';

/**
 * AdminResourceForm - Add new resource form using BaseResourceForm
 */
export const AdminResourceForm = ({ onSubmit }) => {
  const [initialData, setInitialData] = useState({});
  const { course, folioCourseData } = useAdminCourseStore();

  // Set default visibility dates from course term dates
  useEffect(() => {
    if (folioCourseData) {
      const term = folioCourseData.courseListingObject?.termObject;
      if (term) {
        setInitialData({
          start_visibility: new Date(term.startDate).toISOString().split('T')[0],
          end_visibility: new Date(term.endDate).toISOString().split('T')[0],
        });
      }
    }
  }, [folioCourseData]);
  
  // Handle form reset
  const handleReset = () => {
    // Reset will be handled by BaseResourceForm
  };
  
  // Handle form submission
  const handleFormSubmit = async (formData) => {
    // Apply proxy to main URL if needed
    adjustProxy(formData);
    
    // Apply proxy to additional links
    if (formData.links && formData.links.length > 0) {
      formData.links = formData.links.map(link => {
        if (link.use_proxy) {
          return { 
            ...link, 
            url: link.url.includes('proxy') ? link.url : `https://libproxy.smith.edu/login?url=${link.url}` 
          };
        }
        return link;
      });
    }
      
    // Send to API
    await adminCourseService.createResource(
      course.offering_id, 
      course.course_id, 
      formData, 
      folioCourseData
    );
    
    onSubmit();
  };

  return (
    <BaseResourceForm
      initialData={initialData}
      onSubmit={handleFormSubmit}
      title="Add New Resource"
      submitButtonText="Create Resource"
      onCancel={handleReset}
    />
  );
};

AdminResourceForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
};

export default AdminResourceForm;

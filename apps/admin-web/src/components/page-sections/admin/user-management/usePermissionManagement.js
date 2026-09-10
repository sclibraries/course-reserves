import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { apiConfig } from '../../../../config/api.config';

const usePermissionManagement = (token) => {
  const [permissions, setPermissions] = useState({});
  const [availablePermissions, setAvailablePermissions] = useState({
    permissions: {},
    institutions: {}
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Fetch grouped permissions
  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`${apiConfig.urls.courseReserves}${apiConfig.endpoints.permissions.grouped}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch permissions: ${response.status}`);
      }
      
      const data = await response.json();
      setPermissions(data.institutions || {});
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error('Failed to load permission data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch available permissions and institutions
  const fetchAvailablePermissions = useCallback(async () => {
    try {
      const response = await fetch(`${apiConfig.urls.courseReserves}${apiConfig.endpoints.permissions.available}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch available permissions: ${response.status}`);
      }
      
      const data = await response.json();
      setAvailablePermissions({
        permissions: data.permissions || {},
        institutions: data.institutions || {}
      });
    } catch (error) {
      console.error('Error fetching available permissions:', error);
      toast.error('Failed to load available permission data');
    }
  }, [token]);
  
  // Toggle permission status
  const togglePermission = useCallback(async (permissionId) => {
    setUpdating(true);
    
    try {
      const response = await fetch(`${apiConfig.urls.courseReserves}${apiConfig.endpoints.permissions.toggle}${permissionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to toggle permission: ${response.status}`);
      }
      
      const updatedPermission = await response.json();
      
      // Update local state to reflect the change
      setPermissions(prev => {
        const newPermissions = { ...prev };
        const institution = updatedPermission.institution;
        
        if (newPermissions[institution]) {
          newPermissions[institution] = newPermissions[institution].map(perm => 
            perm.id === updatedPermission.id ? 
              { ...perm, granted: updatedPermission.granted } : 
              perm
          );
        }
        
        return newPermissions;
      });
      
      toast.success(`Permission ${updatedPermission.granted ? 'granted' : 'revoked'}`);
    } catch (error) {
      console.error('Error toggling permission:', error);
      toast.error('Failed to update permission');
    } finally {
      setUpdating(false);
    }
  }, [token]);
  
  // Load data on component mount
  useEffect(() => {
    fetchPermissions();
    fetchAvailablePermissions();
  }, [fetchPermissions, fetchAvailablePermissions]);
  
  return {
    permissions,
    availablePermissions,
    loading,
    updating,
    fetchPermissions,
    togglePermission
  };
};

export default usePermissionManagement;

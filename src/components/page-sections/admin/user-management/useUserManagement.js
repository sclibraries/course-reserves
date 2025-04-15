import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { config } from '../../../../config';

const useUserManagement = (token) => {
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  // Search and sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('full_name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Form states
  const [editFormData, setEditFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    department: '',
    institution: '',
    role: '',
    approved: 1
  });
  const [createFormData, setCreateFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    department: 'Libraries',
    institution: 'Smith College',
    role: 'user',
    approved: 1
  });
  const [formErrors, setFormErrors] = useState({});
  const [createFormErrors, setCreateFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Fetch users on component mount
  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingUsers();
    } else {
      fetchAllUsers();
    }
  }, [activeTab, token]);

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    const currentUserList = activeTab === 'pending' ? pendingUsers : users;
    
    if (!searchTerm.trim()) {
      return [...currentUserList].sort((a, b) => {
        const aValue = a[sortField] ? String(a[sortField]).toLowerCase() : '';
        const bValue = b[sortField] ? String(b[sortField]).toLowerCase() : '';
        
        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });
    }
    
    return [...currentUserList]
      .filter(user => {
        const searchLower = searchTerm.toLowerCase();
        return (
          (user.username && user.username.toLowerCase().includes(searchLower)) ||
          (user.full_name && user.full_name.toLowerCase().includes(searchLower)) ||
          (user.email && user.email.toLowerCase().includes(searchLower)) ||
          (user.department && user.department.toLowerCase().includes(searchLower)) ||
          (user.institution && user.institution.toLowerCase().includes(searchLower))
        );
      })
      .sort((a, b) => {
        const aValue = a[sortField] ? String(a[sortField]).toLowerCase() : '';
        const bValue = b[sortField] ? String(b[sortField]).toLowerCase() : '';
        
        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });
  }, [activeTab, pendingUsers, users, searchTerm, sortField, sortDirection]);

  // Fetch pending user requests
  const fetchPendingUsers = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`${config.api.urls.courseReserves}${config.api.endpoints.users.pending}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPendingUsers(data || []);
      } else {
        toast.error(data.message || 'Failed to fetch pending users');
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
      toast.error('An unexpected error occurred while fetching pending users.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch all users
  const fetchAllUsers = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`${config.api.urls.courseReserves}${config.api.endpoints.users.list}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setUsers(data || []);
      } else {
        toast.error(data.message || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('An unexpected error occurred while fetching users.');
    } finally {
      setLoading(false);
    }
  };

  // Handle user approval
  const handleApprove = async (user) => {
    try {
      const response = await fetch(`${config.api.urls.courseReserves}${config.api.endpoints.users.approve}${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Remove user from pending list
        setPendingUsers(pendingUsers.filter(u => u.id !== user.id));
        setModalOpen(false);
        fetchAllUsers(); // Refresh the all users list
        toast.success(`User ${user.full_name} has been approved successfully`);
      } else {
        toast.error(data.message || 'Failed to approve user');
      }
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('An unexpected error occurred while approving the user.');
    }
  };
  
  // Handle user rejection
  const handleReject = async (user) => {
    try {
      const response = await fetch(`${config.api.urls.courseReserves}${config.api.endpoints.users.reject}${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // Remove user from pending list
        setPendingUsers(pendingUsers.filter(u => u.id !== user.id));
        setModalOpen(false);
        toast.success(`User ${user.full_name} has been rejected`);
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to reject user');
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('An unexpected error occurred while rejecting the user.');
    }
  };

  // Validate edit form
  const validateEditForm = () => {
    const errors = {};
    
    // Username validation
    if (!editFormData.username.trim()) {
      errors.username = 'Username is required';
    }
    
    // Full name validation
    if (!editFormData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editFormData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(editFormData.email)) {
      errors.email = 'Email is invalid';
    }
    
    // Institution validation
    if (!editFormData.institution) {
      errors.institution = 'Institution is required';
    }
    
    // Department validation
    if (!editFormData.department) {
      errors.department = 'Department is required';
    }
    
    // Role validation
    if (!editFormData.role) {
      errors.role = 'Role is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate create form
  const validateCreateForm = () => {
    const errors = {};
    
    // Username validation
    if (!createFormData.username.trim()) {
      errors.username = 'Username is required';
    }
    
    // Full name validation
    if (!createFormData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }
    
    // Email validation - must end with allowed domains
    const validDomains = ['smith.edu', 'hampshire.edu', 'amherst.edu', 'mtholyoke.edu', 'umass.edu'];
    const emailRegex = new RegExp(`^[\\w.-]+@(${validDomains.join('|')})$`, 'i');
    
    if (!createFormData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(createFormData.email)) {
      errors.email = 'Email must be from a Five College institution';
    }
    
    // Institution validation
    if (!createFormData.institution) {
      errors.institution = 'Institution is required';
    }
    
    // Department validation
    if (!createFormData.department) {
      errors.department = 'Department is required';
    }
    
    // Role validation
    if (!createFormData.role) {
      errors.role = 'Role is required';
    }
    
    setCreateFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle edit form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateEditForm()) {
      toast.error('Please correct the errors in the form');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch(`${config.api.urls.courseReserves}${config.api.endpoints.users.update}${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Update the users list with the updated user
        setUsers(users.map(user => 
          user.id === selectedUser.id ? { ...user, ...editFormData } : user
        ));
        setEditModalOpen(false);
        toast.success(`User ${editFormData.full_name} has been updated successfully`);
      } else {
        toast.error(data.message || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('An unexpected error occurred while updating the user.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle create form submission
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateCreateForm()) {
      toast.error('Please correct the errors in the form');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch(`${config.api.urls.courseReserves}${config.api.endpoints.auth.register}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createFormData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Add user to list if they were approved directly
        if (createFormData.approved === 1) {
          fetchAllUsers();
        } else {
          fetchPendingUsers();
        }
        
        setCreateModalOpen(false);
        toast.success(`User ${createFormData.full_name} has been created successfully`);
      } else {
        toast.error(data.message || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('An unexpected error occurred while creating the user.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle form input changes
  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
    }));
    
    // Clear error for this field when the user makes a change
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handle create form input changes
  const handleCreateFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCreateFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
    }));
    
    // Clear error for this field when the user makes a change
    if (createFormErrors[name]) {
      setCreateFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Open confirmation modal
  const openModal = (user, action) => {
    setSelectedUser(user);
    setActionType(action);
    setModalOpen(true);
  };

  // Open edit modal
  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditFormData({
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      department: user.department,
      institution: user.institution,
      role: user.role,
      approved: user.approved
    });
    setFormErrors({});
    setEditModalOpen(true);
  };

  // Open create modal
  const openCreateModal = () => {
    setCreateFormData({
      username: '',
      full_name: '',
      email: '',
      department: 'Libraries',
      institution: 'Smith College',
      role: 'user',
      approved: 1
    });
    setCreateFormErrors({});
    setCreateModalOpen(true);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle sorting
  const handleSort = (field) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to ascending for new field
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
  };

  return {
    // State
    users,
    pendingUsers,
    loading,
    activeTab,
    selectedUser,
    modalOpen,
    actionType,
    editModalOpen,
    createModalOpen,
    searchTerm,
    sortField,
    sortDirection,
    editFormData,
    createFormData,
    formErrors,
    createFormErrors,
    submitting,
    filteredUsers,

    // Actions
    setActiveTab,
    handleSearchChange,
    clearSearch,
    handleSort,
    openModal,
    openEditModal,
    openCreateModal,
    handleApprove,
    handleReject,
    handleEditFormChange,
    handleCreateFormChange,
    handleEditSubmit,
    handleCreateSubmit,
    setModalOpen,
    setEditModalOpen,
    setCreateModalOpen
  };
};

export default useUserManagement;

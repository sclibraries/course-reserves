// hooks/useCollegeManagement.js
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useCustomizationStore from '../store/customizationStore';

// Map full institution names to college keys
const institutionToCollegeKey = {
  'Smith College': 'smith',
  'Hampshire College': 'hampshire',
  'Mount Holyoke College': 'mtholyoke',
  'Amherst College': 'amherst',
  'UMass Amherst': 'umass'
};

// Map institution names to UI college names (now using full names)
const institutionToCollegeName = {
  'Smith College': 'Smith College',
  'Hampshire College': 'Hampshire College',
  'Mount Holyoke College': 'Mount Holyoke College',
  'Amherst College': 'Amherst College',
  'UMass Amherst': 'UMass Amherst'
};

// All available colleges for display (alphabetically ordered with full names)
const allColleges = [
  'All Colleges',
  'Amherst College',
  'Hampshire College',
  'Mount Holyoke College',
  'Smith College',
  'UMass Amherst',
];

/**
 * Custom hook for managing college selection logic
 * Centralizes the college management pattern used across admin components
 * 
 * @param {string} initialCollege - Initial college key (default: 'all')
 * @param {Function} onCollegeChange - Optional callback when college changes (e.g., to update store)
 * @returns {Object} College management state and functions
 */
export const useCollegeManagement = (initialCollege = 'all', onCollegeChange = null) => {
  const { user, isAdmin } = useAuth();
  
  const [college, setCollege] = useState(initialCollege);
  const [selectedCollege, setSelectedCollege] = useState('All Colleges');
  const [availableColleges, setAvailableColleges] = useState(['All Colleges']);

  // Helper functions
  const collegeNameToKey = (col) => {
    switch (col) {
      case 'Smith College': return 'smith';
      case 'Hampshire College': return 'hampshire';
      case 'Mount Holyoke College': return 'mtholyoke';
      case 'Amherst College': return 'amherst';
      case 'UMass Amherst': return 'umass';
      case 'All Colleges':
      default: return 'all';
    }
  };

  const keyToCollegeName = (key) => {
    switch (key) {
      case 'smith': return 'Smith College';
      case 'hampshire': return 'Hampshire College';
      case 'mtholyoke': return 'Mount Holyoke College';
      case 'amherst': return 'Amherst College';
      case 'umass': return 'UMass Amherst';
      case 'all':
      default: return 'All Colleges';
    }
  };

  // Set available colleges based on user permissions
  useEffect(() => {
    if (!user) return;
    
    // Admin users can see all colleges
    if (isAdmin) {
      setAvailableColleges(allColleges);
      return;
    }
    
    // Regular users can only see their own institution
    if (user.institution) {
      const userCollegeKey = institutionToCollegeKey[user.institution];
      const userCollegeName = institutionToCollegeName[user.institution];
      
      if (userCollegeKey && userCollegeName) {
        // If user's institution maps to a valid college, use that
        // Keep alphabetical order: All Colleges first, then the user's college
        setAvailableColleges(['All Colleges', userCollegeName]);
        
        // If no college is selected yet, set it to user's college
        if (college === 'all' || !college) {
          setCollege(userCollegeKey);
          setSelectedCollege(userCollegeName);
        }
      } else {
        // Fallback if we can't map the institution
        setAvailableColleges(['All Colleges']);
      }
    }
  }, [user, isAdmin, college]);

  // Sync local display state with internal college state
  useEffect(() => {
    setSelectedCollege(keyToCollegeName(college));
  }, [college]);

  // Handler for college dropdown change
  const handleCollegeChange = (collegeDisplayName) => {
    const newCollegeKey = collegeNameToKey(collegeDisplayName);
    setSelectedCollege(collegeDisplayName);
    setCollege(newCollegeKey);
    
    // Update the customization store to ensure header theming updates
    useCustomizationStore.getState().setCurrentCollege(newCollegeKey);
    
    // Call external callback if provided (e.g., to update store)
    if (onCollegeChange) {
      onCollegeChange(newCollegeKey);
    }
  };

  // Reset college to appropriate default
  const resetCollege = () => {
    let newCollegeKey = 'all';
    let newCollegeName = 'All Colleges';
    
    if (!isAdmin && user?.institution) {
      const userCollegeKey = institutionToCollegeKey[user.institution];
      const userCollegeName = institutionToCollegeName[user.institution];
      
      if (userCollegeKey && userCollegeName) {
        newCollegeKey = userCollegeKey;
        newCollegeName = userCollegeName;
      }
    }
    
    setCollege(newCollegeKey);
    setSelectedCollege(newCollegeName);
    
    // Update the customization store to ensure header theming updates
    useCustomizationStore.getState().setCurrentCollege(newCollegeKey);
    
    // Call external callback if provided
    if (onCollegeChange) {
      onCollegeChange(newCollegeKey);
    }
  };

  return {
    // State
    college,
    selectedCollege,
    availableColleges,
    
    // Setters
    setCollege,
    setSelectedCollege,
    
    // Handlers
    handleCollegeChange,
    resetCollege,
    
    // Helper functions
    collegeNameToKey,
    keyToCollegeName,
    
    // Computed values
    isCollegeDisabled: availableColleges.length <= 2 && !isAdmin,
  };
};

export default useCollegeManagement;

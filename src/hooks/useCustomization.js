// useCustomization.js
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import useCustomizationStore from '../store/customizationStore';

export const useCurrentCollege = () => {
  const location = useLocation();
  const setCollege = useCustomizationStore(state => state.setCollege);
  const currentCollege = useCustomizationStore(state => state.currentCollege);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const college = queryParams.get('college') || 'default';
    setCollege(college);
  }, [location.search, setCollege]);

  return currentCollege;
};

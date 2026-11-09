import { useState } from 'react';

export const useResourceFormValidation = () => {
  const [errors, setErrors] = useState({});

  const validate = ({ title }) => {
    const nextErrors = title?.trim() ? {} : { title: 'Resource name is required' };
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const clearNameError = () => setErrors((current) => (current.title ? {} : current));

  return { errors, validate, clearNameError };
};

export default useResourceFormValidation;

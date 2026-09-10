import { useState } from 'react';

export const useAdminModal = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState);
  const toggle = () => setIsOpen(!isOpen);
  return [isOpen, toggle];
};
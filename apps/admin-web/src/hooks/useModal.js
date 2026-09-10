import { useState } from 'react';

export const useModal = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState);
  const toggle = () => setIsOpen(!isOpen);
  return [isOpen, toggle];
};
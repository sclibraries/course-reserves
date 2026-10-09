import { createContext, useContext } from 'react';

const CourseViewContext = createContext(null);

export function useCourseView() {
  const ctx = useContext(CourseViewContext);
  if (!ctx) throw new Error('useCourseView must be used within CourseViewContext.Provider');
  return ctx;
}

export default CourseViewContext;

import { create } from 'zustand';

const useCourseManagementStore = create((set) => ({
    //initial state
    course: [],
    setCourse: (course) => set({ course }),
}));

export default useCourseManagementStore;
import { create } from 'zustand';

const useRecordStore = create((set) => ({
    // Initial state
    record: null,
    setRecord: (record) => set({ record }),
}));

export default useRecordStore;
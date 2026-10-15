import { useActingForStore } from '@/store/actingForStore';

export const withActingForFaculty = <T extends Record<string, unknown>>(payload: T): T => {
  const selectedFaculty = useActingForStore.getState().selectedFaculty;
  return selectedFaculty
    ? { ...payload, acting_for_faculty_id: selectedFaculty.username }
    : payload;
};

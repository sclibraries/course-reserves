import type { CourseFolder } from '@/store/courseReservesStore';

type NamedFolder = Pick<CourseFolder, 'id' | 'title'>;

export function findFolderByName<T extends NamedFolder>(
  folders: readonly T[],
  name: string,
  exceptId?: string,
): T | undefined {
  const normalizedName = name.trim().toLowerCase();
  return folders.find((folder) => folder.id !== exceptId && folder.title.trim().toLowerCase() === normalizedName);
}

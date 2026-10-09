import { useReserveStore } from './useReserveStore';

export const useFolderStore = () => {
  const {
    createFolder,
    updateFolder,
    deleteFolder,
    addItemToFolder,
    removeItemFromFolder,
    toggleFolder,
    moveItemInFolder,
    moveFolderPosition,
  } = useReserveStore();

  return {
    createFolder,
    updateFolder,
    deleteFolder,
    addItemToFolder,
    removeItemFromFolder,
    toggleFolder,
    moveItemInFolder,
    moveFolderPosition,
  };
};

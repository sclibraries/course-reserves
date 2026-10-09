import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCourseReservesStore } from "../store/courseReservesStore";
import { useAuthStore } from "../store/authStore";
import { API_ENDPOINTS } from "@/config/endpoints";
import type { ItemData } from "@/components/ItemModal";
import type { CourseData } from "@/components/CourseModal";
import type { SortOption, FilterOption } from "@/components/ItemSortingToolbar";

/**
 * Main hook for managing submission editor state and operations
 */
export const useSubmissionEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Store hooks
  const {
    getReserveById,
    fetchSubmissionDetails,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
    moveItemToPosition,
    updateReserve,
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFolder,
    addItemToFolder,
    removeItemFromFolder,
    moveItemInFolder,
    moveFolderPosition,
  } = useCourseReservesStore();
  
  const reserve = getReserveById(id!);
  const { user } = useAuthStore();

  // On direct navigation/refresh, try to fetch the submission from backend if missing in store
  useEffect(() => {
    if (!id) return;
    if (reserve) return; // already loaded (from persisted store or prior fetch)
    // Only attempt backend fetch for non-local IDs
    if (!String(id).startsWith('reserve-')) {
      fetchSubmissionDetails(id).catch((e) => {
        console.debug('No backend submission found for id', id, e);
      });
    }
  }, [id, reserve, fetchSubmissionDetails]);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<(ItemData & { id: string }) | undefined>();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [emailConfirmation, setEmailConfirmation] = useState(false);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  
  // UI states
  const [showInstructions, setShowInstructions] = useState(false);
  
  // Sorting and filtering
  const [sortBy, setSortBy] = useState<SortOption>('position');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOption>({
    materialTypes: [],
    statuses: []
  });
  
  const resetFilters = () => {
    setFilters({ materialTypes: [], statuses: [] });
    setSearchQuery('');
    setSortBy('position');
  };
  
  const hasActiveFiltersOrSort = sortBy !== 'position' || 
                                 filters.materialTypes.length > 0 || 
                                 filters.statuses.length > 0 || 
                                 !!searchQuery;
  
  return {
    id,
    navigate,
    reserve,
    user,
    // Modal states
    modalOpen,
    setModalOpen,
    editingItem,
    setEditingItem,
    showSubmitDialog,
    setShowSubmitDialog,
    emailConfirmation,
    setEmailConfirmation,
    courseModalOpen,
    setCourseModalOpen,
    // UI states
    showInstructions,
    setShowInstructions,
    // Filtering
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    resetFilters,
    hasActiveFiltersOrSort,
    // Store actions
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
    moveItemToPosition,
    updateReserve,
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFolder,
    addItemToFolder,
    removeItemFromFolder,
    moveItemInFolder,
    moveFolderPosition,
  };
};

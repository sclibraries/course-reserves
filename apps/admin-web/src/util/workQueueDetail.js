import { buildProcessingHandoff, getProcessingBlockReason } from '../services/admin/processingHandoff';

export const getCompletionReturnPath = () => '/admin?tab=my-work';

export const findSelectedWorkQueueItem = (items, itemId) => (
  items.find(item => String(item.id) === String(itemId))
);

export const buildWorkQueueProcessingAction = (item) => {
  const handoff = buildProcessingHandoff(item);

  return {
    handoff,
    blockingReason: getProcessingBlockReason(item)
  };
};

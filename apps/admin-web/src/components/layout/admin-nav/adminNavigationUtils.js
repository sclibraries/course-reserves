export const getTabCount = (key, counts) => counts[key] || 0;

export const getTabCountLabel = (key, count) => (
  key === 'mentions' ? `${count} unread mentions` : `${count} items`
);

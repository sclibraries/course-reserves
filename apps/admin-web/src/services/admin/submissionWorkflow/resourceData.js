export function readResourceData(resourceData) {
  if (resourceData && typeof resourceData === 'object') return resourceData;
  if (typeof resourceData !== 'string') return {};

  try {
    const parsed = JSON.parse(resourceData);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

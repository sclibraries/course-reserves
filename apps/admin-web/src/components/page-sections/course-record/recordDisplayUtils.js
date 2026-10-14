export const getDiscoverUrl = (baseUrl, instanceId) => {
  if (!instanceId || !baseUrl) return null;
  return `${baseUrl}${instanceId.replace(/-/g, '.')}`;
};

export const formatPublicationEntries = (publication) => (
  publication
    .map((pub) => {
      const parts = [];
      if (pub.publisher) parts.push(pub.publisher);
      if (pub.place) parts.push(pub.place);
      if (pub.dateOfPublication) parts.push(pub.dateOfPublication);
      return parts.join('; ');
    })
    .join(' / ')
);

export const isProxyEnabled = (link) => link.use_proxy === '1';

const parseVolumeNumber = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const match = String(value).match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
};

const parseCopyNumber = (value) => {
  if (value == null) return Number.POSITIVE_INFINITY;
  const number = parseInt(value, 10);
  return isNaN(number) ? Number.POSITIVE_INFINITY : number;
};

export const sortHoldings = (holdings) => (
  [...holdings].sort((left, right) => {
    const leftVolume = parseVolumeNumber(left.volume);
    const rightVolume = parseVolumeNumber(right.volume);
    if (leftVolume !== rightVolume) return leftVolume - rightVolume;
    const leftCopy = parseCopyNumber(left.itemCopyNumber);
    const rightCopy = parseCopyNumber(right.itemCopyNumber);
    if (leftCopy !== rightCopy) return leftCopy - rightCopy;
    return (left.barcode || '').localeCompare(right.barcode || '');
  })
);

export const getHoldingUrl = (holding, copiedItem) => {
  if (holding.uri || holding.url) return holding.uri || holding.url;
  if (holding.barcode === copiedItem.barcode) return copiedItem.uri || copiedItem.url;
  return '';
};

export const getReserveMaterialTypes = (isElectronic, holdings) => {
  if (isElectronic) return [];

  const reserveHoldings = holdings.filter((holding) => (
    holding.location && holding.location.toLowerCase().includes('reserve')
  ));
  const materialTypes = reserveHoldings
    .filter((holding) => holding.materialType?.name)
    .map((holding) => holding.materialType.name)
    .filter((typeName) => !typeName.toLowerCase().includes('admin'));

  return [...new Set(materialTypes)];
};

export const getResourceBadgeText = (isElectronic, reserveMaterialTypes) => {
  if (isElectronic) return 'Electronic Resource';
  if (reserveMaterialTypes.length === 0) return 'Physical Resource';
  return reserveMaterialTypes.join(' / ');
};

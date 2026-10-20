function presentHolding(item) {
  const status = item.status === 'checked out'
    ? 'Checked out'
    : item.status.charAt(0).toUpperCase() + item.status.slice(1);
  return {
    id: item.id,
    callNumber: item.callNumber,
    location: item.permanentLocationId,
    locationCode: 'SC-TEST',
    locationId: '00000000-0000-4000-8000-000000000991',
    status,
    permanentLoanType: item.permanentLoanType,
    barcode: item.barcode,
    suppressFromDiscovery: 'false',
    totalHoldRequests: '0',
    materialType: { id: '00000000-0000-4000-8000-000000000901', name: item.materialType },
    library: { name: 'SC Neilson Library', code: 'SC' },
    notes: [],
    holdingsStatements: [],
  };
}

export function searchRtac(data, instanceId) {
  const seededInstance = (data.rtacInstances || []).find((instance) => instance.instanceId === instanceId);
  if (seededInstance) return { instanceId, holding: seededInstance.holding };

  const holdings = data.items
    .filter((item) => item.instanceId === instanceId)
    .map(presentHolding);
  if (holdings.length === 0) {
    const error = new Error('not found');
    error.status = 404;
    throw error;
  }

  return { instanceId, holding: holdings };
}

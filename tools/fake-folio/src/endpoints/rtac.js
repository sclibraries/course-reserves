function presentHolding(item) {
  return {
    id: item.holdingsId,
    barcode: item.barcode,
    location: item.permanentLocationId,
    library: { name: 'Smith College Libraries' },
    status: item.status,
    callNumber: item.callNumber,
    volume: item.volume,
    itemCopyNumber: item.copy,
    materialType: { name: item.materialType },
    temporaryLoanType: item.temporaryLoanType,
    permanentLoanType: item.permanentLoanType,
    uri: item.uri,
    url: item.url,
  };
}

export function searchRtac(data, instanceId) {
  const holdings = data.items
    .filter((item) => item.instanceId === instanceId)
    .flatMap(presentHolding);
  return { holding: holdings.length === 1 ? holdings[0] : holdings };
}

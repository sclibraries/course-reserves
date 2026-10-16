import { parseCql } from '../cql/parse.js';
import { matchesExpression } from '../cql/evaluate.js';

export function searchInventory(data, query) {
  const parsed = parseCql(query);
  const instances = [...new Map(data.items
    .filter((item) => matchesExpression(parsed.filter, { id: item.instanceId }))
    .map((item) => [
      item.instanceId,
      {
        id: item.instanceId,
        contributors: item.contributors,
        publication: item.publication,
      },
    ])).values()];
  return { instances };
}

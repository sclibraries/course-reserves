import { parseCql } from '../cql/parse.js';
import { matchesExpression, sortRecords } from '../cql/evaluate.js';

export function searchDepartments(data, query) {
  // The admin department selectors use `name==sc*` for a prefix search.
  const compatibleQuery = (query || '(cql.allRecords=1)')
    .replace(/\bname==([a-z]+\*)/gi, 'name=$1');
  const parsed = parseCql(compatibleQuery);
  const departments = sortRecords(
    data.departments.filter((department) => matchesExpression(parsed.filter, department)),
    parsed.sort,
  ).map(({ id, name }) => ({ id, name }));
  return { departments };
}

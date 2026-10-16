import { CqlError, tokenize } from './tokenize.js';

const supportedFields = new Set([
  'active',
  'copiedItem.title',
  'courseListing.instructorObjects',
  'courseListing.termId',
  'courseListing.termObject.name',
  'courseListing.termObject.startDate',
  'courseListingId',
  'courseNumber',
  'cql.allRecords',
  'department.name',
  'id',
  'name',
  'owner',
  'sectionName',
  'courseListing.registrarId',
]);

const supportedSortFields = new Set([
  'copiedItem.title',
  'courseListing.termObject.name',
  'courseListing.termObject.startDate',
  'courseListingId',
  'courseNumber',
  'name',
  'sectionName',
]);

export function parseCql(query) {
  const tokens = tokenize(String(query || ''));
  if (tokens.length === 0) throw new CqlError('Query is empty');
  let cursor = 0;

  const peek = () => tokens[cursor];
  const consume = () => tokens[cursor++];
  const isKeyword = (name) => peek()?.type === 'keyword' &&
    peek().value.toLowerCase() === name;

  function parseComparison() {
    const fieldToken = consume();
    if (fieldToken?.type !== 'word') throw new CqlError('Expected a CQL field in query');
    const field = fieldToken.value;
    if (!supportedFields.has(field)) throw new CqlError('Unsupported CQL field: ' + field);

    const operator = consume();
    if (operator?.type !== 'operator') {
      throw new CqlError('Expected == or = after ' + field);
    }

    const firstValue = consume();
    if (!firstValue || (firstValue.type !== 'word' && firstValue.type !== 'string')) {
      throw new CqlError('Expected a value after ' + field + operator.value);
    }
    const parts = [firstValue.value];
    let previous = firstValue;
    while (peek()?.type === 'word' && !isKeyword('and') && !isKeyword('or') &&
      !isKeyword('sortby')) {
      const next = consume();
      parts.push(/\s/.test(query.slice(previous.end, next.start)) ? ' ' + next.value : next.value);
      previous = next;
    }
    const value = parts.join('');
    return { type: 'comparison', field, operator: operator.value, value };
  }

  function parsePrimary() {
    if (peek()?.type === '(') {
      consume();
      const expression = parseOr();
      if (peek()?.type !== ')') throw new CqlError('Missing closing parenthesis in query');
      consume();
      return expression;
    }
    return parseComparison();
  }

  function parseAnd() {
    let expression = parsePrimary();
    while (isKeyword('and')) {
      consume();
      expression = { type: 'and', left: expression, right: parsePrimary() };
    }
    return expression;
  }

  function parseOr() {
    let expression = parseAnd();
    while (isKeyword('or')) {
      consume();
      expression = { type: 'or', left: expression, right: parseAnd() };
    }
    return expression;
  }

  const filter = parseOr();
  let sort = null;
  if (isKeyword('sortby')) {
    consume();
    const sortToken = consume();
    if (sortToken?.type !== 'word') throw new CqlError('Expected a field after sortby');
    const match = sortToken.value.match(/^([^/]+)(?:\/(sort\.(?:ascending|descending)))?$/i);
    if (!match) throw new CqlError('Unsupported sort modifier: ' + sortToken.value);
    const field = match[1];
    if (!supportedSortFields.has(field)) throw new CqlError('Unsupported sort field: ' + field);
    sort = {
      field,
      direction: (match[2] || 'sort.ascending').toLowerCase() === 'sort.descending'
        ? 'descending'
        : 'ascending',
    };
  }

  if (cursor !== tokens.length) {
    throw new CqlError('Unsupported query part: ' + tokens.slice(cursor).map((token) => token.value).join(' '));
  }

  return { filter, sort };
}

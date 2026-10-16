export class CqlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CqlError';
  }
}

export function tokenize(query) {
  const tokens = [];
  let index = 0;

  while (index < query.length) {
    if (/\s/.test(query[index])) {
      index += 1;
      continue;
    }

    const start = index;
    const character = query[index];

    if (character === '(' || character === ')') {
      tokens.push({ type: character, value: character, start, end: ++index });
      continue;
    }

    if (character === '=') {
      const exact = query[index + 1] === '=';
      index += exact ? 2 : 1;
      tokens.push({ type: 'operator', value: exact ? '==' : '=', start, end: index });
      continue;
    }

    if (character === '"') {
      index += 1;
      let value = '';
      let closed = false;
      while (index < query.length) {
        const current = query[index];
        if (current === '\\' && index + 1 < query.length) {
          value += query[index + 1];
          index += 2;
        } else if (current === '"') {
          index += 1;
          closed = true;
          break;
        } else {
          value += current;
          index += 1;
        }
      }
      if (!closed) throw new CqlError('Unterminated quoted value in query');
      tokens.push({ type: 'string', value, start, end: index });
      continue;
    }

    if (/[!<>]/.test(character)) {
      throw new CqlError('Unsupported CQL operator near ' + query.slice(index, index + 2));
    }

    while (index < query.length && !/[\s()="!<>]/.test(query[index])) index += 1;
    if (start === index) throw new CqlError('Unsupported CQL syntax near ' + character);

    const value = query.slice(start, index);
    const keyword = value.toLowerCase();
    tokens.push({
      type: keyword === 'and' || keyword === 'or' || keyword === 'sortby'
        ? 'keyword'
        : 'word',
      value,
      start,
      end: index,
    });
  }

  return tokens;
}

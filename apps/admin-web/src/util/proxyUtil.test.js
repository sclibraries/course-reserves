import { describe, expect, it } from 'vitest';
import { adjustProxy } from './proxyUtil';

const proxyPrefix = ['https:', '', 'libproxy.smith.edu/login?url='].join('/');

describe('adjustProxy', () => {
  it('adds the proxy prefix by mutating and returning the resource', () => {
    const resource = { link: 'https://example.test/item', use_proxy: 1 };

    expect(adjustProxy(resource)).toBe(resource);
    expect(resource.link).toBe(`${proxyPrefix}https://example.test/item`);
  });

  it('removes the proxy prefix by mutating and returning the resource', () => {
    const resource = { link: `${proxyPrefix}https://example.test/item`, use_proxy: 0 };

    expect(adjustProxy(resource)).toBe(resource);
    expect(resource.link).toBe('https://example.test/item');
  });

  it('is idempotent when the requested proxy state is already applied', () => {
    const resource = { link: 'https://example.test/item', use_proxy: 1 };

    adjustProxy(resource);
    adjustProxy(resource);

    expect(resource.link).toBe(`${proxyPrefix}https://example.test/item`);
  });

  it('does not coerce string or boolean proxy flags', () => {
    for (const use_proxy of ['1', true, '0', false]) {
      const resource = { link: `${proxyPrefix}https://example.test/item`, use_proxy };

      expect(adjustProxy(resource)).toBe(resource);
      expect(resource.link).toBe(`${proxyPrefix}https://example.test/item`);
    }
  });

  it('rejects missing data and non-string links', () => {
    expect(() => adjustProxy(null)).toThrow('Invalid data or missing link property');
    expect(() => adjustProxy({})).toThrow('Invalid data or missing link property');
    expect(() => adjustProxy({ link: 42 })).toThrow('Invalid data or missing link property');
  });
});

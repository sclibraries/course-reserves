import { describe, expect, it } from 'vitest';
import { adjustProxy, normalizeProxyFlag } from './proxyUtil';

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

  it.each([1, '1', true])('adds the proxy prefix and is idempotent for enabled flag %s', (use_proxy) => {
    const resource = { link: 'https://example.test/item', use_proxy };

    expect(adjustProxy(resource)).toBe(resource);
    expect(resource.link).toBe(`${proxyPrefix}https://example.test/item`);
    expect(adjustProxy(resource)).toBe(resource);
    expect(resource.link).toBe(`${proxyPrefix}https://example.test/item`);
  });

  it.each([0, '0', false])('removes the proxy prefix and is idempotent for disabled flag %s', (use_proxy) => {
    const resource = { link: `${proxyPrefix}https://example.test/item`, use_proxy };

    expect(adjustProxy(resource)).toBe(resource);
    expect(resource.link).toBe('https://example.test/item');
    expect(adjustProxy(resource)).toBe(resource);
    expect(resource.link).toBe('https://example.test/item');
  });

  it.each([
    [1, true], ['1', true], [true, true],
    [0, false], ['0', false], [false, false],
    [undefined, null], [null, null], [2, null], ['true', null],
  ])('normalizes proxy flag %s to %s', (value, expected) => {
    expect(normalizeProxyFlag(value)).toBe(expected);
  });

  it('leaves the link unchanged for an unknown proxy flag', () => {
    const resource = { link: `${proxyPrefix}https://example.test/item`, use_proxy: 'enabled' };

    expect(adjustProxy(resource)).toBe(resource);
    expect(resource.link).toBe(`${proxyPrefix}https://example.test/item`);
  });

  it('rejects missing data and non-string links', () => {
    expect(() => adjustProxy(null)).toThrow('Invalid data or missing link property');
    expect(() => adjustProxy({})).toThrow('Invalid data or missing link property');
    expect(() => adjustProxy({ link: 42 })).toThrow('Invalid data or missing link property');
  });
});

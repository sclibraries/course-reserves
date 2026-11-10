import { describe, expect, it } from 'vitest';
import { buildProxyUrl, getProxyState, LIBPROXY_PREFIX, normalizeProxyFlag } from './proxyUtil';

const prefix = LIBPROXY_PREFIX;

describe('getProxyState', () => {
  it.each([
    ['https://example.test/item', 0, 'https://example.test/item', false],
    [`${prefix}https://example.test/item`, 0, 'https://example.test/item', true],
    ['https://example.test/item', 1, 'https://example.test/item', true],
    ['https://proxy.example.test/item', 0, 'https://proxy.example.test/item', false],
  ])('reads %s with saved flag %s', (rawUrl, savedFlag, url, useProxy) => {
    expect(getProxyState(rawUrl, savedFlag)).toEqual({ rawUrl, url, useProxy });
  });
});

describe('buildProxyUrl', () => {
  it.each([
    [{
      url: 'https://example.test/untouched',
      use_proxy: true,
      raw_url: `${prefix}https://example.test/untouched`,
      original_url: 'https://example.test/untouched',
      original_use_proxy: true,
    }, `${prefix}https://example.test/untouched`],
    [{ url: 'https://example.test/edited', use_proxy: true }, `${prefix}https://example.test/edited`],
    [{ url: `${prefix}https://example.test/already-proxied`, use_proxy: true }, `${prefix}https://example.test/already-proxied`],
    [{ url: `${prefix}https://example.test/disabled`, use_proxy: false }, 'https://example.test/disabled'],
    [{ url: 'https://proxy.example.test/item', use_proxy: false }, 'https://proxy.example.test/item'],
  ])('serializes %o', (link, expectedUrl) => {
    expect(buildProxyUrl(link)).toBe(expectedUrl);
  });
});

it.each([
  [1, true], ['1', true], [true, true],
  [0, false], ['0', false], [false, false],
  [undefined, null], [null, null], [2, null], ['true', null],
])('normalizes proxy flag %s to %s', (value, expected) => {
  expect(normalizeProxyFlag(value)).toBe(expected);
});

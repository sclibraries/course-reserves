import { describe, expect, it } from 'vitest';
import * as proxyUtil from './proxyUtil';

const { buildProxyUrl, LIBPROXY_PREFIX: prefix, normalizeProxyFlag } = proxyUtil;

describe('loadProxyLink', () => {
  it.each([
    [
      { url: 'https://example.test/item', use_proxy: 0 },
      { url: 'https://example.test/item', use_proxy: false, loaded: { rawUrl: 'https://example.test/item', url: 'https://example.test/item', useProxy: false } },
    ],
    [
      { url: `${prefix}https://example.test/item`, use_proxy: 0 },
      { url: 'https://example.test/item', use_proxy: true, loaded: { rawUrl: `${prefix}https://example.test/item`, url: 'https://example.test/item', useProxy: true } },
    ],
    [
      { url: 'https://example.test/item', use_proxy: 1 },
      { url: 'https://example.test/item', use_proxy: true, loaded: { rawUrl: 'https://example.test/item', url: 'https://example.test/item', useProxy: true } },
    ],
    [
      { link: `${prefix}https://example.test/item`, use_proxy: 0 },
      { link: 'https://example.test/item', use_proxy: true, loaded: { rawUrl: `${prefix}https://example.test/item`, url: 'https://example.test/item', useProxy: true } },
    ],
    [
      { url: 'https://proxy.example.test/item', use_proxy: 0 },
      { url: 'https://proxy.example.test/item', use_proxy: false, loaded: { rawUrl: 'https://proxy.example.test/item', url: 'https://proxy.example.test/item', useProxy: false } },
    ],
  ])('loads %o', (link, expected) => {
    expect(proxyUtil.loadProxyLink).toBeTypeOf('function');
    expect(proxyUtil.loadProxyLink(link)).toEqual(expected);
  });
});

describe('buildProxyUrl', () => {
  it.each([
    [
      { url: 'https://example.test/untouched', use_proxy: true },
      { rawUrl: `${prefix}https://example.test/untouched`, url: 'https://example.test/untouched', useProxy: true },
      `${prefix}https://example.test/untouched`,
    ],
    [
      { url: 'https://example.test/saved-unprefixed', use_proxy: true },
      { rawUrl: 'https://example.test/saved-unprefixed', url: 'https://example.test/saved-unprefixed', useProxy: true },
      'https://example.test/saved-unprefixed',
    ],
    [
      { url: 'https://example.test/edited', use_proxy: true },
      { rawUrl: `${prefix}https://example.test/original`, url: 'https://example.test/original', useProxy: true },
      `${prefix}https://example.test/edited`,
    ],
    [
      { url: `${prefix}https://example.test/disabled`, use_proxy: false },
      { rawUrl: `${prefix}https://example.test/disabled`, url: 'https://example.test/disabled', useProxy: true },
      'https://example.test/disabled',
    ],
    [
      { url: 'https://proxy.example.test/item', use_proxy: false },
      undefined,
      'https://proxy.example.test/item',
    ],
  ])('serializes %o', (link, loaded, expectedUrl) => {
    expect(buildProxyUrl(link, loaded)).toBe(expectedUrl);
  });
});

it.each([
  [1, true], ['1', true], [true, true],
  [0, false], ['0', false], [false, false],
  [undefined, null], [null, null], [2, null], ['true', null],
])('normalizes proxy flag %s to %s', (value, expected) => {
  expect(normalizeProxyFlag(value)).toBe(expected);
});

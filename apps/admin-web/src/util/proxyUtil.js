import { LIBPROXY_PREFIX } from './externalLinks';

export { LIBPROXY_PREFIX };

/**
 * Return the enabled state for the proxy flag, or null for an unknown value.
 */
export function normalizeProxyFlag(value) {
  if (value === 1 || value === "1" || value === true) {
    return true;
  }
  if (value === 0 || value === "0" || value === false) {
    return false;
  }
  return null;
}

export function loadProxyLink(link) {
  const urlField = Object.prototype.hasOwnProperty.call(link, 'url') ? 'url' : 'link';
  const rawUrl = link[urlField] || '';
  const isPrefixed = rawUrl.startsWith(LIBPROXY_PREFIX);
  const url = isPrefixed
    ? rawUrl.slice(LIBPROXY_PREFIX.length)
    : rawUrl;
  const useProxy = normalizeProxyFlag(link.use_proxy) === true || isPrefixed;
  const loaded = { rawUrl, url, useProxy };

  return {
    ...link,
    [urlField]: url,
    use_proxy: useProxy,
    loaded,
  };
}

export function buildProxyUrl({ url, use_proxy }, loaded) {
  const proxyEnabled = normalizeProxyFlag(use_proxy) === true;
  if (loaded && url === loaded.url && proxyEnabled === loaded.useProxy) {
    return loaded.rawUrl;
  }

  const bareUrl = loadProxyLink({ url, use_proxy: false }).url;
  return proxyEnabled ? `${LIBPROXY_PREFIX}${bareUrl}` : bareUrl;
}

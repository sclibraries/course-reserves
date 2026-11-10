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

export function getProxyState(rawUrl, savedFlag) {
  const isPrefixed = rawUrl.startsWith(LIBPROXY_PREFIX);
  const url = isPrefixed
    ? rawUrl.slice(LIBPROXY_PREFIX.length)
    : rawUrl;

  return {
    rawUrl,
    url,
    useProxy: normalizeProxyFlag(savedFlag) === true || isPrefixed,
  };
}

export function buildProxyUrl({ url, use_proxy, raw_url, original_url, original_use_proxy }) {
  const proxyEnabled = normalizeProxyFlag(use_proxy) === true;
  if (raw_url !== undefined
    && url === original_url
    && proxyEnabled === (normalizeProxyFlag(original_use_proxy) === true)) {
    return raw_url;
  }

  const bareUrl = getProxyState(url, false).url;
  return proxyEnabled ? `${LIBPROXY_PREFIX}${bareUrl}` : bareUrl;
}

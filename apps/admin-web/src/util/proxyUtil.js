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

/**
 * Adjusts the URL in the provided data object based on the proxy flag.
 *
 * - If data.use_proxy is enabled, the function ensures data.link has the proxy prefix.
 * - If data.use_proxy is disabled, the function removes the proxy prefix if present.
 * - Unknown proxy values leave data.link unchanged.
 *
 * @param {Object} data - An object containing the URL and proxy flag.
 * @param {string} data.link - The URL to be adjusted.
 * @param {number|string|boolean} data.use_proxy - Proxy setting in its API or form representation.
 * @returns {Object} The modified data object.
 * @throws {Error} Throws an error if the input is invalid or missing the link property.
 */
export function adjustProxy(data) {
  // Basic error checking to ensure data exists and that link is a valid string.
  if (!data || typeof data.link !== "string") {
    throw new Error("Invalid data or missing link property");
  }

  const proxyEnabled = normalizeProxyFlag(data.use_proxy);

  // If the use_proxy flag is enabled, ensure the proxy prefix is added.
  if (proxyEnabled === true) {
    if (!data.link.startsWith(LIBPROXY_PREFIX)) {
      data.link = LIBPROXY_PREFIX + data.link;
    }
  } 
  // If the use_proxy flag is disabled, remove the proxy prefix if present.
  else if (proxyEnabled === false) {
    if (data.link.startsWith(LIBPROXY_PREFIX)) {
      data.link = data.link.substring(LIBPROXY_PREFIX.length);
    }
  }
  // Return the modified data object.
  return data;
}

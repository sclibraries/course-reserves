// Define the constant proxy prefix URL.
const PROXY_PREFIX = "https://libproxy.smith.edu/login?url=";

/**
 * Adjusts the URL in the provided data object based on the proxy flag.
 *
 * - If data.use_proxy is 1, the function ensures that data.link is prefixed with the proxy URL.
 * - If data.use_proxy is 0, the function removes the proxy prefix from data.link if present.
 *
 * @param {Object} data - An object containing the URL and proxy flag.
 * @param {string} data.link - The URL to be adjusted.
 * @param {number} data.use_proxy - Flag indicating proxy usage (1 to use proxy, 0 to not use proxy).
 * @returns {Object} The modified data object.
 * @throws {Error} Throws an error if the input is invalid or missing the link property.
 */
export function adjustProxy(data) {
  // Basic error checking to ensure data exists and that link is a valid string.
  if (!data || typeof data.link !== "string") {
    throw new Error("Invalid data or missing link property");
  }

  // If the use_proxy flag is set to 1, ensure the proxy prefix is added.
  if (data.use_proxy === 1) {
    if (!data.link.startsWith(PROXY_PREFIX)) {
      data.link = PROXY_PREFIX + data.link;
    }
  } 
  // If the use_proxy flag is set to 0, remove the proxy prefix if present.
  else if (data.use_proxy === 0) {
    if (data.link.startsWith(PROXY_PREFIX)) {
      data.link = data.link.substring(PROXY_PREFIX.length);
    }
  }
  // Return the modified data object.
  return data;
}

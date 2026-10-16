const UNAVAILABLE_MESSAGE = 'Library search is temporarily unavailable. Please try again later, or add the item by citation.';
const RATE_LIMIT_MESSAGE = 'There are too many searches right now. Please wait a moment and try again.';
const GENERIC_MESSAGE = 'Unable to search the library right now. Please try again.';

export async function getDiscoverySearchErrorMessage(response: Response): Promise<string> {
  if (response.status === 429) {
    return RATE_LIMIT_MESSAGE;
  }

  if (response.status === 503) {
    try {
      const payload = await response.json();
      if (payload?.error_code === 'search_unavailable') {
        const reference = typeof payload.reference === 'string' && /^[A-Z0-9]{6,8}$/.test(payload.reference)
          ? `\nReference: ${payload.reference}`
          : '';
        return `${UNAVAILABLE_MESSAGE}${reference}`;
      }
    } catch {
      return GENERIC_MESSAGE;
    }
  }

  return GENERIC_MESSAGE;
}

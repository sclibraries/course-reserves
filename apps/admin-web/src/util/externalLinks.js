export const LIBPROXY_PREFIX = 'https://libproxy.smith.edu/login?url=';
export const HITCHCOCK_VIDEO_PREFIX = 'https://ereserves.smith.edu/hitchcock/videos/';

export function isHitchcockVideoUrl(url) {
  return typeof url === 'string' && url.startsWith(HITCHCOCK_VIDEO_PREFIX);
}

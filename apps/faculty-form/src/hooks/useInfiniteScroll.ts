import { useEffect, useRef, type RefObject } from 'react';

export function useInfiniteScroll(
  onLoadMore: () => void,
  enabled: boolean,
  rootRef?: RefObject<HTMLElement | null>,
) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || !enabled || typeof IntersectionObserver === 'undefined') return undefined;
    const root = rootRef?.current ?? null;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
    }, { root, rootMargin: '240px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, rootRef]);

  return targetRef;
}

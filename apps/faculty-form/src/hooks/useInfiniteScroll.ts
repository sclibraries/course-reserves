import { useEffect, useRef } from 'react';

export function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || !enabled || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
    }, { rootMargin: '240px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, onLoadMore]);

  return targetRef;
}

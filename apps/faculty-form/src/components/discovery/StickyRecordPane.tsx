import { forwardRef, useLayoutEffect, useState, type ReactNode } from 'react';

interface StickyRecordPaneProps {
  children: ReactNode;
  tabIndex?: number;
}

const StickyRecordPane = forwardRef<HTMLDivElement, StickyRecordPaneProps>(function StickyRecordPane({ children, tabIndex }, ref) {
  const [offsets, setOffsets] = useState({ top: 0, bottom: 0 });

  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-testid="page-sticky-top"]');
    const tray = document.querySelector<HTMLElement>('aside[aria-label="Added materials"]');
    const measure = () => {
      const next = {
        top: header?.getBoundingClientRect().height ?? 0,
        bottom: tray?.getBoundingClientRect().height ?? 0,
      };
      setOffsets((current) => current.top === next.top && current.bottom === next.bottom ? current : next);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (header) observer?.observe(header);
    if (tray) observer?.observe(tray);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="min-w-0 break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:sticky md:self-start md:overflow-y-auto"
      style={{ top: offsets.top, maxHeight: `calc(100vh - ${offsets.top}px - ${offsets.bottom}px)` }}
      role="region"
      aria-label="Full record"
      tabIndex={tabIndex}
    >
      {children}
    </div>
  );
});

export default StickyRecordPane;

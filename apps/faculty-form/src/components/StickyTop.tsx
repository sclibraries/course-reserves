import type { ReactNode } from 'react';
import { STICKY_LAYERS } from '@/constants/stickyLayers';
import { ActingForBanner } from '@/components/ActingForBanner';

interface StickyTopProps {
  header: ReactNode;
  toolbar?: ReactNode;
}

export default function StickyTop({ header, toolbar }: StickyTopProps) {
  return (
    <div
      className="sticky top-0"
      data-testid="page-sticky-top"
      style={{ zIndex: STICKY_LAYERS.pageTop }}
    >
      {header}
      <ActingForBanner />
      {toolbar}
    </div>
  );
}

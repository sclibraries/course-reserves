import * as React from 'react';
import { cn } from '@/lib/utils';

const NativeSelect = React.forwardRef(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'tw-flex tw-h-10 tw-w-full tw-rounded-md tw-border tw-border-input tw-bg-background tw-px-3 tw-py-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-ring focus:tw-ring-offset-2',
      className,
    )}
    {...props}
  />
));

NativeSelect.displayName = 'NativeSelect';

export default NativeSelect;

import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      closeButton
      closeButtonAriaLabel="Dismiss notification"
      position="top-right"
      theme="light"
      className="admin-toaster"
      toastOptions={{
        classNames: {
          toast: 'group toast-card tw-border-border tw-bg-background tw-text-foreground tw-shadow-lg',
          description: 'tw-text-muted-foreground',
          actionButton: 'tw-bg-primary tw-text-primary-foreground',
          cancelButton: 'tw-bg-muted tw-text-muted-foreground',
          closeButton: 'tw-h-6 tw-w-6 tw-border-border tw-bg-background tw-text-foreground focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring focus-visible:tw-ring-offset-2 focus-visible:tw-ring-offset-background',
        },
      }}
    />
  );
}

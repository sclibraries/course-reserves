import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";
const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => <ScrollAreaPrimitive.Root ref={ref} className={cn("tw-relative tw-overflow-hidden", className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;
const ScrollBar = React.forwardRef(({ className, orientation = "vertical", ...props }, ref) => <ScrollAreaPrimitive.ScrollAreaScrollbar
  ref={ref}
  orientation={orientation}
  className={cn(
    "tw-flex tw-touch-none tw-select-none tw-transition-colors",
    orientation === "vertical" && "tw-h-full tw-w-2.5 tw-border-l tw-border-l-transparent tw-p-[1px]",
    orientation === "horizontal" && "tw-h-2.5 tw-flex-col tw-border-t tw-border-t-transparent tw-p-[1px]",
    className
  )}
  {...props}
>
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>);
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;
export { ScrollArea, ScrollBar };

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SubmissionStatus = 
  | "draft" 
  | "pending"
  | "submitted" 
  | "in-review" 
  | "partial" 
  | "complete" 
  | "canceled";

interface StatusBadgeProps {
  status: SubmissionStatus;
  className?: string;
}

const statusConfig: Record<SubmissionStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-status-draft/10 text-status-draft border-status-draft/20",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  submitted: {
    label: "Submitted",
    className: "bg-status-submitted/10 text-status-submitted border-status-submitted/20",
  },
  "in-review": {
    label: "In Review",
    className: "bg-status-review/10 text-status-review border-status-review/20",
  },
  partial: {
    label: "Partially Complete",
    className: "bg-status-partial/10 text-status-partial border-status-partial/20",
  },
  complete: {
    label: "Complete",
    className: "bg-status-complete/10 text-status-complete border-status-complete/20",
  },
  canceled: {
    label: "Canceled",
    className: "bg-status-canceled/10 text-status-canceled border-status-canceled/20",
  },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium border",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
};

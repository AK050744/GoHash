import { CircleCheck, CircleX, Clock, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export type NotaryStatus = "PENDING" | "APPROVED" | "REJECTED" | "NOTARIZED";

const statusConfig = {
  PENDING: { icon: Clock, variant: "default" },
  APPROVED: { icon: CircleCheck, variant: "info" },
  REJECTED: { icon: CircleX, variant: "danger" },
  NOTARIZED: { icon: ShieldCheck, variant: "success" },
} as const;

export interface StatusBadgeProps {
  status: NotaryStatus;
  className?: string;
}

function StatusBadge({ status, className }: StatusBadgeProps) {
  const { icon: Icon, variant } = statusConfig[status];
  return (
    <Badge variant={variant} className={className}>
      <Icon className="size-3.5" aria-hidden="true" />
      {status}
    </Badge>
  );
}

export { StatusBadge };

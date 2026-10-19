import { CircleHelp, ShieldCheck, ShieldX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { OnChainAuthorization } from "@/components/notary/types";

const config = {
  AUTHORIZED: { icon: ShieldCheck, variant: "success", label: "Authorized" },
  NOT_AUTHORIZED: { icon: ShieldX, variant: "danger", label: "Not authorized" },
  UNKNOWN: { icon: CircleHelp, variant: "neutral", label: "Unknown" },
} as const;

export interface OnChainBadgeProps {
  status: OnChainAuthorization;
}

function OnChainBadge({ status }: OnChainBadgeProps) {
  const { icon: Icon, variant, label } = config[status];
  return (
    <Badge variant={variant}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export { OnChainBadge };

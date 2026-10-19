import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border-[2.5px] border-dashed border-navy bg-white/70 px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="brut-border flex size-14 items-center justify-center rounded-input bg-cream [&_svg]:size-7"
        >
          {icon}
        </span>
      )}
      <h3 className="text-lg font-extrabold">{title}</h3>
      {description && (
        <p className="max-w-md text-sm font-medium text-slate">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export { EmptyState };

import * as React from "react";

import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="brut-border shadow-hard-sm flex size-14 shrink-0 items-center justify-center rounded-card bg-yellow [&_svg]:size-7"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-extrabold md:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 font-medium text-slate">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export { PageHeader };

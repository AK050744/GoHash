import * as React from "react";

import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  tag: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

function SectionHeader({
  tag,
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        <span className="brut-border shadow-hard-sm inline-flex rounded-full bg-yellow px-3 py-1 text-xs font-bold tracking-[0.14em] text-navy uppercase">
          {tag}
        </span>
        <h2 className="mt-4 text-3xl leading-tight font-extrabold md:text-4xl">
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-base font-medium text-slate">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export { SectionHeader };

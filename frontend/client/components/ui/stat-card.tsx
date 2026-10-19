import * as React from "react";

import { cn } from "@/lib/utils";

type StatTint = "white" | "yellow" | "green" | "teal" | "blue";

const tintClasses: Record<StatTint, string> = {
  white: "bg-cream",
  yellow: "bg-yellow",
  green: "bg-green",
  teal: "bg-teal",
  blue: "bg-blue",
};

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tint?: StatTint;
  hint?: React.ReactNode;
  className?: string;
}

function StatCard({
  icon,
  label,
  value,
  tint = "white",
  hint,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "brut-border shadow-hard rounded-card bg-white p-5 text-navy",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "brut-border flex size-12 shrink-0 items-center justify-center rounded-input text-navy [&_svg]:size-6",
            tintClasses[tint],
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
            {label}
          </p>
          <p className="mt-1 text-3xl font-extrabold">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-3 text-sm font-medium text-slate">{hint}</p>}
    </div>
  );
}

export { StatCard };

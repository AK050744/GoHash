import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type StepStatus = "done" | "active" | "pending" | "failed";

export interface StepperStep {
  label: string;
  description?: string;
  status: StepStatus;
}

const bubbleTone: Record<StepStatus, string> = {
  done: "bg-green text-navy",
  active: "bg-yellow text-navy",
  pending: "bg-white text-navy",
  failed: "bg-danger text-white",
};

const statusText: Record<StepStatus, string> = {
  done: "Done",
  active: "In progress",
  pending: "Not started",
  failed: "Failed",
};

export interface StepperProps {
  steps: StepperStep[];
  className?: string;
}

function Stepper({ steps, className }: StepperProps) {
  return (
    <ol className={cn("flex flex-col md:flex-row md:items-start", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step.label}
            aria-current={step.status === "active" ? "step" : undefined}
            className={cn(
              "relative flex gap-4 pb-8 md:flex-1 md:flex-col md:items-center md:pb-0 md:text-center",
              isLast && "pb-0",
            )}
          >
            {!isLast && (
              <span
                aria-hidden="true"
                className="bg-navy absolute top-12 bottom-0 left-[22.75px] w-[2.5px] md:top-[22.75px] md:right-[calc(24px_-_50%)] md:bottom-auto md:left-[calc(50%_+_24px)] md:h-[2.5px] md:w-auto"
              />
            )}
            <span
              className={cn(
                "brut-border relative isolate flex size-12 shrink-0 items-center justify-center rounded-full text-base font-extrabold",
                bubbleTone[step.status],
              )}
            >
              {step.status === "active" && (
                <span
                  aria-hidden="true"
                  className="animate-pulse-ring absolute inset-0 -z-10 rounded-full bg-yellow"
                />
              )}
              {step.status === "done" && (
                <Check className="size-5" aria-hidden="true" />
              )}
              {step.status === "failed" && (
                <X className="size-5" aria-hidden="true" />
              )}
              {(step.status === "active" || step.status === "pending") &&
                index + 1}
            </span>
            <div className="min-w-0 pt-1 md:mt-4 md:pt-0">
              <p className="font-bold">{step.label}</p>
              <p className="text-xs font-bold tracking-wider text-slate uppercase">
                {statusText[step.status]}
              </p>
              {step.description && (
                <p className="mt-1 text-sm font-medium text-slate">
                  {step.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { Stepper };

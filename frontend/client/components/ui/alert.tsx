import * as React from "react";
import {
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type AlertVariant = "info" | "success" | "warning" | "error";

const alertTones: Record<
  AlertVariant,
  { icon: LucideIcon; tone: string; role: "status" | "alert" }
> = {
  info: { icon: Info, tone: "bg-blue text-white", role: "status" },
  success: { icon: CircleCheck, tone: "bg-green text-navy", role: "status" },
  warning: { icon: TriangleAlert, tone: "bg-yellow text-navy", role: "alert" },
  error: { icon: CircleX, tone: "bg-danger text-white", role: "alert" },
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", children, ...props }, ref) => {
    const { icon: Icon, tone, role } = alertTones[variant];
    return (
      <div
        ref={ref}
        role={role}
        className={cn(
          "brut-border shadow-hard-sm flex w-full gap-3 rounded-card bg-white p-4 text-navy",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "brut-border flex size-8 shrink-0 items-center justify-center rounded-full",
            tone,
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  },
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 leading-6 font-bold", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-medium text-navy", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };

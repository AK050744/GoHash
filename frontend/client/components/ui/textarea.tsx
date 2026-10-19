import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={error || undefined}
      className={cn(
        "shadow-hard-sm min-h-28 w-full rounded-input border-[2.5px] bg-white px-4 py-3 text-base font-medium text-navy placeholder:font-medium placeholder:text-slate disabled:cursor-not-allowed disabled:opacity-90",
        error ? "border-danger" : "border-navy",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };

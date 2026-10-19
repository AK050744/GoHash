import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  leadingIcon?: React.ReactNode;
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leadingIcon, error, ...props }, ref) => (
    <div className="relative w-full">
      {leadingIcon && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 flex -translate-y-1/2 text-slate [&_svg]:size-5"
        >
          {leadingIcon}
        </span>
      )}
      <input
        ref={ref}
        type={type}
        aria-invalid={error || undefined}
        className={cn(
          "shadow-hard-sm h-11 w-full rounded-input border-[2.5px] bg-white px-4 text-base font-medium text-navy placeholder:font-medium placeholder:text-slate disabled:cursor-not-allowed disabled:opacity-90",
          error ? "border-danger" : "border-navy",
          !!leadingIcon && "pl-11",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
Input.displayName = "Input";

export { Input };

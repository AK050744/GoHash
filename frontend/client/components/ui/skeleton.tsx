import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-input bg-navy/10", className)}
      {...props}
    />
  );
}

export { Skeleton };

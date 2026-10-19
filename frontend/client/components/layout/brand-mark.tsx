import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  className?: string;
}

function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className={cn("size-9 shrink-0", className)}
    >
      <path
        d="M20 3 L35 8.5 V19 C35 28.5 28.8 35.2 20 38 C11.2 35.2 5 28.5 5 19 V8.5 Z"
        fill="#F9B81A"
        stroke="#10193A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M15 17 L13.5 26 M21.5 17 L20 26 M11 20.5 H25.5 M10 24.5 H24.5"
        fill="none"
        stroke="#10193A"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { BrandMark };

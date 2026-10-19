import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DecorShape =
  | "shield"
  | "document"
  | "hash"
  | "chain"
  | "stamp"
  | "padlock";

const shapes: Record<DecorShape, ReactNode> = {
  shield: (
    <>
      <path
        d="M36 6 L62 15 V34 C62 50 51 62 36 67 C21 62 10 50 10 34 V15 Z"
        fill="#F9B81A"
        stroke="#10193A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M27 36 L34 43 L46 30"
        fill="none"
        stroke="#10193A"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  document: (
    <>
      <path
        d="M18 6 H44 L58 20 V66 H18 Z"
        fill="#FFFFFF"
        stroke="#10193A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M44 6 V20 H58"
        fill="#F6F0C6"
        stroke="#10193A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M26 34 H50 M26 44 H50 M26 54 H42"
        fill="none"
        stroke="#10193A"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  ),
  hash: (
    <>
      <rect
        x="8"
        y="8"
        width="56"
        height="56"
        rx="14"
        fill="#19D3C5"
        stroke="#10193A"
        strokeWidth="2.5"
      />
      <path
        d="M30 22 L26 50 M46 22 L42 50 M20 30 H54 M18 42 H52"
        fill="none"
        stroke="#10193A"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </>
  ),
  chain: (
    <>
      <rect
        x="6"
        y="26"
        width="34"
        height="20"
        rx="10"
        transform="rotate(-45 36 36)"
        fill="#2B5FE0"
        stroke="#10193A"
        strokeWidth="2.5"
      />
      <rect
        x="32"
        y="26"
        width="34"
        height="20"
        rx="10"
        transform="rotate(-45 36 36)"
        fill="#FFFFFF"
        stroke="#10193A"
        strokeWidth="2.5"
      />
    </>
  ),
  stamp: (
    <>
      <circle
        cx="36"
        cy="36"
        r="28"
        fill="#12A672"
        stroke="#10193A"
        strokeWidth="2.5"
      />
      <circle
        cx="36"
        cy="36"
        r="19"
        fill="none"
        stroke="#10193A"
        strokeWidth="2"
        strokeDasharray="3 3"
      />
      <path
        d="M28 37 L34 43 L45 30"
        fill="none"
        stroke="#10193A"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  padlock: (
    <>
      <path
        d="M26 34 V26 A10 10 0 0 1 46 26 V34"
        fill="none"
        stroke="#10193A"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect
        x="16"
        y="34"
        width="40"
        height="30"
        rx="7"
        fill="#F9B81A"
        stroke="#10193A"
        strokeWidth="2.5"
      />
      <circle cx="36" cy="46" r="4" fill="#10193A" />
      <path d="M36 50 V56" stroke="#10193A" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
};

export interface DecorIconProps {
  shape: DecorShape;
  className?: string;
  style?: CSSProperties;
}

function DecorIcon({ shape, className, style }: DecorIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 72 72"
      style={style}
      className={cn("size-16", className)}
    >
      {shapes[shape]}
    </svg>
  );
}

export interface DecorProps {
  shape: DecorShape;
  className?: string;
  delay?: number;
}

function Decor({ shape, className, delay = 0 }: DecorProps) {
  return (
    <DecorIcon
      shape={shape}
      style={{ animationDelay: `${delay}s` }}
      className={cn(
        "animate-float pointer-events-none absolute hidden xl:block print:hidden",
        className,
      )}
    />
  );
}

export { Decor, DecorIcon };

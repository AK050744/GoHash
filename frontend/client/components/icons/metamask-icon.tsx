import { cn } from "@/lib/utils";

export interface MetaMaskIconProps {
  className?: string;
  size?: number;
}

export function MetaMaskIcon({ className, size = 20 }: MetaMaskIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path
        d="M29.5 2.5L18.2 10.9L20.3 5.7L29.5 2.5Z"
        fill="#E17726"
        stroke="#E17726"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 2.5L11.6 5.8L13.8 10.9L2.5 2.5Z"
        fill="#E27625"
        stroke="#E27625"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25 21.8L22 26.5L28.3 28.2L30.1 21.9L25 21.8Z"
        fill="#E27625"
        stroke="#E27625"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.9 21.9L3.7 28.2L10 26.5L7 21.8L1.9 21.9Z"
        fill="#E27625"
        stroke="#E27625"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.7 13.9L7.8 16.8L14 17.1L13.8 10.5L9.7 13.9Z"
        fill="#E27625"
        stroke="#E27625"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22.3 13.9L18.1 10.5L18 17.1L24.2 16.8L22.3 13.9Z"
        fill="#E27625"
        stroke="#E27625"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 26.5L13.5 24.8L10.5 21.9L10 26.5Z"
        fill="#E27625"
        stroke="#E27625"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 24.8L22 26.5L21.5 21.9L18.5 24.8Z"
        fill="#E27625"
        stroke="#E27625"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 26.5L18.5 24.8L18.8 27.6L18.7 29.5L22 26.5Z"
        fill="#D5BFB2"
        stroke="#D5BFB2"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 26.5L13.3 29.5L13.2 27.6L13.5 24.8L10 26.5Z"
        fill="#D5BFB2"
        stroke="#D5BFB2"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.4 21.3L9.6 20.2L6.8 21.8L10.4 22L13.4 21.3Z"
        fill="#233447"
        stroke="#233447"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.6 21.3L21.6 22L25.2 21.8L22.4 20.2L18.6 21.3Z"
        fill="#233447"
        stroke="#233447"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.7 16.9L1.9 21.9L7 21.8L6.8 17.5L6.7 16.9Z"
        fill="#CC6228"
        stroke="#CC6228"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25.2 16.9L25.1 17.5L25 21.8L30.1 21.9L25.2 16.9Z"
        fill="#CC6228"
        stroke="#CC6228"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 17.1L7.8 16.8L6.7 16.9L6.8 21.8L9.6 20.2L13.4 21.3L14 17.1Z"
        fill="#CC6228"
        stroke="#CC6228"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 17.1L18.6 21.3L22.4 20.2L25.2 21.8L25.1 17.5L24.2 16.8L18 17.1Z"
        fill="#CC6228"
        stroke="#CC6228"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.6 21.3L18 17.1H14L13.4 21.3L13.5 24.8L13.6 24.9C14.3 25.5 15.1 25.8 16 25.8C16.9 25.8 17.7 25.5 18.4 24.9L18.5 24.8L18.6 21.3Z"
        fill="#E27525"
        stroke="#E27525"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.8 27.6L18.5 24.8C17.8 25.4 16.9 25.7 16 25.7C15.1 25.7 14.2 25.4 13.5 24.8L13.2 27.6L13.3 29.5C14.2 30.1 15.1 30.4 16 30.4C16.9 30.4 17.8 30.1 18.7 29.5L18.8 27.6Z"
        fill="#F5841F"
        stroke="#F5841F"
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

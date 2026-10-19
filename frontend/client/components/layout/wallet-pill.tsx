import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type WalletStatus = "disconnected" | "connected" | "wrong-network";

export interface WalletPillProps {
  status?: WalletStatus;
  address?: string;
  network?: string;
  className?: string;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function WalletPill({
  status = "disconnected",
  address,
  network,
  className,
}: WalletPillProps) {
  return (
    <div
      role="status"
      className={cn(
        "brut-border shadow-hard-sm inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold whitespace-nowrap text-navy",
        status === "wrong-network" ? "bg-yellow" : "bg-white",
        className,
      )}
    >
      {status === "wrong-network" && (
        <>
          <TriangleAlert className="size-4" aria-hidden="true" />
          <span>Wrong network</span>
        </>
      )}
      {status === "connected" && (
        <>
          <span aria-hidden="true" className="size-2.5 rounded-full bg-green" />
          <span className="font-mono">
            {address ? shortenAddress(address) : "Connected"}
          </span>
          {network && <span className="text-slate">{network}</span>}
        </>
      )}
      {status === "disconnected" && (
        <>
          <span aria-hidden="true" className="size-2.5 rounded-full bg-slate" />
          <span>Not connected</span>
        </>
      )}
    </div>
  );
}

export { WalletPill };

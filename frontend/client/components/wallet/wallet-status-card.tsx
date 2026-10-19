import { Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface WalletStatusCardProps {
  linked: boolean;
  address?: string;
  network?: string;
  mismatch?: boolean;
}

function WalletStatusCard({
  linked,
  address,
  network,
  mismatch = false,
}: WalletStatusCardProps) {
  return (
    <Card className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="brut-border flex size-14 shrink-0 items-center justify-center rounded-input bg-green"
        >
          <Wallet className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.14em] text-slate uppercase">
            Wallet status
          </p>
          <p className="font-mono font-bold break-all">
            {address ?? "No wallet linked"}
          </p>
        </div>
        <Badge variant={linked ? "success" : "neutral"}>
          {linked ? "Linked" : "Not linked"}
        </Badge>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
            Network
          </dt>
          <dd className="font-bold">{network ?? "—"}</dd>
        </div>
      </dl>

      {mismatch && (
        <Alert variant="warning">
          <AlertTitle>Wallet mismatch</AlertTitle>
          <AlertDescription>
            The connected wallet does not match the linked address. Switch to
            the linked wallet to continue.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <Button variant="outline" disabled>
          Link wallet
        </Button>
      </div>
    </Card>
  );
}

export { WalletStatusCard };

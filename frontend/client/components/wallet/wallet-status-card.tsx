import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface WalletStatusCardProps {
  linked: boolean;
  address?: string;
  connectedAddress?: string | null;
  network?: string;
  mismatch?: boolean;
  onLinkWallet?: () => void;
  isLinking?: boolean;
  linkError?: string | null;
  linkSuccess?: boolean;
}

function WalletStatusCard({
  linked,
  address,
  connectedAddress,
  network,
  mismatch = false,
  onLinkWallet,
  isLinking = false,
  linkError = null,
  linkSuccess = false,
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
            Linked Wallet
          </dt>
          <dd className="font-mono text-sm font-bold break-all">
            {address ?? "None"}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
            Connected MetaMask Account
          </dt>
          <dd className="font-mono text-sm font-bold break-all">
            {connectedAddress ?? "Not connected"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
            Network
          </dt>
          <dd className="font-bold">{network ?? "Hardhat Local"}</dd>
        </div>
      </dl>

      {mismatch && (
        <Alert variant="warning">
          <AlertTitle>Wallet mismatch</AlertTitle>
          <AlertDescription>
            The connected wallet ({connectedAddress}) does not match the linked notary address ({address}). In MetaMask select the notary account, then try again.
          </AlertDescription>
        </Alert>
      )}

      {linkError && (
        <Alert variant="error">
          <AlertTitle>Wallet link failed</AlertTitle>
          <AlertDescription>{linkError}</AlertDescription>
        </Alert>
      )}

      {linkSuccess && (
        <Alert variant="success">
          <AlertTitle>Wallet linked</AlertTitle>
          <AlertDescription>
            Your wallet is now connected to your account.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        {onLinkWallet && !linked && (
          <Button
            type="button"
            variant="teal"
            loading={isLinking}
            disabled={isLinking || linkSuccess}
            onClick={onLinkWallet}
          >
            Connect &amp; Link MetaMask
          </Button>
        )}
        <Button asChild variant="outline">
          <Link to="/profile">
            {linked ? "Manage wallet in profile" : "Open profile"}
          </Link>
        </Button>
      </div>
    </Card>
  );
}

export { WalletStatusCard };

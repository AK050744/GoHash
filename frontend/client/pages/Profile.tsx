import { useState } from "react";
import { UserRound } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import {
  WalletStatusCard,
} from "@/components/wallet/wallet-status-card";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function Profile() {
  const { user, refreshUser } = useAuth();

  /* ── Wallet link flow ── */
  const [walletLinking, setWalletLinking] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletSuccess, setWalletSuccess] = useState(false);

  const handleLinkWallet = async () => {
    setWalletLinking(true);
    setWalletError(null);
    setWalletSuccess(false);

    try {
      // Step 1: get nonce
      const nonceRes = await api.post<{ success: true; message: string }>("/auth/wallet/nonce");

      // Step 2: sign with MetaMask
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("MetaMask not found. Please install MetaMask.");

      const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0];
      if (!address) throw new Error("No wallet account selected.");

      const signature: string = await ethereum.request({
        method: "personal_sign",
        params: [nonceRes.message, address],
      });

      // Step 3: submit signature
      await api.patch("/auth/wallet", { walletAddress: address, signature });
      await refreshUser();
      setWalletSuccess(true);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Wallet link failed");
    } finally {
      setWalletLinking(false);
    }
  };

  const walletProps = user?.walletAddress
    ? { linked: true as const, address: user.walletAddress }
    : { linked: false as const };

  return (
    <PageContainer className="flex flex-col gap-8 pt-12">
      <PageHeader
        icon={<UserRound />}
        title="Profile"
        subtitle="Your personal details and linked wallet."
      />

      <Card className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-extrabold">Personal Information</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              autoComplete="name"
              defaultValue={user?.name ?? ""}
              disabled
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              autoComplete="email"
              defaultValue={user?.email ?? ""}
              disabled
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label>Role</Label>
          <p className="font-bold">{user?.role ?? "—"}</p>
        </div>
      </Card>

      {/* Wallet card */}
      <WalletStatusCard {...walletProps} />

      {/* Link wallet section — only shown when no wallet is linked */}
      {!user?.walletAddress && (
        <Card className="flex flex-col gap-6 p-6 md:p-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-extrabold">Link a Wallet</h2>
            <p className="text-sm font-medium text-slate">
              Connect MetaMask to enable notarization requests.
            </p>
          </div>

          {walletError && (
            <Alert variant="error">
              <AlertTitle>Wallet link failed</AlertTitle>
              <AlertDescription>{walletError}</AlertDescription>
            </Alert>
          )}

          {walletSuccess && (
            <Alert variant="success">
              <AlertTitle>Wallet linked</AlertTitle>
              <AlertDescription>
                Your wallet is now connected to your account.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleLinkWallet}
            loading={walletLinking}
            disabled={walletLinking || walletSuccess}
            variant="teal"
          >
            Connect MetaMask
          </Button>
        </Card>
      )}
    </PageContainer>
  );
}

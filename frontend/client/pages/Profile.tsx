import { useState } from "react";
import { Lock, UserRound } from "lucide-react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

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
import { useAuth, type AuthUser } from "@/context/AuthContext";
import { useGoogleAuth } from "@/context/GoogleAuthContext";
import { api } from "@/lib/api";
import {
  parseGoogleAuthError,
  GOOGLE_SCRIPT_LOAD_ERROR,
} from "@/lib/google-auth-errors";
import { formatWalletError, linkMetaMaskWallet, useConnectedWallet } from "@/lib/wallet";

export default function Profile() {
  const { user, refreshUser, updateUser } = useAuth();
  const { googleEnabled, scriptLoadError } = useGoogleAuth();
  const { connectedAccount, isMismatch } = useConnectedWallet(user?.walletAddress);

  /* ── Google link flow ── */
  const [googleLinking, setGoogleLinking] = useState(false);
  const [googleLinkError, setGoogleLinkError] = useState<string | null>(null);
  const [googleLinkSuccess, setGoogleLinkSuccess] = useState(false);

  const hasPassword = user?.authProviders
    ? user.authProviders.includes("PASSWORD")
    : true;

  const handleGoogleLinkSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setGoogleLinkError("Google link failed: No credential received.");
      return;
    }

    setGoogleLinking(true);
    setGoogleLinkError(null);
    setGoogleLinkSuccess(false);

    try {
      const res = await api.post<{
        success: true;
        user: AuthUser;
      }>("/auth/google/link", {
        credential: credentialResponse.credential,
      });

      updateUser(res.user);
      setGoogleLinkSuccess(true);
      await refreshUser();
    } catch (err) {
      const parsed = parseGoogleAuthError(err);
      setGoogleLinkError(parsed.message);
    } finally {
      setGoogleLinking(false);
    }
  };

  const handleGoogleLinkError = () => {
    setGoogleLinkError(GOOGLE_SCRIPT_LOAD_ERROR);
  };

  /* ── Wallet link flow ── */
  const [walletLinking, setWalletLinking] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletSuccess, setWalletSuccess] = useState(false);

  const handleLinkWallet = async () => {
    setWalletLinking(true);
    setWalletError(null);
    setWalletSuccess(false);

    try {
      await linkMetaMaskWallet(refreshUser);
      setWalletSuccess(true);
    } catch (err) {
      setWalletError(formatWalletError(err));
    } finally {
      setWalletLinking(false);
    }
  };

  const walletProps = user?.walletAddress
    ? {
        linked: true as const,
        address: user.walletAddress,
        connectedAddress: connectedAccount,
        mismatch: isMismatch,
      }
    : {
        linked: false as const,
        connectedAddress: connectedAccount,
        mismatch: isMismatch,
      };

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

      {/* Sign-in methods card */}
      <Card className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-extrabold">Sign-in Methods</h2>
          <p className="text-sm font-medium text-slate">
            Manage how you authenticate with your GoHash account.
          </p>
        </div>

        {googleLinkError && (
          <Alert variant="error">
            <AlertTitle>Google linking failed</AlertTitle>
            <AlertDescription>{googleLinkError}</AlertDescription>
          </Alert>
        )}

        {googleLinkSuccess && (
          <Alert variant="success">
            <AlertTitle>Google account linked</AlertTitle>
            <AlertDescription>
              Your Google account has been successfully linked to your profile.
            </AlertDescription>
          </Alert>
        )}

        {googleEnabled && scriptLoadError && (
          <Alert variant="error">
            <AlertDescription>{GOOGLE_SCRIPT_LOAD_ERROR}</AlertDescription>
          </Alert>
        )}

        <div className="divide-y divide-border/60">
          {/* Password (shown when the account has one) */}
          {hasPassword && (
            <div className="flex items-center justify-between py-4 first:pt-0">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-navy/5 text-navy">
                  <Lock className="size-5" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Password</p>
                  <p className="text-xs text-slate">
                    Sign in using your email and password
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Configured
              </span>
            </div>
          )}

          {/* Google (shown when Google is enabled) */}
          {googleEnabled && (
            <div className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-navy/5 text-navy">
                  <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-foreground">Google</p>
                  <p className="text-xs text-slate">
                    {user?.googleLinked
                      ? "Linked to your GoHash account"
                      : "Link your Google account for one-click sign in"}
                  </p>
                </div>
              </div>

              <div>
                {user?.googleLinked ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Linked
                  </span>
                ) : (
                  <div
                    className={`flex items-center gap-2 ${
                      googleLinking ? "pointer-events-none opacity-50" : ""
                    }`}
                    data-testid="link-google-button"
                    aria-label="Link Google account"
                  >
                    <GoogleLogin
                      text="continue_with"
                      shape="rectangular"
                      size="medium"
                      theme="outline"
                      auto_select={false}
                      useOneTap={false}
                      onSuccess={handleGoogleLinkSuccess}
                      onError={handleGoogleLinkError}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
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

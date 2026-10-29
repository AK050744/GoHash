import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Layers,
  LogOut,
  RefreshCw,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import { MetaMaskIcon } from "@/components/icons/metamask-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useMetaMask } from "@/context/MetaMaskContext";
import { cn } from "@/lib/utils";

export interface WalletPillProps {
  className?: string;
  // Fallback props for compatibility
  status?: "disconnected" | "connected" | "wrong-network";
  address?: string;
  network?: string;
}

function shortenAddress(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletPill({ className }: WalletPillProps) {
  const { user } = useAuth();
  const {
    isInstalled,
    isConnected,
    isConnecting,
    account,
    balance,
    chainId,
    isCorrectNetwork,
    expectedChainName,
    expectedChainHex,
    error,
    connect,
    switchNetwork,
    clearError,
  } = useMetaMask();

  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Address priority: active MetaMask account, or GoHash linked wallet
  const displayAddress = account || user?.walletAddress;

  const isMismatch = Boolean(
    account &&
      user?.walletAddress &&
      account.toLowerCase() !== user.walletAddress.toLowerCase()
  );

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSwitchNetwork = async () => {
    setSwitching(true);
    try {
      await switchNetwork();
    } finally {
      setSwitching(false);
    }
  };

  const handlePillClick = () => {
    if (!isInstalled) {
      setModalOpen(true);
      return;
    }
    if (!isConnected) {
      void connect();
      return;
    }
    setModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handlePillClick}
        aria-label="MetaMask wallet status"
        className={cn(
          "brut-border shadow-hard-sm inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold whitespace-nowrap text-navy transition-all duration-150 hover:translate-y-[-1px] hover:shadow-hard active:translate-y-[1px]",
          !isInstalled
            ? "border-amber-400 bg-amber-50 hover:bg-amber-100/80"
            : !isConnected
              ? "bg-white hover:bg-cream"
              : !isCorrectNetwork
                ? "bg-yellow hover:bg-yellow/90"
                : "bg-white hover:bg-cream",
          className
        )}
      >
        <MetaMaskIcon size={20} />

        {!isInstalled ? (
          <span className="flex items-center gap-1.5 text-xs text-amber-900">
            <span>Install MetaMask</span>
          </span>
        ) : !isConnected ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="size-2 rounded-full bg-slate-400" />
            <span>{isConnecting ? "Connecting…" : "Connect Wallet"}</span>
          </span>
        ) : !isCorrectNetwork ? (
          <span className="flex items-center gap-1.5 text-xs text-navy">
            <TriangleAlert className="size-3.5 text-navy" />
            <span>Wrong Network</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 font-mono text-xs">
            <span className="size-2 rounded-full bg-green" />
            <span>{displayAddress ? shortenAddress(displayAddress) : "Connected"}</span>
            {balance && <span className="text-slate font-sans font-medium">({balance} ETH)</span>}
          </span>
        )}
      </button>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="brut-border shadow-hard sm:max-w-md bg-white">
          <DialogHeader>
            <div className="flex items-center gap-3 pb-2">
              <div className="brut-border flex size-12 items-center justify-center rounded-2xl bg-amber-50 shadow-xs">
                <MetaMaskIcon size={28} />
              </div>
              <div>
                <DialogTitle className="text-xl font-extrabold text-navy">
                  MetaMask Integration
                </DialogTitle>
                <DialogDescription className="text-xs text-slate">
                  Manage your Web3 wallet for blockchain notarizations
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* State 1: Extension Not Installed */}
          {!isInstalled ? (
            <div className="flex flex-col gap-4 py-2">
              <Alert variant="warning">
                <AlertCircle className="size-5" />
                <AlertTitle>MetaMask Extension Not Detected</AlertTitle>
                <AlertDescription className="text-xs">
                  The MetaMask browser extension was not found in your browser. MetaMask is required to sign transactions and verify documents on the blockchain.
                </AlertDescription>
              </Alert>

              <div className="rounded-card border-2 border-dashed border-slate-300 bg-cream/40 p-4 text-xs space-y-2">
                <p className="font-bold text-navy">How to install MetaMask:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-700">
                  <li>Click the button below to visit the official MetaMask site.</li>
                  <li>Install the extension for Chrome / your browser.</li>
                  <li>Create or import an Ethereum wallet.</li>
                  <li>Refresh this page and connect!</li>
                </ol>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button asChild variant="primary" className="w-full justify-center">
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MetaMaskIcon size={18} className="mr-2" />
                    Install MetaMask Extension
                    <ExternalLink className="size-4 ml-1.5" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  <RefreshCw className="size-4 mr-2" />
                  I have installed it (Refresh page)
                </Button>
              </div>
            </div>
          ) : (
            /* State 2: Extension Installed */
            <div className="flex flex-col gap-4 py-2">
              {error && (
                <Alert variant="error">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              {/* Connected Account Section */}
              <div className="brut-border rounded-xl bg-cream/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate">
                    Connected Account
                  </span>
                  <Badge variant={isConnected ? "success" : "neutral"} className="text-[10px]">
                    {isConnected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>

                {isConnected && account ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-navy break-all">
                      {account}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="size-8 p-0 shrink-0"
                      onClick={() => handleCopy(account)}
                    >
                      {copied ? (
                        <CheckCircle2 className="size-3.5 text-green" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm font-medium text-slate">No account active</span>
                    <Button
                      size="sm"
                      variant="teal"
                      onClick={() => void connect()}
                      loading={isConnecting}
                    >
                      Connect
                    </Button>
                  </div>
                )}

                {isConnected && balance && (
                  <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-200">
                    <span className="text-slate">ETH Balance:</span>
                    <span className="font-mono font-bold text-navy">{balance} ETH</span>
                  </div>
                )}
              </div>

              {/* Network Section */}
              <div className="brut-border rounded-xl bg-white p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate">
                    Blockchain Network
                  </span>
                  <Badge
                    variant={isCorrectNetwork ? "teal" : "warning"}
                    className="text-[10px]"
                  >
                    {isCorrectNetwork ? "Correct Network" : "Wrong Network"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate">Target Network:</span>
                  <span className="font-bold text-navy">{expectedChainName} ({expectedChainHex})</span>
                </div>

                {!isCorrectNetwork && (
                  <div className="pt-2">
                    <Button
                      variant="yellow"
                      size="sm"
                      className="w-full justify-center text-xs"
                      onClick={handleSwitchNetwork}
                      loading={switching}
                    >
                      <Layers className="size-3.5 mr-1.5" />
                      Switch to {expectedChainName}
                    </Button>
                  </div>
                )}
              </div>

              {/* Mismatch Warning with GoHash Profile */}
              {isMismatch && (
                <Alert variant="warning">
                  <TriangleAlert className="size-4" />
                  <AlertTitle className="text-xs">Account Mismatch</AlertTitle>
                  <AlertDescription className="text-xs">
                    Your active MetaMask account does not match the wallet linked to your GoHash profile ({shortenAddress(user?.walletAddress || "")}). You can update your linked wallet in your profile.
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/profile" onClick={() => setModalOpen(false)}>
                    <Wallet className="size-3.5 mr-1.5" />
                    Manage in Profile
                  </Link>
                </Button>

                {isConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void connect();
                    }}
                  >
                    Switch Account
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void connect()}
                    loading={isConnecting}
                  >
                    Connect MetaMask
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

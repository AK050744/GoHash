import { useCallback, useEffect, useState } from "react";
import { Check, Coins, ExternalLink, RefreshCw, Wallet } from "lucide-react";

import { HashBlock, shortenHash } from "@/components/documents/hash-block";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Stepper, type StepStatus, type StepperStep } from "@/components/ui/stepper";
import { api } from "@/lib/api";
import { FeeConfig, mapPaymentError } from "@/lib/fees";

export type PaymentFlowState =
  | "idle"
  | "awaiting-wallet"
  | "pending"
  | "verifying"
  | "paid"
  | "failed"
  | "rejected-by-user";

const stepLabels = [
  "Sign in wallet",
  "Network confirmation",
  "Verify payment",
  "Fee confirmed",
];

const stepStatusByState: Record<PaymentFlowState, StepStatus[]> = {
  idle: ["pending", "pending", "pending", "pending"],
  "awaiting-wallet": ["active", "pending", "pending", "pending"],
  pending: ["done", "active", "pending", "pending"],
  verifying: ["done", "done", "active", "pending"],
  paid: ["done", "done", "done", "done"],
  failed: ["failed", "pending", "pending", "pending"],
  "rejected-by-user": ["failed", "pending", "pending", "pending"],
};

export interface FeePaymentCardProps {
  notarizationId: string;
  documentId: string;
  feeConfig: FeeConfig;
  userLinkedWallet?: string | null;
  currentPayment?: {
    status: string;
    amountWei?: string;
    transactionHash?: string;
    refundDue?: boolean;
  } | null;
  onPaymentSuccess: () => Promise<void> | void;
}

export function FeePaymentCard({
  notarizationId,
  feeConfig,
  userLinkedWallet,
  currentPayment,
  onPaymentSuccess,
}: FeePaymentCardProps) {
  const [paymentState, setPaymentState] = useState<PaymentFlowState>(
    currentPayment?.status === "PAID" ? "paid" : "idle",
  );
  const [txHash, setTxHash] = useState<string | null>(
    currentPayment?.transactionHash ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [estimatedGas, setEstimatedGas] = useState<string>("~0.000021 ETH");

  // Wallet environment tracking
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [currentChainId, setCurrentChainId] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);

  // Resume payment tracking from sessionStorage
  const sessionKey = `gohash_pending_payment_${notarizationId}`;
  const [resumableTx, setResumableTx] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored && currentPayment?.status !== "PAID") {
        setResumableTx(stored);
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [sessionKey, currentPayment?.status]);

  // Query and listen to MetaMask state
  const checkWalletState = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    try {
      const accounts: string[] = await ethereum.request({
        method: "eth_accounts",
      });
      setConnectedAccount(accounts[0] ? accounts[0].toLowerCase() : null);

      const chainId: string = await ethereum.request({ method: "eth_chainId" });
      setCurrentChainId(chainId ? chainId.toLowerCase() : null);

      // Estimate gas fee for plain transfer
      try {
        const { ethers } = await import("ethers");
        const provider = new ethers.BrowserProvider(ethereum);
        const feeData = await provider.getFeeData();
        const gasUnits = 21000n; // Standard plain ETH transfer
        const price = feeData.gasPrice ?? 1000000000n;
        const weiCost = gasUnits * price;
        const ethCost = ethers.formatEther(weiCost);
        setEstimatedGas(`~${parseFloat(ethCost).toFixed(6)} ETH`);
      } catch {
        setEstimatedGas("~0.000021 ETH");
      }
    } catch {
      // Ignore wallet query errors
    }
  }, []);

  useEffect(() => {
    void checkWalletState();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setConnectedAccount(accounts[0] ? accounts[0].toLowerCase() : null);
    };
    const handleChainChanged = (chainId: string) => {
      setCurrentChainId(chainId ? chainId.toLowerCase() : null);
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [checkWalletState]);

  // Network matching logic
  const targetChainIdNum = feeConfig.chainId ?? 31337;
  const targetChainIdHex = "0x" + targetChainIdNum.toString(16).toLowerCase();
  const isCorrectNetwork = currentChainId
    ? parseInt(currentChainId, 16) === targetChainIdNum
    : false;

  const isWalletLinked = Boolean(userLinkedWallet);
  const isAccountMatch = Boolean(
    connectedAccount &&
      userLinkedWallet &&
      connectedAccount.toLowerCase() === userLinkedWallet.toLowerCase(),
  );

  const canPay =
    isWalletLinked &&
    Boolean(connectedAccount) &&
    isCorrectNetwork &&
    isAccountMatch &&
    paymentState !== "paid" &&
    !["awaiting-wallet", "pending", "verifying"].includes(paymentState);

  // Explanation if disabled
  let disabledReason = "";
  if (!isWalletLinked) {
    disabledReason = "Link a wallet to your GoHash profile first.";
  } else if (!connectedAccount) {
    disabledReason = "Connect your MetaMask wallet.";
  } else if (!isCorrectNetwork) {
    disabledReason = `Switch your wallet to the local network (Chain ID ${targetChainIdNum}).`;
  } else if (!isAccountMatch) {
    disabledReason = `Connected wallet (${shortenHash(connectedAccount)}) does not match your linked wallet (${shortenHash(userLinkedWallet)}).`;
  }

  // Connect wallet button helper
  const handleConnectWallet = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setErrorMessage("MetaMask not detected. Please install MetaMask.");
      return;
    }
    setConnectingWallet(true);
    try {
      const accounts: string[] = await ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts[0]) {
        setConnectedAccount(accounts[0].toLowerCase());
      }
    } catch (err) {
      setErrorMessage(mapPaymentError(err));
    } finally {
      setConnectingWallet(false);
    }
  };

  // Switch network button helper
  const handleSwitchNetwork = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainIdHex }],
      });
      setCurrentChainId(targetChainIdHex);
    } catch (switchError: any) {
      if (switchError?.code === 4902 || switchError?.message?.includes("Unrecognized chain ID")) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: targetChainIdHex,
                chainName: expectedChainName || "Hardhat Local",
                rpcUrls: [import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545"],
                nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
              },
            ],
          });
          setCurrentChainId(targetChainIdHex);
        } catch {
          // ignore
        }
      }
    }
  };

  // Backend verification polling helper (poll up to 30 seconds on 202)
  const pollBackendVerification = async (hashToVerify: string) => {
    setPaymentState("verifying");
    const startTime = Date.now();
    const MAX_POLL_MS = 30000;
    let verified = false;

    while (!verified && Date.now() - startTime < MAX_POLL_MS) {
      try {
        const res = await api.post<{
          success: true;
          status?: string;
          payment?: { status: string; amountWei: string; transactionHash: string };
        }>(`/notarization/${notarizationId}/payment`, {
          transactionHash: hashToVerify,
        });

        if (res.status === "TX_PENDING") {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        if (res.payment?.status === "PAID" || res.success) {
          verified = true;
          try {
            sessionStorage.removeItem(sessionKey);
          } catch {
            // Ignore
          }
          setResumableTx(null);
          setPaymentState("paid");
          await onPaymentSuccess();
          break;
        }
      } catch (err: unknown) {
        const errorObj = err as { code?: string; status?: number };
        if (errorObj?.code === "TX_PENDING" || errorObj?.status === 202) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        throw err;
      }
    }

    if (!verified) {
      throw new Error(
        "Verification timed out while waiting for transaction confirmation. You can resume verification below.",
      );
    }
  };

  // Resume stored payment
  const handleResume = async () => {
    if (!resumableTx) return;
    setErrorMessage(null);
    try {
      setTxHash(resumableTx);
      await pollBackendVerification(resumableTx);
    } catch (err) {
      setPaymentState("failed");
      setErrorMessage(mapPaymentError(err));
    }
  };

  // Execute payment with MetaMask
  const handlePay = async () => {
    if (!feeConfig.recipient || !feeConfig.amountWei) {
      setErrorMessage("Fee configuration is missing required parameters.");
      return;
    }

    setErrorMessage(null);
    setPaymentState("awaiting-wallet");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error("MetaMask is required to submit the payment.");
      }

      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      // Plain ETH transfer only
      const tx = await signer.sendTransaction({
        to: feeConfig.recipient,
        value: BigInt(feeConfig.amountWei),
      });

      setTxHash(tx.hash);
      try {
        sessionStorage.setItem(sessionKey, tx.hash);
      } catch {
        // Ignore
      }

      setPaymentState("pending");

      // Give transaction a brief moment to be mined
      try {
        await Promise.race([
          tx.wait(1),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch {
        // Continue to backend verification loop
      }

      await pollBackendVerification(tx.hash);
    } catch (err) {
      const mapped = mapPaymentError(err);
      if (
        mapped.includes("rejected in MetaMask") ||
        (err as { code?: number | string })?.code === 4001
      ) {
        setPaymentState("rejected-by-user");
      } else {
        setPaymentState("failed");
      }
      setErrorMessage(mapped);
    }
  };

  const steps: StepperStep[] = stepLabels.map((label, idx) => ({
    label,
    status: stepStatusByState[paymentState][idx],
  }));

  if (!feeConfig.enabled) {
    return null;
  }

  return (
    <Card className="flex flex-col gap-6 p-6 md:p-8 border-2 border-navy">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="brut-border flex size-12 items-center justify-center rounded-input bg-yellow text-navy"
          >
            <Coins className="size-6" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-navy">Notarization fee</h2>
            <p className="text-sm font-semibold text-slate">
              Required before notary approval
            </p>
          </div>
        </div>
        {paymentState === "paid" && (
          <Badge variant="success" className="text-sm px-3 py-1">
            <Check className="size-4 mr-1 inline" /> Fee Paid
          </Badge>
        )}
      </div>

      <div className="rounded-card border-2 border-navy/20 bg-cream/50 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/10 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate">
            Fee Amount:
          </span>
          <span className="text-lg font-extrabold text-navy">
            {feeConfig.amountEth ?? "0"} {feeConfig.symbol ?? "ETH"}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/10 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate">
            Fee Recipient:
          </span>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs font-bold bg-white px-2 py-1 rounded border border-navy/20">
              {shortenHash(feeConfig.recipient ?? "")}
            </code>
            {feeConfig.recipient && (
              <CopyButton
                value={feeConfig.recipient}
                label="recipient address"
                className="size-7"
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate">
            Estimated Network Fee:
          </span>
          <span className="font-mono text-xs font-bold text-navy">
            {estimatedGas} <span className="text-slate font-medium">(estimate)</span>
          </span>
        </div>
      </div>

      <p className="text-sm font-medium text-slate">
        Test ETH on the local network. The notary pays the network (gas) fee to record your document; your fee covers it.
      </p>

      {resumableTx && paymentState !== "paid" && (
        <Alert variant="info" className="flex flex-col gap-2">
          <AlertTitle className="flex items-center gap-2">
            <RefreshCw className="size-4" /> Unfinished payment detected
          </AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="font-mono text-xs break-all">
              Tx: {shortenHash(resumableTx)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResume}
              loading={paymentState === "verifying"}
              disabled={["awaiting-wallet", "pending", "verifying"].includes(
                paymentState,
              )}
            >
              Resume previous payment
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="error">
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Stepper displayed during or after payment flow */}
      {paymentState !== "idle" && (
        <div className="flex flex-col gap-4 py-2">
          <Stepper steps={steps} />
          {txHash && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate">
              <span>Transaction hash:</span>
              <HashBlock value={txHash} label="payment transaction" />
            </div>
          )}
        </div>
      )}

      {/* Action / Payment button and disabled reasons */}
      {paymentState !== "paid" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              variant="primary"
              icon={<Wallet />}
              loading={["awaiting-wallet", "pending", "verifying"].includes(
                paymentState,
              )}
              disabled={!canPay}
              onClick={handlePay}
            >
              Pay with MetaMask
            </Button>

            {!connectedAccount && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                loading={connectingWallet}
                onClick={handleConnectWallet}
              >
                Connect MetaMask
              </Button>
            )}

            {connectedAccount && !isCorrectNetwork && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleSwitchNetwork}
              >
                Switch to Chain {targetChainIdNum}
              </Button>
            )}
          </div>

          {!canPay && disabledReason && (
            <p className="text-xs font-semibold text-danger">{disabledReason}</p>
          )}
        </div>
      )}
    </Card>
  );
}

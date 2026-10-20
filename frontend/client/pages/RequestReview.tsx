import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ClipboardCheck, ExternalLink, FileText, ScrollText, X } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { ApprovalProgress } from "@/components/notary/approval-progress";
import type {
  ApprovalState,
  PendingRequest,
  RequestReceipt,
} from "@/components/notary/types";
import { HashBlock } from "@/components/documents/hash-block";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { FeeConfig, getFeeConfig } from "@/lib/fees";
import { formatWalletError, linkMetaMaskWallet, useConnectedWallet } from "@/lib/wallet";
import { useAuth } from "@/context/AuthContext";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const TOKEN_KEY = "gohash_token";

interface ApiNotarization {
  id: string;
  documentId: string;
  documentHash: string;
  status: string;
  createdAt: string;
  transactionHash?: string | null;
  blockNumber?: number | null;
  contractAddress?: string | null;
  notarizationKey?: string | null;
  document: { id: string; originalName: string; sha256Hash: string };
  owner: { name: string };
  payment?: {
    status: string;
    amountWei?: string;
    transactionHash?: string;
    refundDue?: boolean;
  } | null;
}

export default function RequestReview() {
  const { id = "" } = useParams();
  const { user, refreshUser } = useAuth();
  const { connectedAccount, isMismatch } = useConnectedWallet(user?.walletAddress);

  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [feeConfig, setFeeConfig] = useState<FeeConfig>({ enabled: false });
  const [documentId, setDocumentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [estimatedGas, setEstimatedGas] = useState<string>("~0.000075 ETH");

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [approvalState, setApprovalState] = useState<ApprovalState>("idle");
  const [receipt, setReceipt] = useState<RequestReceipt | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  /* ── Inline wallet link state ── */
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);

  const walletLinked = !!user?.walletAddress;

  const handleLinkWallet = async () => {
    setLinkingWallet(true);
    setLinkError(null);
    setLinkSuccess(false);
    try {
      await linkMetaMaskWallet(refreshUser);
      setLinkSuccess(true);
    } catch (err) {
      setLinkError(formatWalletError(err));
    } finally {
      setLinkingWallet(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [res, fees] = await Promise.all([
        api.get<{ success: true; notarization: ApiNotarization }>(
          `/notarization/${id}`,
        ),
        getFeeConfig(),
      ]);
      setFeeConfig(fees);
      const n = res.notarization;
      setRequest({
        id: n.id,
        documentName: n.document.originalName,
        hash: n.documentHash,
        ownerName: n.owner.name,
        requestedAt: new Date(n.createdAt).toLocaleDateString(),
        status: n.status,
        payment: n.payment ?? null,
      });
      setDocumentId(n.document.id);

      if (n.status === "CONFIRMED") {
        setApprovalState("confirmed");
        setReceipt({
          transactionHash: n.transactionHash ?? "",
          blockNumber: n.blockNumber !== undefined && n.blockNumber !== null ? String(n.blockNumber) : "",
          contractAddress: n.contractAddress ?? "",
          notarizationKey: n.notarizationKey ?? undefined,
        });
      }

      // Estimate notarization gas
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ethereum = (window as any).ethereum;
        if (ethereum) {
          const { ethers } = await import("ethers");
          const provider = new ethers.BrowserProvider(ethereum);
          const feeData = await provider.getFeeData();
          const gasUnits = 75000n;
          const price = feeData.gasPrice ?? 1000000000n;
          const wei = gasUnits * price;
          const ethVal = ethers.formatEther(wei);
          setEstimatedGas(`~${parseFloat(ethVal).toFixed(6)} ETH`);
        }
      } catch {
        setEstimatedGas("~0.000075 ETH");
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load request");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReject = async () => {
    if (!reason.trim()) return;
    setRejectLoading(true);
    setRejectError(null);
    try {
      await api.post(`/notarization/${id}/reject`, { reason });
      setRejectOpen(false);
      await load();
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setRejectLoading(false);
    }
  };

  const handleApprove = async () => {
    setApprovalState("preparing");
    setApprovalError(null);
    try {
      // Step 1: Call approve endpoint to get contract call data
      const approveRes = await api.post<{
        success: true;
        contractAddress: string;
        chainId: number;
        abi: string[];
        method: string;
        args: string[];
      }>(`/notarization/${id}/approve`);

      setApprovalState("awaiting-wallet");

      // Step 2: Invoke MetaMask transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("MetaMask not found. Please install MetaMask to continue.");

      // Ensure network matches expected chain
      const currentChainId = await ethereum.request({ method: "eth_chainId" });
      const expectedHexChainId = "0x" + Number(approveRes.chainId).toString(16);
      if (currentChainId !== expectedHexChainId) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: expectedHexChainId }],
          });
        } catch (switchErr) {
          console.warn("Could not auto-switch network:", switchErr);
        }
      }

      const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
      const activeAccount = accounts[0];
      if (!activeAccount) throw new Error("No active account found in MetaMask.");

      if (
        user?.walletAddress &&
        activeAccount.toLowerCase() !== user.walletAddress.toLowerCase()
      ) {
        throw new Error(
          "This wallet is linked to another GoHash account. In MetaMask select the notary account, then try again."
        );
      }

      // Encode the function call using ethers-compatible encoding
      const [documentHash, ipfsCid, ownerAddress] = approveRes.args;

      const { ethers } = await import("ethers");
      const fullAbi =
        Array.isArray(approveRes.abi) &&
        approveRes.abi.some((item) => typeof item === "string" && item.includes("notarize("))
          ? approveRes.abi
          : [
              ...(approveRes.abi || []),
              "function notarize(bytes32 documentHash, string calldata ipfsCid, address owner) external",
            ];
      const iface = new ethers.Interface(fullAbi);
      const data = iface.encodeFunctionData(approveRes.method || "notarize", [
        documentHash,
        ipfsCid ?? "",
        ownerAddress,
      ]);

      const txHash: string = await ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: activeAccount,
            to: approveRes.contractAddress,
            data,
          },
        ],
      });

      setApprovalState("pending");

      // Step 3: Poll confirm endpoint
      let confirmed = false;
      let attempts = 0;
      while (!confirmed && attempts < 20) {
        await new Promise((r) => setTimeout(r, 3000));
        attempts++;
        try {
          const confirmRes = await api.post<{
            success: true;
            status?: string;
            notarization?: {
              transactionHash: string;
              blockNumber: number;
              contractAddress: string;
              notarizationKey?: string;
            };
          }>(`/notarization/${id}/confirm`, { transactionHash: txHash });

          if (confirmRes.status === "TX_PENDING") continue;

          setApprovalState("verifying");
          await new Promise((r) => setTimeout(r, 1000));

          if (confirmRes.notarization) {
            setReceipt({
              transactionHash: confirmRes.notarization.transactionHash,
              blockNumber: String(confirmRes.notarization.blockNumber),
              contractAddress: confirmRes.notarization.contractAddress,
              notarizationKey: confirmRes.notarization.notarizationKey,
            });
            setApprovalState("confirmed");
            setRequest((prev) => (prev ? { ...prev, status: "CONFIRMED" } : prev));
            confirmed = true;
          }
        } catch {
          // keep polling
        }
      }

      if (!confirmed) {
        setApprovalState("failed");
        setApprovalError("Transaction timed out. Check your wallet for status.");
      }
    } catch (err: unknown) {
      const errObj = err as { code?: string; status?: number; message?: string };
      if (
        errObj?.code === "PAYMENT_REQUIRED" ||
        errObj?.status === 402 ||
        errObj?.message?.includes("PAYMENT_REQUIRED")
      ) {
        setApprovalState("failed");
        setApprovalError("A notarization fee is required before this request can be approved.");
        return;
      }
      const message = err instanceof Error ? err.message : "Approval failed";
      if (message.includes("user rejected") || message.toLowerCase().includes("denied")) {
        setApprovalState("rejected-by-user");
        setApprovalError("Transaction was rejected in MetaMask.");
      } else {
        setApprovalState("failed");
        setApprovalError(message);
      }
    }
  };

  const openPdf = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    window.open(`${BASE}/documents/${documentId}/file?token=${token}`, "_blank");
  };

  if (loading) {
    return (
      <PageContainer className="flex flex-col gap-8 pt-12">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-8 pt-12">
      <PageHeader
        icon={<ClipboardCheck />}
        title={request?.documentName ?? "Request review"}
        subtitle={`Request ${id}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              status={
                approvalState === "confirmed" || request?.status === "CONFIRMED"
                  ? "NOTARIZED"
                  : request?.status === "REJECTED"
                    ? "REJECTED"
                    : request?.status === "APPROVED"
                      ? "APPROVED"
                      : "PENDING"
              }
            />
            <Button asChild variant="outline">
              <Link to="/notary/dashboard">
                <ArrowLeft aria-hidden="true" />
                Back to requests
              </Link>
            </Button>
          </div>
        }
      />

      {loadError && (
        <Alert variant="error">
          <AlertTitle>Could not load request</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold tracking-[0.14em] text-slate uppercase">
            SHA-256 fingerprint
          </p>
          {request ? (
            <HashBlock value={request.hash} label="document hash" />
          ) : (
            <span className="font-bold text-slate">—</span>
          )}
        </div>

        <dl className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
              Owner
            </dt>
            <dd className="font-bold">{request?.ownerName ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
              Requested
            </dt>
            <dd className="font-bold">{request?.requestedAt ?? "—"}</dd>
          </div>
          {feeConfig.enabled && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
                Payment Status
              </dt>
              <dd>
                <Badge variant={request?.payment?.status === "PAID" ? "success" : "default"}>
                  {request?.payment?.status === "PAID" ? "Paid" : "Unpaid"}
                </Badge>
              </dd>
            </div>
          )}
        </dl>

        <div>
          <Button
            variant="outline"
            icon={<ExternalLink />}
            onClick={openPdf}
            disabled={!documentId}
          >
            Open PDF
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-6 p-6 md:p-8">
        <h2 className="text-xl font-extrabold">Approval progress</h2>

        <div className="rounded-card border-2 border-navy/20 bg-cream/40 p-4 text-xs flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate uppercase tracking-wider">
              Linked Notary Wallet:
            </span>
            <span className="font-mono font-bold break-all">
              {user?.walletAddress ?? "No wallet linked"}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate uppercase tracking-wider">
              Connected MetaMask Account:
            </span>
            <span className="font-mono font-bold break-all">
              {connectedAccount ?? "Not connected"}
            </span>
          </div>
        </div>

        <div className="rounded-card border-2 border-navy/20 bg-cream/40 p-4 text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold uppercase tracking-wider text-slate">
            Estimated Notarization Gas:
          </span>
          <span className="font-mono font-bold text-navy">
            {estimatedGas} <span className="font-medium text-slate">(estimate)</span>
          </span>
        </div>

        {isMismatch && (
          <Alert variant="warning">
            <AlertTitle>Wallet mismatch</AlertTitle>
            <AlertDescription>
              The connected wallet ({connectedAccount}) does not match your linked notary wallet ({user?.walletAddress}). In MetaMask select the notary account, then try again.
            </AlertDescription>
          </Alert>
        )}

        {!walletLinked && (
          <Alert variant="warning">
            <AlertTitle>Wallet not linked</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>Link your notary wallet before you can approve requests.</span>
              {linkError && (
                <p className="font-bold text-danger">{linkError}</p>
              )}
              {linkSuccess && (
                <p className="font-bold text-green-700">Wallet linked successfully!</p>
              )}
              <Button
                type="button"
                variant="teal"
                size="sm"
                loading={linkingWallet}
                disabled={linkingWallet || linkSuccess}
                onClick={handleLinkWallet}
              >
                Connect &amp; Link MetaMask
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <ApprovalProgress
          state={approvalState}
          receipt={receipt}
          error={approvalError}
          errorVariant={approvalState === "rejected-by-user" ? "warning" : "error"}
        />

        {(() => {
          if (approvalState === "confirmed" || request?.status === "CONFIRMED") {
            return (
              <div className="flex flex-col gap-4">
                <Alert variant="success">
                  <AlertTitle>Notarization Confirmed on Blockchain</AlertTitle>
                  <AlertDescription>
                    This document has been successfully notarized on-chain with unique key{" "}
                    <span className="font-mono font-bold">
                      {receipt?.notarizationKey ?? "generated"}
                    </span>
                    . The document owner can now view and verify it in their account.
                  </AlertDescription>
                </Alert>

                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild size="lg" variant="primary">
                    <Link to="/notary/dashboard">
                      <ArrowLeft aria-hidden="true" />
                      Back to Notary Queue
                    </Link>
                  </Button>
                  {documentId && (
                    <Button asChild size="lg" variant="outline">
                      <Link to={`/documents/${documentId}`}>
                        <FileText aria-hidden="true" />
                        View Document Details
                      </Link>
                    </Button>
                  )}
                  {documentId && (
                    <Button asChild size="lg" variant="teal">
                      <Link to={`/documents/${documentId}/certificate`}>
                        <ScrollText aria-hidden="true" />
                        View Certificate
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          }

          const isPaid = request?.payment?.status === "PAID";
          const waitingForPayment = feeConfig.enabled && !isPaid;

          return (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="danger"
                size="lg"
                icon={<X />}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
              <Button
                size="lg"
                icon={<Check />}
                loading={["preparing", "awaiting-wallet", "pending", "verifying"].includes(
                  approvalState,
                )}
                disabled={
                  !walletLinked ||
                  isMismatch ||
                  waitingForPayment ||
                  ["preparing", "awaiting-wallet", "pending", "verifying"].includes(
                    approvalState,
                  )
                }
                onClick={handleApprove}
              >
                Approve & Notarize
              </Button>
              {waitingForPayment && (
                <span className="text-xs font-semibold text-danger">
                  Waiting for the user's fee payment
                </span>
              )}
            </div>
          );
        })()}
      </Card>

      <Modal
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject request"
        description="The owner receives the reason you give."
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rejection-reason">Reason (required)</Label>
            <Textarea
              id="rejection-reason"
              required
              aria-required="true"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this document cannot be notarized"
            />
          </div>

          {rejectError && (
            <Alert variant="error">
              <AlertTitle>Rejection failed</AlertTitle>
              <AlertDescription>{rejectError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={rejectLoading}
              disabled={!reason.trim() || rejectLoading}
              onClick={handleReject}
            >
              Reject request
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

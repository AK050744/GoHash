import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ClipboardCheck, ExternalLink, X } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { ApprovalProgress } from "@/components/notary/approval-progress";
import type {
  ApprovalState,
  PendingRequest,
  RequestReceipt,
} from "@/components/notary/types";
import { HashBlock } from "@/components/documents/hash-block";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
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
  document: { id: string; originalName: string; sha256Hash: string };
  owner: { name: string };
}

export default function RequestReview() {
  const { id = "" } = useParams();
  const { user, refreshUser } = useAuth();
  const { connectedAccount, isMismatch } = useConnectedWallet(user?.walletAddress);

  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [documentId, setDocumentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      const res = await api.get<{ success: true; notarization: ApiNotarization }>(
        `/notarization/${id}`,
      );
      const n = res.notarization;
      setRequest({
        id: n.id,
        documentName: n.document.originalName,
        hash: n.documentHash,
        ownerName: n.owner.name,
        requestedAt: new Date(n.createdAt).toLocaleDateString(),
      });
      setDocumentId(n.document.id);
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
      const iface = new ethers.Interface(approveRes.abi);
      const data = iface.encodeFunctionData(approveRes.method, [
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
            });
            setApprovalState("confirmed");
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
    } catch (err) {
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
          <Button asChild variant="outline">
            <Link to="/notary/dashboard">
              <ArrowLeft aria-hidden="true" />
              Back to requests
            </Link>
          </Button>
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

        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            size="lg"
            icon={<X />}
            onClick={() => setRejectOpen(true)}
            disabled={approvalState === "confirmed"}
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
              approvalState === "confirmed" ||
              ["preparing", "awaiting-wallet", "pending", "verifying"].includes(
                approvalState,
              )
            }
            onClick={handleApprove}
          >
            Approve
          </Button>
        </div>
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

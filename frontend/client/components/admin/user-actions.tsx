import { useEffect, useId, useState } from "react";

import { ApprovalProgress } from "@/components/notary/approval-progress";
import type { AccountStatus, ManagedUser, RequestReceipt } from "@/components/notary/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StepStatus } from "@/components/ui/stepper";
import type { AppRole } from "@/components/layout/site-nav";
import { api } from "@/lib/api";

const roles: AppRole[] = ["USER", "NOTARY", "ADMIN"];
const statuses: AccountStatus[] = ["ACTIVE", "SUSPENDED"];

interface RoleStatusModalProps {
  user: ManagedUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function RoleStatusModal({ user, open, onOpenChange, onSaved }: RoleStatusModalProps) {
  const [role, setRole] = useState<AppRole>(user.role);
  const [status, setStatus] = useState<AccountStatus>(user.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roleId = useId();
  const statusId = useId();

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (role !== user.role) {
        await api.patch(`/admin/users/${user.id}/role`, { role });
      }
      if (status !== user.status) {
        await api.patch(`/admin/users/${user.id}/status`, {
          isActive: status === "ACTIVE",
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit role and status"
      description={user.name}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor={roleId}>Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
            <SelectTrigger id={roleId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={statusId}>Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as AccountStatus)}
          >
            <SelectTrigger id={statusId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <Alert variant="error">
            <AlertTitle>Save failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={saving}
            onClick={handleSave}
          >
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface ChainActionModalProps {
  user: ManagedUser;
  action: "Authorize" | "Revoke";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function ChainActionModal({ user, action, open, onOpenChange, onSaved }: ChainActionModalProps) {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([
    "pending",
    "pending",
    "pending",
    "pending",
  ]);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState<string | undefined>(undefined);
  const [errorVariant, setErrorVariant] = useState<"error" | "warning">("error");
  const [receipt, setReceipt] = useState<RequestReceipt | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setError(null);
    setErrorTitle(undefined);
    setErrorVariant("error");
    setReceipt(null);
    setRunning(false);
    setStepStatuses(["pending", "pending", "pending", "pending"]);
  }, [open, action, user.id]);

  const targetAddress = user.walletAddress?.trim() ?? "";

  const handleAction = async () => {
    setRunning(true);
    setError(null);
    setErrorTitle(undefined);
    setErrorVariant("error");
    setReceipt(null);

    // Step 0: Prepare request & run ALL preconditions before stepper moves forward
    setStepStatuses(["active", "pending", "pending", "pending"]);

    // Precondition 1: Target address
    if (!targetAddress || !/^0x[a-fA-F0-9]{40}$/i.test(targetAddress)) {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError(
        "Cannot start: This notary has no linked wallet. This notary must link a wallet first (Profile > Link wallet)."
      );
      setRunning(false);
      return;
    }

    // Precondition 2: MetaMask available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError("Cannot start: MetaMask not found. Please install MetaMask to continue.");
      setRunning(false);
      return;
    }

    // Precondition 3: Connected account
    let accounts: string[] = [];
    try {
      accounts = await ethereum.request({ method: "eth_requestAccounts" });
    } catch {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError("Cannot start: Please connect your MetaMask wallet to perform this action.");
      setRunning(false);
      return;
    }

    const connectedAdmin = accounts[0]?.toLowerCase();
    if (!connectedAdmin) {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError("Cannot start: No active account found in MetaMask.");
      setRunning(false);
      return;
    }

    // Precondition 4: Smart contract metadata
    let contractRes: {
      success: true;
      contractAddress: string;
      chainId: number;
      abi: string[];
    };
    try {
      contractRes = await api.get<{
        success: true;
        contractAddress: string;
        chainId: number;
        abi: string[];
      }>("/blockchain/contract");
    } catch (err) {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError(
        `Cannot start: Failed to fetch smart contract details (${
          err instanceof Error ? err.message : "Network error"
        }).`
      );
      setRunning(false);
      return;
    }

    // Precondition 5: Network check
    try {
      const currentChainId = await ethereum.request({ method: "eth_chainId" });
      const expectedHexChainId = "0x" + Number(contractRes.chainId).toString(16);
      if (parseInt(currentChainId, 16) !== contractRes.chainId) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: expectedHexChainId }],
          });
        } catch (switchErr: any) {
          if (switchErr?.code === 4902 || switchErr?.message?.includes("Unrecognized chain ID")) {
            try {
              await ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: expectedHexChainId,
                    chainName: "Hardhat Local",
                    rpcUrls: [import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545"],
                    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
                  },
                ],
              });
            } catch {
              setStepStatuses(["failed", "pending", "pending", "pending"]);
              setErrorTitle("Cannot start");
              setError("Cannot start: Please add and switch MetaMask to the expected network.");
              setRunning(false);
              return;
            }
          } else {
            setStepStatuses(["failed", "pending", "pending", "pending"]);
            setErrorTitle("Cannot start");
            setError("Cannot start: Please switch MetaMask to the expected network.");
            setRunning(false);
            return;
          }
        }
      }
    } catch {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError("Cannot start: Failed to verify network with MetaMask.");
      setRunning(false);
      return;
    }

    // Precondition 6: Contract owner & Notary state on-chain
    const { ethers } = await import("ethers");
    const provider = new ethers.BrowserProvider(ethereum);
    const contract = new ethers.Contract(contractRes.contractAddress, contractRes.abi, provider);

    let ownerAddress: string;
    try {
      ownerAddress = await contract.contractOwner();
    } catch {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError("Cannot start: Failed to query contract owner from the blockchain.");
      setRunning(false);
      return;
    }

    if (ownerAddress.toLowerCase() !== connectedAdmin) {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError(
        "Cannot start: Connected wallet is not the contract owner. Only the deployer account can authorize or revoke notaries."
      );
      setRunning(false);
      return;
    }

    let isAlreadyNotary = false;
    try {
      isAlreadyNotary = await contract.isNotary(targetAddress);
    } catch {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError("Cannot start: Failed to verify notary status on the smart contract.");
      setRunning(false);
      return;
    }

    if (action === "Authorize" && isAlreadyNotary) {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError("Cannot start: This notary wallet is already authorized on the smart contract.");
      setRunning(false);
      return;
    }

    if (action === "Revoke" && !isAlreadyNotary) {
      setStepStatuses(["failed", "pending", "pending", "pending"]);
      setErrorTitle("Cannot start");
      setError("Cannot start: This notary wallet is not currently authorized on the smart contract.");
      setRunning(false);
      return;
    }

    // ── All preconditions passed! Step 0 DONE, Step 1 (Sign in wallet) ACTIVE ──
    setStepStatuses(["done", "active", "pending", "pending"]);

    let tx;
    try {
      const signer = await provider.getSigner();
      const contractWithSigner = new ethers.Contract(
        contractRes.contractAddress,
        contractRes.abi,
        signer
      );

      if (action === "Authorize") {
        tx = await contractWithSigner.addNotary(targetAddress);
      } else {
        tx = await contractWithSigner.removeNotary(targetAddress);
      }
    } catch (err: unknown) {
      const ethErr = err as { code?: number | string; message?: string; reason?: string };
      const rawMsg = (ethErr.message || ethErr.reason || String(err)).toLowerCase();
      setRunning(false);

      if (
        ethErr.code === 4001 ||
        ethErr.code === "ACTION_REJECTED" ||
        rawMsg.includes("user rejected") ||
        rawMsg.includes("rejected") ||
        rawMsg.includes("denied")
      ) {
        setStepStatuses(["done", "failed", "pending", "pending"]);
        setErrorTitle("Rejected in wallet");
        setError("Transaction was rejected in MetaMask.");
        setErrorVariant("warning");
        return;
      }

      setStepStatuses(["done", "failed", "pending", "pending"]);
      setErrorTitle("Wallet signing failed");
      setError(ethErr.message || "Failed to sign transaction in MetaMask.");
      return;
    }

    // ── Step 1 DONE only after MetaMask returns a transaction! Step 2 ACTIVE ──
    setStepStatuses(["done", "done", "active", "pending"]);

    // Await mining confirmation
    let receiptObj;
    try {
      receiptObj = await tx.wait(1);
    } catch {
      setStepStatuses(["done", "done", "failed", "pending"]);
      setErrorTitle("Transaction failed");
      setError("Transaction failed on the blockchain.");
      setRunning(false);
      return;
    }

    if (!receiptObj || receiptObj.status === 0) {
      setStepStatuses(["done", "done", "failed", "pending"]);
      setErrorTitle("Transaction failed");
      setError("Transaction was reverted on the blockchain.");
      setRunning(false);
      return;
    }

    // ── Step 2 DONE only after mined! Step 3 (Verify receipt) ACTIVE ──
    setStepStatuses(["done", "done", "done", "active"]);

    // Backend refresh
    try {
      await onSaved();
    } catch {
      // Refresh completed
    }

    // ── Step 3 DONE only after backend refresh! All steps complete ──
    setStepStatuses(["done", "done", "done", "done"]);
    setReceipt({
      transactionHash: tx.hash,
      blockNumber: String(receiptObj.blockNumber),
      contractAddress: contractRes.contractAddress,
    });
    setRunning(false);
  };

  const isCompleted =
    stepStatuses[0] === "done" &&
    stepStatuses[1] === "done" &&
    stepStatuses[2] === "done" &&
    stepStatuses[3] === "done";

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!running) onOpenChange(next);
      }}
      title={`${action} notary on-chain`}
      description={user.name}
    >
      <div className="flex flex-col gap-6">
        <ApprovalProgress
          state={isCompleted ? "confirmed" : "idle"}
          receipt={receipt}
          stepStatuses={stepStatuses}
          error={error}
          errorTitle={errorTitle}
          errorVariant={errorVariant}
        />

        <div className="rounded-card border-2 border-navy/20 bg-cream/40 p-3 text-xs flex flex-col gap-1.5">
          <div>
            <span className="font-bold text-slate">Notary: </span>
            <span className="font-bold">{user.name} ({user.email})</span>
          </div>
          <div>
            <span className="font-bold text-slate">Target wallet: </span>
            <span className="font-mono font-bold break-all">
              {user.walletAddress ?? "No wallet linked"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={running}
            onClick={() => onOpenChange(false)}
          >
            {isCompleted ? "Close" : "Cancel"}
          </Button>
          {!isCompleted && (
            <Button
              type="button"
              variant={action === "Revoke" ? "danger" : "primary"}
              loading={running}
              disabled={running}
              onClick={handleAction}
            >
              {action}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export interface UserActionsProps {
  user: ManagedUser;
  isSelf: boolean;
  onChanged?: () => void;
}

function UserActions({ user, isSelf, onChanged }: UserActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const [modalAction, setModalAction] = useState<"Authorize" | "Revoke">("Authorize");

  const isNotary = user.role === "NOTARY";
  const hasWallet = Boolean(user.walletAddress);
  const onChainAuthorized = user.onChain === "AUTHORIZED";

  const handleOpenChain = (action: "Authorize" | "Revoke") => {
    setModalAction(action);
    setChainOpen(true);
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isSelf}
          onClick={() => setEditOpen(true)}
        >
          Edit role and status
        </Button>
        {isNotary && (
          <>
            <Button
              variant="primary"
              size="sm"
              disabled={isSelf || !hasWallet || onChainAuthorized}
              onClick={() => handleOpenChain("Authorize")}
              title={
                !hasWallet
                  ? "This notary must link a wallet first (Profile > Link wallet)."
                  : onChainAuthorized
                    ? "This notary is already authorized on-chain."
                    : "Authorize notary on-chain"
              }
            >
              Authorize
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isSelf || !hasWallet || !onChainAuthorized}
              onClick={() => handleOpenChain("Revoke")}
              title={
                !hasWallet
                  ? "This notary must link a wallet first (Profile > Link wallet)."
                  : !onChainAuthorized
                    ? "This notary is not currently authorized on-chain."
                    : "Revoke notary on-chain"
              }
            >
              Revoke
            </Button>
          </>
        )}
      </div>

      {isNotary && !hasWallet && (
        <p className="text-xs font-semibold text-danger">
          This notary must link a wallet first (Profile &gt; Link wallet).
        </p>
      )}

      {isSelf && (
        <p className="text-xs font-bold text-slate">
          You cannot modify your own account.
        </p>
      )}

      <RoleStatusModal
        user={user}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => onChanged?.()}
      />
      <ChainActionModal
        user={user}
        action={modalAction}
        open={chainOpen}
        onOpenChange={setChainOpen}
        onSaved={() => onChanged?.()}
      />
    </div>
  );
}

export { UserActions };

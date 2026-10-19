import { useId, useState } from "react";

import { ApprovalProgress } from "@/components/notary/approval-progress";
import type { AccountStatus, ManagedUser, ApprovalState } from "@/components/notary/types";
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
      // Patch role if changed
      if (role !== user.role) {
        await api.patch(`/admin/users/${user.id}/role`, { role });
      }
      // Patch status if changed
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
  const [approvalState, setApprovalState] = useState<ApprovalState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    setApprovalState("preparing");
    setError(null);
    try {
      // Get contract info
      const contractRes = await api.get<{
        success: true;
        contractAddress: string;
        chainId: number;
        abi: string[];
      }>("/blockchain/contract");

      setApprovalState("awaiting-wallet");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("MetaMask not found.");

      if (!user.walletAddress) {
        throw new Error("This user has not linked a wallet address yet. Only users with a linked wallet can be authorized or revoked on-chain.");
      }

      const { ethers } = await import("ethers");
      const iface = new ethers.Interface(contractRes.abi);
      const methodName = action === "Authorize" ? "addNotary" : "removeNotary";
      const data = iface.encodeFunctionData(methodName, [user.walletAddress]);

      const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
      await ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: accounts[0], to: contractRes.contractAddress, data }],
      });

      setApprovalState("confirmed");
      setTimeout(() => {
        onOpenChange(false);
        onSaved();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      if (message.includes("user rejected") || message.toLowerCase().includes("denied")) {
        setApprovalState("rejected-by-user");
      } else {
        setApprovalState("failed");
        setError(message);
      }
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`${action} notary on-chain`}
      description={user.name}
    >
      <div className="flex flex-col gap-6">
        <ApprovalProgress state={approvalState} />

        {error && (
          <Alert variant="error">
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={action === "Revoke" ? "danger" : "primary"}
            loading={["preparing", "awaiting-wallet"].includes(approvalState)}
            disabled={["preparing", "awaiting-wallet", "confirmed"].includes(
              approvalState,
            )}
            onClick={handleAction}
          >
            {action}
          </Button>
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
  const chainAction = user.onChain === "AUTHORIZED" ? "Revoke" : "Authorize";

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isSelf}
          onClick={() => setEditOpen(true)}
        >
          Edit role and status
        </Button>
        <Button
          variant={chainAction === "Revoke" ? "danger" : "primary"}
          size="sm"
          disabled={isSelf}
          onClick={() => setChainOpen(true)}
        >
          {chainAction}
        </Button>
      </div>
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
        action={chainAction}
        open={chainOpen}
        onOpenChange={setChainOpen}
        onSaved={() => onChanged?.()}
      />
    </div>
  );
}

export { UserActions };

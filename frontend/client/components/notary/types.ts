export type ApprovalState =
  | "idle"
  | "preparing"
  | "awaiting-wallet"
  | "pending"
  | "verifying"
  | "confirmed"
  | "failed"
  | "rejected-by-user";

export interface PendingRequest {
  id: string;
  documentName: string;
  ownerName: string;
  hash: string;
  requestedAt: string;
  payment?: {
    status: string;
    amountWei?: string;
    transactionHash?: string;
    refundDue?: boolean;
  } | null;
}

export interface RequestReceipt {
  transactionHash: string;
  blockNumber: string;
  contractAddress: string;
  notarizationKey?: string;
}

export type OnChainAuthorization = "AUTHORIZED" | "NOT_AUTHORIZED" | "UNKNOWN";

export type AccountStatus = "ACTIVE" | "SUSPENDED";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "NOTARY" | "ADMIN";
  status: AccountStatus;
  onChain: OnChainAuthorization;
  walletAddress?: string | null;
}

export interface ActivityEntry {
  id: string;
  action: string;
  actor: string;
  occurredAt: string;
}

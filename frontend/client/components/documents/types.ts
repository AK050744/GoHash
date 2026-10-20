import type { NotaryStatus } from "@/components/ui/status-badge";

export interface DocumentSummary {
  id: string;
  name: string;
  hash: string;
  status: NotaryStatus;
  createdAt: string;
}

export interface DocumentPayment {
  status: string;
  amountWei?: string;
  transactionHash?: string;
  paidAt?: string;
  refundDue?: boolean;
}

export interface DocumentDetail extends DocumentSummary {
  notary?: string;
  recordedAt?: string;
  transactionHash?: string;
  blockNumber?: string;
  contractAddress?: string;
  notarizationKey?: string;
  notarizationId?: string;
  notarizationStatus?: string;
  rejectionReason?: string | null;
  payment?: DocumentPayment | null;
}

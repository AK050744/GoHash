import type { NotaryStatus } from "@/components/ui/status-badge";

export interface DocumentSummary {
  id: string;
  name: string;
  hash: string;
  status: NotaryStatus;
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  notary?: string;
  recordedAt?: string;
  transactionHash?: string;
  blockNumber?: string;
  contractAddress?: string;
}

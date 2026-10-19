import { CircleCheck } from "lucide-react";

import { HashBlock } from "@/components/documents/hash-block";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";
import { Stepper, type StepStatus, type StepperStep } from "@/components/ui/stepper";
import type { ApprovalState, RequestReceipt } from "@/components/notary/types";

const stepLabels = [
  "Prepare request",
  "Sign in wallet",
  "Record on-chain",
  "Verify receipt",
];

const stepStatusByState: Record<ApprovalState, StepStatus[]> = {
  idle: ["pending", "pending", "pending", "pending"],
  preparing: ["active", "pending", "pending", "pending"],
  "awaiting-wallet": ["done", "active", "pending", "pending"],
  pending: ["done", "done", "active", "pending"],
  verifying: ["done", "done", "done", "active"],
  confirmed: ["done", "done", "done", "done"],
  failed: ["done", "done", "failed", "pending"],
  "rejected-by-user": ["done", "failed", "pending", "pending"],
};

const statusAlertByState: Partial<
  Record<
    ApprovalState,
    {
      variant: "info" | "success" | "warning" | "error";
      title: string;
      description: string;
    }
  >
> = {
  preparing: {
    variant: "info",
    title: "Preparing request",
    description: "Checking the request before it goes to your wallet.",
  },
  "awaiting-wallet": {
    variant: "info",
    title: "Waiting for your wallet",
    description: "Confirm the transaction in your wallet to continue.",
  },
  pending: {
    variant: "info",
    title: "Transaction submitted",
    description: "Waiting for the network to confirm the transaction.",
  },
  verifying: {
    variant: "info",
    title: "Verifying receipt",
    description: "Checking the on-chain receipt.",
  },
  confirmed: {
    variant: "success",
    title: "Notarization recorded",
    description: "The transaction is confirmed on-chain.",
  },
  failed: {
    variant: "error",
    title: "Transaction failed",
    description: "Nothing was recorded on-chain. Try again.",
  },
  "rejected-by-user": {
    variant: "warning",
    title: "Rejected in wallet",
    description: "The transaction was declined in your wallet. Nothing was recorded.",
  },
};

export interface ApprovalProgressProps {
  state: ApprovalState;
  receipt?: RequestReceipt | null;
}

function ApprovalProgress({ state, receipt }: ApprovalProgressProps) {
  const steps: StepperStep[] = stepLabels.map((label, index) => ({
    label,
    status: stepStatusByState[state][index],
  }));
  const statusAlert = statusAlertByState[state];

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={steps} />

      <div aria-live="polite" className="flex flex-col gap-4">
        {statusAlert && (
          <Alert variant={statusAlert.variant}>
            <AlertTitle>{statusAlert.title}</AlertTitle>
            <AlertDescription>{statusAlert.description}</AlertDescription>
          </Alert>
        )}

        {state === "confirmed" && (
          <div className="brut-border flex flex-col gap-5 rounded-card bg-white p-5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="brut-border flex size-10 items-center justify-center rounded-input bg-green"
              >
                <CircleCheck className="size-5" />
              </span>
              <p className="font-extrabold">Receipt</p>
            </div>
            <dl className="grid gap-5 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2 md:col-span-2">
                <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
                  Transaction hash
                </dt>
                <dd>
                  {receipt ? (
                    <HashBlock value={receipt.transactionHash} label="transaction hash" />
                  ) : (
                    <span className="font-bold text-slate">—</span>
                  )}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
                  Block number
                </dt>
                <dd className="flex min-w-0 items-start gap-3">
                  <span className="font-bold">{receipt?.blockNumber ?? "—"}</span>
                  {receipt && (
                    <CopyButton value={receipt.blockNumber} label="block number" className="shrink-0" />
                  )}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-2 md:col-span-2">
                <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
                  Contract address
                </dt>
                <dd>
                  {receipt ? (
                    <HashBlock value={receipt.contractAddress} label="contract address" />
                  ) : (
                    <span className="font-bold text-slate">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

export { ApprovalProgress };

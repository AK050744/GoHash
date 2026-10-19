import { CircleCheck, X } from "lucide-react";

import { HashBlock } from "@/components/documents/hash-block";
import { CopyButton } from "@/components/ui/copy-button";

export interface VerifiedRecord {
  documentName: string;
  hash: string;
  notary: string;
  recordedAt: string;
  transactionHash: string;
  blockNumber: string;
  contractAddress: string;
}

export type VerifyOutcome =
  | { kind: "verified"; record: VerifiedRecord }
  | { kind: "not-verified"; computedHash: string };

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function DetailRow({ label, value, mono = false }: DetailRowProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <dt className="text-xs font-bold tracking-[0.12em] uppercase">{label}</dt>
      <dd className="flex min-w-0 items-start gap-3">
        <span
          className={
            mono
              ? "brut-border min-w-0 flex-1 rounded-input bg-white px-3 py-2 font-mono text-sm break-all"
              : "min-w-0 flex-1 font-bold break-words"
          }
        >
          {value}
        </span>
        <CopyButton value={value} label={label.toLowerCase()} className="shrink-0" />
      </dd>
    </div>
  );
}

export interface VerifyResultProps {
  outcome: VerifyOutcome;
}

function VerifyResult({ outcome }: VerifyResultProps) {
  if (outcome.kind === "verified") {
    const { record } = outcome;
    return (
      <section
        aria-labelledby="verify-result-heading"
        className="shadow-hard flex flex-col gap-6 rounded-card border-[4px] border-navy bg-green p-6 text-navy md:p-8"
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
          <span
            aria-hidden="true"
            className="flex size-20 shrink-0 items-center justify-center rounded-card border-[2.5px] border-navy bg-white animate-stamp motion-reduce:animate-none"
          >
            <CircleCheck className="size-12" strokeWidth={2.5} />
          </span>
          <h2
            id="verify-result-heading"
            className="text-3xl font-extrabold tracking-tight"
          >
            VERIFIED
          </h2>
        </div>
        <p className="font-bold">This document matches a notarized record.</p>
        <dl className="grid gap-6 md:grid-cols-2">
          <DetailRow label="Document" value={record.documentName} />
          <DetailRow label="SHA-256 fingerprint" value={record.hash} mono />
          <DetailRow label="Notary wallet" value={record.notary} mono />
          <DetailRow label="Recorded on-chain" value={record.recordedAt} />
          <DetailRow label="Transaction hash" value={record.transactionHash} mono />
          <DetailRow label="Block number" value={record.blockNumber} />
          <div className="md:col-span-2">
            <DetailRow label="Contract address" value={record.contractAddress} mono />
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="verify-result-heading"
      className="shadow-hard flex flex-col gap-6 rounded-card border-[4px] border-navy bg-danger p-6 text-white md:p-8"
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
        <span
          aria-hidden="true"
          className="flex size-20 shrink-0 items-center justify-center rounded-card border-[2.5px] border-navy bg-white text-danger animate-stamp motion-reduce:animate-none"
        >
          <X className="size-12" strokeWidth={3} />
        </span>
        <h2
          id="verify-result-heading"
          className="text-3xl leading-tight font-extrabold tracking-tight text-white"
        >
          TAMPERED / VERIFICATION FAILED
        </h2>
      </div>
      <p className="font-medium">
        The fingerprint of this file does not match any notarized record. The
        file may have changed after it was notarized, or it was never
        notarized.
      </p>
      <div className="flex flex-col gap-3 rounded-card border-[2.5px] border-navy bg-white p-4 text-navy">
        <p className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
          Computed hash
        </p>
        <HashBlock value={outcome.computedHash} label="computed hash" />
      </div>
    </section>
  );
}

export { VerifyResult };

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";

import { DecorIcon } from "@/components/decor";
import { BrandMark } from "@/components/layout/brand-mark";
import type { DocumentDetail } from "@/components/documents/types";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";
import { shortenHash } from "@/components/documents/hash-block";
import { formatEther } from "ethers";

interface CertificateFieldProps {
  label: string;
  value?: string;
  mono?: boolean;
  withCopy?: boolean;
}

function CertificateField({ label, value, mono = false, withCopy = false }: CertificateFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase print:text-black">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "flex items-center gap-2 font-mono text-sm break-all"
            : "flex items-center gap-2 font-bold break-words"
        }
      >
        <span>{value ?? "—"}</span>
        {withCopy && value && (
          <CopyButton
            value={value}
            label={label.toLowerCase()}
            className="shrink-0 print:hidden"
          />
        )}
      </dd>
    </div>
  );
}

interface ApiDoc {
  id: string;
  originalName: string;
  sha256Hash: string;
  status: DocumentDetail["status"];
  createdAt?: string;
  notarization?: {
    id: string;
    status: string;
    transactionHash?: string;
    blockNumber?: number;
    notaryWallet?: string;
    contractAddress?: string;
    notarizationKey?: string;
    timestamp?: number;
    rejectionReason?: string | null;
    payment?: {
      status: string;
      amountWei?: string;
      transactionHash?: string;
      paidAt?: string;
      refundDue?: boolean;
    } | null;
  } | null;
}

export default function Certificate() {
  const { id = "" } = useParams();
  const [record, setRecord] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: true; document: ApiDoc }>(
        `/documents/${id}`,
      );
      const d = res.document;
      const n = d.notarization;
      setRecord({
        id: d.id,
        name: d.originalName,
        hash: d.sha256Hash,
        status: d.status,
        createdAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "",
        recordedAt: n?.timestamp
          ? new Date(n.timestamp * 1000).toLocaleString()
          : undefined,
        notary: n?.notaryWallet ?? undefined,
        blockNumber: n?.blockNumber !== undefined ? String(n.blockNumber) : undefined,
        transactionHash: n?.transactionHash ?? undefined,
        contractAddress: n?.contractAddress ?? undefined,
        notarizationKey: n?.notarizationKey ?? undefined,
        payment: n?.payment ?? undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document certificate");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-dvh bg-cream px-4 py-8 md:px-8 md:py-12 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-6 print:max-w-none print:gap-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="outline">
            <Link to={`/documents/${id}`}>
              <ArrowLeft aria-hidden="true" />
              Back to document
            </Link>
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={<Printer />}
            onClick={() => window.print()}
            disabled={loading || !!error}
          >
            Print certificate
          </Button>
        </div>

        {error && (
          <Alert variant="error" className="print:hidden">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <article
          aria-labelledby="certificate-title"
          className="brut-border shadow-hard-lg flex flex-col gap-8 rounded-card bg-white p-8 md:p-12 print:shadow-none print:rounded-none print:border-[1px] print:p-0"
        >
          <header className="flex flex-wrap items-start justify-between gap-6 border-b-[2.5px] border-navy pb-6 print:border-black">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <BrandMark />
                <span className="text-2xl font-extrabold tracking-tight text-navy print:text-black">
                  Go
                  <span className="ml-0.5 rounded-lg bg-navy px-1.5 text-yellow print:bg-transparent print:text-black">
                    Hash
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-bold tracking-[0.14em] text-slate uppercase print:text-black">
                  Certificate of notarization
                </p>
                <h1
                  id="certificate-title"
                  className="text-3xl leading-tight font-extrabold print:text-black"
                >
                  Document notarization record
                </h1>
              </div>
            </div>
            <DecorIcon
              shape="stamp"
              className="size-28 -rotate-6 print:grayscale print:animate-none"
            />
          </header>

          {loading ? (
            <div className="py-12 text-center text-slate font-bold">
              Loading certificate...
            </div>
          ) : (
            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <CertificateField label="Reference" value={id} mono />
              <CertificateField label="Document" value={record?.name} />
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase print:text-black">
                  Status
                </dt>
                <dd>
                  {record ? (
                    <StatusBadge status={record.status} />
                  ) : (
                    <span className="font-bold">—</span>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <CertificateField label="SHA-256 fingerprint" value={record?.hash} mono />
              </div>
              <CertificateField label="Notary wallet" value={record?.notary} mono />
              <CertificateField label="Recorded on-chain" value={record?.recordedAt} />
              <CertificateField label="Transaction hash" value={record?.transactionHash} mono />
              <CertificateField label="Block number" value={record?.blockNumber} />
              {record?.notarizationKey && (
                <div className="sm:col-span-2">
                  <CertificateField
                    label="Unique Notarization Key"
                    value={record.notarizationKey}
                    mono
                    withCopy
                  />
                </div>
              )}
              {record?.payment?.transactionHash && (
                <div className="sm:col-span-2">
                  <CertificateField
                    label="Notarization fee"
                    value={`Fee paid: ${formatEther(record.payment.amountWei ?? "0")} ETH (tx ${shortenHash(record.payment.transactionHash)})`}
                    mono
                  />
                </div>
              )}
              <div className="sm:col-span-2">
                <CertificateField label="Contract address" value={record?.contractAddress} mono />
              </div>
            </dl>
          )}

          <footer className="mt-auto border-t-[2.5px] border-navy pt-4 text-sm font-medium text-slate print:border-black print:text-black">
            This certificate summarizes the notarization record for the document
            identified above.
          </footer>
        </article>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Clock,
  ExternalLink,
  FileText,
  ScrollText,
  Send,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { HashBlock } from "@/components/documents/hash-block";
import type { DocumentDetail } from "@/components/documents/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const TOKEN_KEY = "gohash_token";

interface RecordFieldProps {
  label: string;
  value?: string;
}

function RecordField({ label, value }: RecordFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <dt className="text-xs font-bold tracking-[0.12em] text-slate uppercase">
        {label}
      </dt>
      <dd className="flex min-w-0 items-start gap-3">
        {value ? (
          <>
            <code className="brut-border min-w-0 flex-1 rounded-input bg-cream px-3 py-2 font-mono text-sm break-all whitespace-normal">
              {value}
            </code>
            <CopyButton
              value={value}
              label={label.toLowerCase()}
              className="shrink-0"
            />
          </>
        ) : (
          <span className="font-bold text-slate">—</span>
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
  ownerId: string;
  createdAt?: string;
  notarization?: {
    id: string;
    status: string;
    transactionHash?: string;
    blockNumber?: number;
    notaryWallet?: string;
    contractAddress?: string;
    timestamp?: number;
    rejectionReason?: string | null;
  } | null;
}

export default function DocumentDetails() {
  const { id = "" } = useParams();
  const { user } = useAuth();

  const [record, setRecord] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const walletLinked = !!user?.walletAddress;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
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
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRequestNotarization = async () => {
    setRequestLoading(true);
    setRequestError(null);
    try {
      await api.post("/notarization/request", { documentId: id });
      setRequestSuccess(true);
      await load(); // refresh
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRequestLoading(false);
    }
  };

  const openPdf = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    window.open(`${BASE}/documents/${id}/file?token=${token}`, "_blank");
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
        icon={<FileText />}
        title={record?.name ?? "Document details"}
        subtitle={`Reference ${id}`}
        actions={record && <StatusBadge status={record.status} />}
      />

      {loadError && (
        <Alert variant="error">
          <AlertTitle>Could not load document</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {requestSuccess && (
        <Alert variant="success">
          <AlertTitle>Notarization requested</AlertTitle>
          <AlertDescription>
            A notary will review your document shortly.
          </AlertDescription>
        </Alert>
      )}

      {requestError && (
        <Alert variant="error">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold tracking-[0.14em] text-slate uppercase">
            SHA-256 fingerprint
          </p>
          {record ? (
            <HashBlock value={record.hash} label="document hash" />
          ) : (
            <span className="font-bold text-slate">—</span>
          )}
        </div>

        {!walletLinked && (
          <Alert variant="warning">
            <AlertTitle>Wallet not linked</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>Link a wallet before you request notarization.</span>
              <Button asChild variant="outline" size="sm">
                <Link to="/profile">Open profile</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            icon={<Send />}
            loading={requestLoading}
            disabled={
              !record ||
              record.status !== "PENDING" ||
              !walletLinked ||
              requestLoading ||
              requestSuccess
            }
            onClick={handleRequestNotarization}
          >
            Request Notarization
          </Button>
          <Button
            variant="outline"
            size="lg"
            icon={<ExternalLink />}
            onClick={openPdf}
            disabled={!record}
          >
            Open PDF
          </Button>
          <Button asChild variant="teal" size="lg">
            <Link to={`/documents/${id}/certificate`}>
              <ScrollText aria-hidden="true" />
              View certificate
            </Link>
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="brut-border flex size-12 items-center justify-center rounded-input bg-green"
          >
            <Clock className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold">Notarization record</h2>
            <p className="font-bold">
              Recorded on-chain at {record?.recordedAt ?? "—"}
            </p>
          </div>
        </div>

        <dl className="grid gap-6 md:grid-cols-2">
          <RecordField label="Notary wallet" value={record?.notary} />
          <RecordField label="Block number" value={record?.blockNumber} />
          <RecordField label="Transaction hash" value={record?.transactionHash} />
          <RecordField label="Contract address" value={record?.contractAddress} />
        </dl>
      </Card>
    </PageContainer>
  );
}

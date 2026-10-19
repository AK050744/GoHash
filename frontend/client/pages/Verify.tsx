import { useState } from "react";
import { FileText, ShieldCheck, X } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { DropZone } from "@/components/documents/drop-zone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  VerifyResult,
  type VerifyOutcome,
} from "@/components/verify/verify-result";
import { api } from "@/lib/api";

export default function Verify() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setOutcome(null);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", selectedFile);

      const res = await api.postForm<{
        success: true;
        status: "VERIFIED" | "NOT_VERIFIED";
        hash: string;
        record?: {
          ownerWallet: string;
          notaryWallet: string;
          timestamp: number;
          contractAddress: string;
          transactionHash: string;
          blockNumber: number;
        };
        document?: { id: string; originalName: string };
        message?: string;
      }>("/verify", form);

      if (res.status === "VERIFIED" && res.record) {
        setOutcome({
          kind: "verified",
          record: {
            documentName: res.document?.originalName ?? "Unknown document",
            hash: res.hash,
            notary: res.record.notaryWallet,
            recordedAt: new Date(res.record.timestamp * 1000).toLocaleString(),
            contractAddress: res.record.contractAddress,
            transactionHash: res.record.transactionHash,
            blockNumber: String(res.record.blockNumber),
          },
        });
      } else {
        setOutcome({
          kind: "not-verified",
          computedHash: res.hash,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="pt-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <PageHeader
          icon={<ShieldCheck />}
          title="Verify"
          subtitle="Check whether a file matches a notarized record."
        />

        <Card className="flex flex-col gap-6 p-6 md:p-8">
          <DropZone
            inputId="verify-file"
            title="Drop a document to verify"
            description="Select the file you want to check against its notarized record."
            onFileSelect={(file) => {
              setSelectedFile(file ?? null);
              setOutcome(null);
              setError(null);
            }}
          />

          {selectedFile && (
            <div className="brut-border shadow-hard-sm flex flex-wrap items-center gap-3 self-start rounded-full bg-white py-1.5 pr-1.5 pl-4">
              <FileText className="size-5 shrink-0" aria-hidden="true" />
              <span className="font-bold break-all">{selectedFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove selected file"
                onClick={() => {
                  setSelectedFile(null);
                  setOutcome(null);
                  setError(null);
                }}
              >
                <X />
              </Button>
            </div>
          )}

          {error && (
            <Alert variant="error">
              <AlertTitle>Verification error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Button
              size="lg"
              icon={<ShieldCheck />}
              loading={loading}
              disabled={!selectedFile || loading}
              onClick={handleVerify}
            >
              Verify document
            </Button>
          </div>
        </Card>

        <div aria-live="polite">
          {outcome && <VerifyResult outcome={outcome} />}
        </div>
      </div>
    </PageContainer>
  );
}

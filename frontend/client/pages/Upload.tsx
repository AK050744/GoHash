import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  CircleCheck,
  FileText,
  Send,
  Sparkles,
  Upload as UploadIcon,
  X,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { DropZone } from "@/components/documents/drop-zone";
import { HashBlock } from "@/components/documents/hash-block";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

type UploadStatus =
  | { kind: "idle" }
  | { kind: "selected"; file: File }
  | { kind: "uploading"; progress: number }
  | { kind: "success"; hash: string; documentId: string }
  | { kind: "error"; message: string };

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Upload() {
  const [status, setStatus] = useState<UploadStatus>({ kind: "idle" });
  const [autoRequestNotary, setAutoRequestNotary] = useState(true);
  const [notaryRequested, setNotaryRequested] = useState(false);
  const [requestingNotary, setRequestingNotary] = useState(false);
  const [notaryError, setNotaryError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const selectedFile = status.kind === "selected" ? status.file : null;

  const selectFile = (file: File | undefined) => {
    if (file) {
      setStatus({ kind: "selected", file });
      setNotaryRequested(false);
      setNotaryError(null);
    }
  };

  const clearFile = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setStatus({ kind: "idle" });
    setNotaryRequested(false);
    setNotaryError(null);
  };

  const handleUpload = async () => {
    if (status.kind !== "selected") return;
    const file = status.file;

    setStatus({ kind: "uploading", progress: 30 });
    setNotaryError(null);

    try {
      const form = new FormData();
      form.append("file", file);

      setStatus({ kind: "uploading", progress: 60 });

      const res = await api.postForm<{
        success: true;
        document: { id: string; sha256Hash: string };
      }>("/documents/upload", form);

      let requested = false;
      let reqError: string | null = null;

      // Automatically request notarization if enabled
      if (autoRequestNotary) {
        setStatus({ kind: "uploading", progress: 85 });
        try {
          await api.post("/notarization/request", {
            documentId: res.document.id,
          });
          requested = true;
        } catch (err) {
          reqError =
            err instanceof Error
              ? err.message
              : "Uploaded document, but could not automatically request notary.";
        }
      }

      setNotaryRequested(requested);
      setNotaryError(reqError);

      setStatus({
        kind: "success",
        hash: res.document.sha256Hash,
        documentId: res.document.id,
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  };

  const handleManualRequestNotary = async (documentId: string) => {
    setRequestingNotary(true);
    setNotaryError(null);
    try {
      await api.post("/notarization/request", { documentId });
      setNotaryRequested(true);
    } catch (err) {
      setNotaryError(
        err instanceof Error ? err.message : "Failed to request notarization"
      );
    } finally {
      setRequestingNotary(false);
    }
  };

  return (
    <PageContainer className="flex flex-col gap-8 pt-12">
      <PageHeader
        icon={<UploadIcon />}
        title="Upload"
        subtitle="Add a document to request official notarization."
      />

      <DropZone
        ref={inputRef}
        inputId="document-file"
        title="Drop a file here or choose one"
        description="Select the PDF document you want to notarize."
        onFileSelect={selectFile}
      />

      {selectedFile && status.kind === "selected" && (
        <div className="flex flex-col gap-4">
          <div className="brut-border shadow-hard-sm flex flex-wrap items-center gap-3 self-start rounded-full bg-white py-1.5 pr-1.5 pl-4">
            <FileText className="size-5 shrink-0" aria-hidden="true" />
            <span className="font-bold break-all">{selectedFile.name}</span>
            <span className="text-sm font-medium text-slate">
              {formatFileSize(selectedFile.size)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove selected file"
              onClick={clearFile}
            >
              <X />
            </Button>
          </div>

          {/* Ask user to request notary */}
          <div className="brut-border rounded-2xl bg-amber-50/80 p-4 border-2 border-amber-300 flex items-start gap-3 shadow-hard-sm">
            <input
              id="auto-request-notary"
              type="checkbox"
              checked={autoRequestNotary}
              onChange={(e) => setAutoRequestNotary(e.target.checked)}
              className="size-5 mt-0.5 rounded cursor-pointer accent-navy"
            />
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor="auto-request-notary"
                className="font-extrabold text-navy cursor-pointer text-sm flex items-center gap-1.5"
              >
                <span>Request Notary Review Automatically</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-navy text-yellow rounded-full px-2 py-0.5">
                  Recommended
                </span>
              </label>
              <p className="text-xs text-slate-700">
                Immediately sends your document to the official Notary panel so a licensed notary can verify and record it on the blockchain.
              </p>
            </div>
          </div>
        </div>
      )}

      {status.kind === "uploading" && (
        <div className="flex flex-col gap-3">
          <p className="font-bold">
            {autoRequestNotary
              ? "Uploading document & submitting to notary review queue…"
              : "Uploading document…"}
          </p>
          <Progress value={status.progress} aria-label="Upload progress" />
        </div>
      )}

      {status.kind === "success" && (
        <Card className="flex flex-col gap-6 p-6 md:p-8">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="brut-border flex size-12 items-center justify-center rounded-input bg-green"
            >
              <CircleCheck className="size-6 text-navy" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold">
                {notaryRequested
                  ? "Document Uploaded & Sent to Notary!"
                  : "Document Uploaded"}
              </h2>
              <p className="text-xs text-slate font-medium">
                {notaryRequested
                  ? "Submitted to the Notary review queue. A notary will verify and record it on-chain."
                  : "Document saved. To have it notarized on the blockchain, submit a notary request."}
              </p>
            </div>
          </div>

          {notaryError && (
            <Alert variant="warning">
              <AlertTitle>Notary Request Note</AlertTitle>
              <AlertDescription className="text-xs">{notaryError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate">
              SHA-256 Hash
            </span>
            <HashBlock value={status.hash} label="document hash" />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            {!notaryRequested ? (
              <Button
                variant="primary"
                icon={<Send className="size-4" />}
                loading={requestingNotary}
                onClick={() => handleManualRequestNotary(status.documentId)}
              >
                Request Notarization Now
              </Button>
            ) : (
              <Button asChild variant="primary">
                <Link to="/my-documents">
                  <CheckCircle className="size-4 mr-1.5 text-green" />
                  Track in My Documents
                </Link>
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => navigate(`/documents/${status.documentId}`)}
            >
              View Document Details
            </Button>
          </div>
        </Card>
      )}

      {status.kind === "error" && (
        <Alert variant="error">
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      {status.kind !== "success" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            variant="primary"
            icon={<Send className="size-4" />}
            loading={status.kind === "uploading" && autoRequestNotary}
            disabled={status.kind !== "selected" || status.kind === "uploading"}
            onClick={() => {
              setAutoRequestNotary(true);
              void handleUpload();
            }}
          >
            Upload &amp; Request Notarization
          </Button>

          <Button
            size="lg"
            variant="outline"
            icon={<UploadIcon className="size-4" />}
            loading={status.kind === "uploading" && !autoRequestNotary}
            disabled={status.kind !== "selected" || status.kind === "uploading"}
            onClick={() => {
              setAutoRequestNotary(false);
              void handleUpload();
            }}
          >
            Upload Only
          </Button>
        </div>
      )}
    </PageContainer>
  );
}

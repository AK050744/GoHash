import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, FileText, Upload as UploadIcon, X } from "lucide-react";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const selectedFile = status.kind === "selected" ? status.file : null;

  const selectFile = (file: File | undefined) => {
    if (file) {
      setStatus({ kind: "selected", file });
    }
  };

  const clearFile = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setStatus({ kind: "idle" });
  };

  const handleUpload = async () => {
    if (status.kind !== "selected") return;
    const file = status.file;

    setStatus({ kind: "uploading", progress: 30 });

    try {
      const form = new FormData();
      form.append("file", file);

      setStatus({ kind: "uploading", progress: 60 });

      const res = await api.postForm<{
        success: true;
        document: { id: string; sha256Hash: string };
      }>("/documents/upload", form);

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

  return (
    <PageContainer className="flex flex-col gap-8 pt-12">
      <PageHeader
        icon={<UploadIcon />}
        title="Upload"
        subtitle="Add a document to request notarization."
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
        </div>
      )}

      {status.kind === "uploading" && (
        <div className="flex flex-col gap-3">
          <p className="font-bold">Uploading…</p>
          <Progress value={status.progress} aria-label="Upload progress" />
        </div>
      )}

      {status.kind === "success" && (
        <Card className="flex flex-col gap-5 p-6 md:p-8">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="brut-border flex size-12 items-center justify-center rounded-input bg-green"
            >
              <CircleCheck className="size-6" />
            </span>
            <h2 className="text-xl font-extrabold">Document uploaded</h2>
          </div>
          <p className="font-medium text-slate">
            Keep this hash to verify the document later.
          </p>
          <HashBlock value={status.hash} label="document hash" />
          <Button
            variant="teal"
            onClick={() => navigate(`/documents/${status.documentId}`)}
          >
            View document
          </Button>
        </Card>
      )}

      {status.kind === "error" && (
        <Alert variant="error">
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          icon={<UploadIcon />}
          loading={status.kind === "uploading"}
          disabled={status.kind !== "selected"}
          onClick={handleUpload}
        >
          Upload document
        </Button>
      </div>
    </PageContainer>
  );
}

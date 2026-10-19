import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, RefreshCw, Upload as UploadIcon } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { DocumentList } from "@/components/documents/document-list";
import type { DocumentSummary } from "@/components/documents/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

const ALL_FILTER = "ALL";

const filterOptions: ChipOption[] = [
  { value: ALL_FILTER, label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "NOTARIZED", label: "Notarized" },
];

type DocumentsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; documents: DocumentSummary[] };

interface ApiDocument {
  id: string;
  originalName: string;
  sha256Hash: string;
  status: DocumentSummary["status"];
  fileSize: number;
  createdAt: string;
}

export default function MyDocuments() {
  const [filter, setFilter] = useState<string[]>([ALL_FILTER]);
  const [documentsState, setDocumentsState] = useState<DocumentsState>({
    status: "loading",
  });

  const activeFilter = filter[0] ?? ALL_FILTER;

  const load = useCallback(async () => {
    setDocumentsState({ status: "loading" });
    try {
      const res = await api.get<{ success: true; documents: ApiDocument[] }>(
        "/documents",
      );
      const docs: DocumentSummary[] = res.documents.map((d) => ({
        id: d.id,
        name: d.originalName,
        hash: d.sha256Hash,
        status: d.status,
        createdAt: d.createdAt,
      }));
      setDocumentsState({ status: "ready", documents: docs });
    } catch (err) {
      setDocumentsState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load documents",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const renderBody = () => {
    if (documentsState.status === "loading") {
      return (
        <div role="status" aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only">Loading documents</span>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-20 w-full" />
          ))}
        </div>
      );
    }

    if (documentsState.status === "error") {
      return (
        <Alert variant="error">
          <AlertTitle>Could not load documents</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{documentsState.message}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<RefreshCw />}
              onClick={load}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    const { documents } = documentsState;

    if (documents.length === 0) {
      return (
        <EmptyState
          icon={<FileText />}
          title="No documents yet"
          description="Upload a document to request notarization. It will appear here with its status."
          action={
            <Button asChild variant="teal">
              <Link to="/upload">
                <UploadIcon aria-hidden="true" />
                Upload a document
              </Link>
            </Button>
          }
        />
      );
    }

    const visible = documents.filter(
      (item) => activeFilter === ALL_FILTER || item.status === activeFilter,
    );

    if (visible.length === 0) {
      return (
        <EmptyState
          icon={<FileText />}
          title="No documents match this filter"
          description="Choose a different status to see other documents."
        />
      );
    }

    return <DocumentList documents={visible} />;
  };

  return (
    <PageContainer className="flex flex-col gap-8 pt-12">
      <PageHeader
        icon={<FileText />}
        title="My Documents"
        subtitle="Every document you have uploaded, with its notarization status."
        actions={
          <Button asChild variant="teal">
            <Link to="/upload">
              <UploadIcon aria-hidden="true" />
              Upload
            </Link>
          </Button>
        }
      />

      <ChipGroup
        label="Filter by status"
        options={filterOptions}
        value={filter}
        onChange={(next) => setFilter(next.length > 0 ? next : [ALL_FILTER])}
      />

      {renderBody()}
    </PageContainer>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, FileText, LayoutDashboard, ShieldCheck } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, type NotaryStatus } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";

interface RecentDocument {
  id: string;
  name: string;
  uploadedAt: string;
  status: NotaryStatus;
}

interface StatsResponse {
  success: true;
  total: number;
  pending: number;
  notarized: number;
}

interface DocumentsResponse {
  success: true;
  documents: Array<{
    id: string;
    originalName: string;
    status: NotaryStatus;
    createdAt: string;
  }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<{ total: number; pending: number; notarized: number } | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, docsRes] = await Promise.all([
          api.get<StatsResponse>("/documents/stats"),
          api.get<DocumentsResponse>("/documents"),
        ]);
        setStats({
          total: statsRes.total,
          pending: statsRes.pending,
          notarized: statsRes.notarized,
        });
        // Show 5 most recent documents
        const recent = docsRes.documents.slice(0, 5).map((d) => ({
          id: d.id,
          name: d.originalName,
          uploadedAt: new Date(d.createdAt).toLocaleDateString(),
          status: d.status,
        }));
        setRecentDocuments(recent);
      } catch (err) {
        setLoadingError(err instanceof Error ? err.message : "Failed to load data");
      }
    };
    void load();
  }, []);

  return (
    <PageContainer className="flex flex-col gap-8 pt-12">
      <PageHeader
        icon={<LayoutDashboard />}
        title="Dashboard"
        subtitle="Track your documents from upload to on-chain record."
      />

      {loadingError && (
        <Alert variant="error">
          <AlertTitle>Could not load dashboard</AlertTitle>
          <AlertDescription>{loadingError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          icon={<FileText />}
          label="Total Documents"
          value={stats ? String(stats.total) : "—"}
          tint="white"
        />
        <StatCard
          icon={<Clock />}
          label="Pending Notarization"
          value={stats ? String(stats.pending) : "—"}
          tint="yellow"
        />
        <StatCard
          icon={<ShieldCheck />}
          label="Notarized"
          value={stats ? String(stats.notarized) : "—"}
          tint="green"
        />
      </div>

      <section aria-labelledby="recent-documents-heading" className="flex flex-col gap-4">
        <h2 id="recent-documents-heading" className="text-xl font-extrabold">
          Recent documents
        </h2>
        {recentDocuments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDocuments.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-bold break-all">
                    <Link to={`/documents/${item.id}`} className="underline">
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate">{item.uploadedAt}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          !loadingError && (
            <EmptyState
              icon={<FileText />}
              title="No documents yet"
              description="Documents you upload will appear here with their notarization status."
            />
          )
        )}
      </section>
    </PageContainer>
  );
}

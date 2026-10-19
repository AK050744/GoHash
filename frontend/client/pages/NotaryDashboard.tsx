import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { PendingRequestsTable } from "@/components/notary/pending-requests-table";
import type { PendingRequest } from "@/components/notary/types";
import { ListBody, type ListState } from "@/components/ui/list-body";
import { PageHeader } from "@/components/ui/page-header";
import { WalletStatusCard } from "@/components/wallet/wallet-status-card";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface ApiNotarization {
  id: string;
  documentId: string;
  documentHash: string;
  status: string;
  createdAt: string;
  document: { id: string; originalName: string; sha256Hash: string; createdAt: string };
  owner: { name: string };
}

export default function NotaryDashboard() {
  const { user } = useAuth();
  const [requestsState, setRequestsState] = useState<ListState<PendingRequest>>({
    status: "loading",
  });

  const walletLinked = !!user?.walletAddress;

  const load = useCallback(async () => {
    setRequestsState({ status: "loading" });
    try {
      const res = await api.get<{ success: true; notarizations: ApiNotarization[] }>(
        "/notarization/pending",
      );
      const items: PendingRequest[] = res.notarizations.map((n) => ({
        id: n.id,
        documentName: n.document.originalName,
        hash: n.documentHash,
        ownerName: n.owner.name,
        requestedAt: new Date(n.createdAt).toLocaleDateString(),
      }));
      setRequestsState({ status: "ready", items });
    } catch (err) {
      setRequestsState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load requests",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const walletProps = user?.walletAddress
    ? { linked: true as const, address: user.walletAddress }
    : { linked: false as const };

  return (
    <PageContainer className="flex flex-col gap-8 pt-12">
      <PageHeader
        icon={<ClipboardCheck />}
        title="Requests"
        subtitle="Review documents waiting for notarization."
      />

      <WalletStatusCard {...walletProps} />

      {!walletLinked && (
        <p className="text-sm font-medium text-slate">
          Link a wallet in your{" "}
          <a href="/profile" className="font-bold text-navy underline">
            profile
          </a>{" "}
          before approving requests.
        </p>
      )}

      <section aria-labelledby="pending-requests-heading" className="flex flex-col gap-4">
        <h2 id="pending-requests-heading" className="text-xl font-extrabold">
          Pending requests
        </h2>
        <ListBody
          state={requestsState}
          loadingLabel="Loading requests"
          errorTitle="Could not load requests"
          emptyIcon={<ClipboardCheck />}
          emptyTitle="No pending requests"
          emptyDescription="Documents sent for notarization will appear here."
          onRetry={load}
        >
          {(requests) => <PendingRequestsTable requests={requests} />}
        </ListBody>
      </section>
    </PageContainer>
  );
}

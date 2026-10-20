import { useCallback, useEffect, useState } from "react";
import { Coins, FileText, LayoutDashboard, ShieldCheck, Users } from "lucide-react";

import { ActivityTable } from "@/components/admin/activity-table";
import { PageContainer } from "@/components/layout/page-container";
import type { ActivityEntry } from "@/components/notary/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListBody, type ListState } from "@/components/ui/list-body";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { api } from "@/lib/api";

interface AdminStats {
  totalUsers: number;
  totalNotaries: number;
  totalNotarized: number;
  fees?: {
    paidCount: number;
    totalEth: string;
  };
}

interface ApiActivity {
  id: string;
  documentId?: string;
  documentHash?: string;
  notaryId?: string;
  status: string;
  createdAt: string;
  document?: { originalName?: string };
  notary?: { name?: string };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activityState, setActivityState] = useState<ListState<ActivityEntry>>({
    status: "loading",
  });
  const [statsError, setStatsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setActivityState({ status: "loading" });
    setStatsError(null);
    try {
      const [statsRes, activityRes] = await Promise.all([
        api.get<{
          success: true;
          totalUsers?: number;
          totalNotaries?: number;
          totalNotarized?: number;
          users?: { total: number } | number;
          notaries?: { total: number } | number;
          documents?: { total: number; byStatus?: { NOTARIZED?: number } };
          notarized?: number;
          stats?: {
            users?: { total: number };
            notaries?: { total: number };
            documents?: { total: number; byStatus?: { NOTARIZED?: number } };
            fees?: { paidCount: number; totalWei: string };
          };
          fees?: { paidCount: number; totalWei: string };
        }>("/admin/stats"),
        api.get<{
          success: true;
          activity?: {
            id: string;
            status: string;
            documentName?: string | null;
            requesterName?: string | null;
            notaryWallet?: string | null;
            createdAt: string;
          }[];
          notarizations?: ApiActivity[];
        }>("/admin/activity"),
      ]);

      const usersObj = statsRes.stats?.users ?? statsRes.users;
      const usersCount =
        typeof usersObj === "object" && usersObj !== null
          ? usersObj.total
          : typeof usersObj === "number"
            ? usersObj
            : (statsRes.totalUsers ?? 0);

      const notariesObj = statsRes.stats?.notaries ?? statsRes.notaries;
      const notariesCount =
        typeof notariesObj === "object" && notariesObj !== null
          ? notariesObj.total
          : typeof notariesObj === "number"
            ? notariesObj
            : (statsRes.totalNotaries ?? 0);

      const docsObj = statsRes.stats?.documents ?? statsRes.documents;
      const notarizedCount =
        docsObj?.byStatus?.NOTARIZED ??
        statsRes.totalNotarized ??
        statsRes.notarized ??
        0;

      const { ethers } = await import("ethers");
      const feesData = statsRes.stats?.fees ?? statsRes.fees;
      const feeInfo =
        feesData && feesData.paidCount !== undefined
          ? {
              paidCount: feesData.paidCount,
              totalEth: ethers.formatEther(feesData.totalWei ?? "0"),
            }
          : undefined;

      setStats({
        totalUsers: usersCount,
        totalNotaries: notariesCount,
        totalNotarized: notarizedCount,
        fees: feeInfo,
      });

      const rawList = activityRes.activity ?? activityRes.notarizations ?? [];
      const entries: ActivityEntry[] = rawList.map((n) => ({
        id: n.id,
        action: n.status,
        actor: n.requesterName ?? n.notaryWallet ?? "Notary",
        occurredAt: new Date(n.createdAt).toLocaleString(),
      }));
      setActivityState({ status: "ready", items: entries });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load admin data";
      setStatsError(msg);
      setActivityState({ status: "error", message: msg });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageContainer className="flex flex-col gap-8 pt-12">
      <PageHeader
        icon={<LayoutDashboard />}
        title="Admin dashboard"
        subtitle="Accounts, notaries and recent activity."
      />

      {statsError && (
        <Alert variant="error">
          <AlertTitle>Could not load admin data</AlertTitle>
          <AlertDescription>{statsError}</AlertDescription>
        </Alert>
      )}

      <div className={`grid gap-5 ${stats?.fees ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
        <StatCard
          icon={<Users />}
          label="Users"
          value={stats ? String(stats.totalUsers) : "—"}
          tint="white"
        />
        <StatCard
          icon={<ShieldCheck />}
          label="Notaries"
          value={stats ? String(stats.totalNotaries) : "—"}
          tint="teal"
        />
        <StatCard
          icon={<FileText />}
          label="Notarized documents"
          value={stats ? String(stats.totalNotarized) : "—"}
          tint="green"
        />
        {stats?.fees && (
          <StatCard
            icon={<Coins />}
            label="Fees collected"
            value={`${stats.fees.totalEth} ETH`}
            hint={`${stats.fees.paidCount} fee payments`}
            tint="yellow"
          />
        )}
      </div>

      <section aria-labelledby="recent-activity-heading" className="flex flex-col gap-4">
        <h2 id="recent-activity-heading" className="text-xl font-extrabold">
          Recent activity
        </h2>
        <ListBody
          state={activityState}
          loadingLabel="Loading activity"
          errorTitle="Could not load activity"
          emptyIcon={<LayoutDashboard />}
          emptyTitle="No activity yet"
          emptyDescription="Account and notarization events will appear here."
          onRetry={load}
        >
          {(entries) => <ActivityTable entries={entries} />}
        </ListBody>
      </section>
    </PageContainer>
  );
}

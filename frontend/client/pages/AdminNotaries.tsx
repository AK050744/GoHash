import { useCallback, useEffect, useState } from "react";
import { Search, Users } from "lucide-react";

import { UsersTable } from "@/components/admin/users-table";
import { PageContainer } from "@/components/layout/page-container";
import type { ManagedUser, OnChainAuthorization } from "@/components/notary/types";
import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ListBody, type ListState } from "@/components/ui/list-body";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const ALL_ROLES = "ALL";

const roleOptions: ChipOption[] = [
  { value: ALL_ROLES, label: "All" },
  { value: "USER", label: "User" },
  { value: "NOTARY", label: "Notary" },
  { value: "ADMIN", label: "Admin" },
];

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "NOTARY" | "ADMIN";
  isActive: boolean;
  walletAddress?: string | null;
  linkedWallet?: string | null;
  onChainAuthorized?: boolean | null;
  onChainStatus?: OnChainAuthorization;
}

export default function AdminNotaries() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string[]>([ALL_ROLES]);
  const [usersState, setUsersState] = useState<ListState<ManagedUser>>({
    status: "loading",
  });

  const activeRole = roleFilter[0] ?? ALL_ROLES;

  const load = useCallback(async () => {
    setUsersState({ status: "loading" });
    try {
      const res = await api.get<{
        success: true;
        notaries?: ApiUser[];
        users?: ApiUser[];
      }>("/admin/notaries");
      const list = res.notaries ?? res.users ?? [];
      const users: ManagedUser[] = list.map((u) => {
        let onChain: OnChainAuthorization = "UNKNOWN";
        if (u.onChainStatus) {
          onChain = u.onChainStatus;
        } else if (u.onChainAuthorized === true) {
          onChain = "AUTHORIZED";
        } else if (u.onChainAuthorized === false) {
          onChain = "NOT_AUTHORIZED";
        }
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.isActive ? "ACTIVE" : "SUSPENDED",
          onChain,
          walletAddress: u.walletAddress ?? u.linkedWallet ?? null,
        };
      });
      setUsersState({ status: "ready", items: users });
    } catch (err) {
      setUsersState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load users",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageContainer className="flex flex-col gap-8 pt-12">
      <PageHeader
        icon={<Users />}
        title="Notaries"
        subtitle="Manage account roles and on-chain notary authorization."
      />

      <div className="flex flex-col gap-4">
        <div className="max-w-md">
          <Input
            type="search"
            aria-label="Search users"
            placeholder="Search by name or email"
            leadingIcon={<Search />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <ChipGroup
          label="Filter by role"
          options={roleOptions}
          value={roleFilter}
          onChange={(next) => setRoleFilter(next.length > 0 ? next : [ALL_ROLES])}
        />
      </div>

      <ListBody
        state={usersState}
        loadingLabel="Loading users"
        errorTitle="Could not load users"
        emptyIcon={<Users />}
        emptyTitle="No users yet"
        emptyDescription="Accounts registered on GoHash will appear here."
        onRetry={load}
      >
        {(users) => {
          const query = search.trim().toLowerCase();
          const visible = users.filter(
            (u) =>
              (activeRole === ALL_ROLES || u.role === activeRole) &&
              (query === "" ||
                u.name.toLowerCase().includes(query) ||
                u.email.toLowerCase().includes(query)),
          );

          if (visible.length === 0) {
            return (
              <EmptyState
                icon={<Search />}
                title="No users match these filters"
                description="Change the search or role filter to see other accounts."
              />
            );
          }

          return (
            <UsersTable
              users={visible}
              currentUserId={currentUser?.id ?? null}
              onChanged={load}
            />
          );
        }}
      </ListBody>
    </PageContainer>
  );
}

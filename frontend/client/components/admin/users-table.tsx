import { OnChainBadge } from "@/components/admin/on-chain-badge";
import { UserActions } from "@/components/admin/user-actions";
import type { ManagedUser } from "@/components/notary/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const roleVariant = {
  USER: "neutral",
  NOTARY: "teal",
  ADMIN: "default",
} as const;

export interface UsersTableProps {
  users: ManagedUser[];
  currentUserId: string | null;
}

function UsersTable({ users, currentUserId }: UsersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>On-chain</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <p className="font-bold">{user.name}</p>
              <p className="text-sm text-slate break-all">{user.email}</p>
            </TableCell>
            <TableCell>
              <Badge variant={roleVariant[user.role]}>{user.role}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={user.status === "ACTIVE" ? "success" : "danger"}>
                {user.status}
              </Badge>
            </TableCell>
            <TableCell>
              <OnChainBadge status={user.onChain} />
            </TableCell>
            <TableCell>
              <UserActions user={user} isSelf={user.id === currentUserId} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export { UsersTable };

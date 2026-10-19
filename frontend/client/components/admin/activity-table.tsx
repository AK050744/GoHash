import type { ActivityEntry } from "@/components/notary/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ActivityTableProps {
  entries: ActivityEntry[];
}

function ActivityTable({ entries }: ActivityTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Actor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="text-slate">{entry.occurredAt}</TableCell>
            <TableCell className="font-bold">{entry.action}</TableCell>
            <TableCell>{entry.actor}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export { ActivityTable };

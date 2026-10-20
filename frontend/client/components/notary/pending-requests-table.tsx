import { Link } from "react-router-dom";

import { shortenHash } from "@/components/documents/hash-block";
import type { PendingRequest } from "@/components/notary/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FeeConfig } from "@/lib/fees";

export interface PendingRequestsTableProps {
  requests: PendingRequest[];
  feeConfig?: FeeConfig;
}

function PendingRequestsTable({ requests, feeConfig }: PendingRequestsTableProps) {
  const showFee = Boolean(feeConfig?.enabled);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Document</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Hash</TableHead>
          <TableHead>Requested</TableHead>
          {showFee && <TableHead>Payment</TableHead>}
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => {
          const isPaid = request.payment?.status === "PAID";

          return (
            <TableRow key={request.id}>
              <TableCell className="font-bold break-all">
                {request.documentName}
              </TableCell>
              <TableCell>{request.ownerName}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm">
                    {shortenHash(request.hash)}
                  </code>
                  <CopyButton
                    value={request.hash}
                    label={`hash of ${request.documentName}`}
                  />
                </div>
              </TableCell>
              <TableCell className="text-slate">{request.requestedAt}</TableCell>
              {showFee && (
                <TableCell>
                  <Badge variant={isPaid ? "success" : "default"}>
                    {isPaid ? "Paid" : "Unpaid"}
                  </Badge>
                </TableCell>
              )}
              <TableCell>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/notary/requests/${request.id}`}>
                    View
                    <span className="sr-only"> {request.documentName}</span>
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export { PendingRequestsTable };

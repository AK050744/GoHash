import { Link } from "react-router-dom";
import { Eye } from "lucide-react";

import { shortenHash } from "@/components/documents/hash-block";
import type { DocumentSummary } from "@/components/documents/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DocumentListProps {
  documents: DocumentSummary[];
}

function DocumentList({ documents }: DocumentListProps) {
  return (
    <>
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Hash</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-64 font-bold break-all">
                  {item.name}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm whitespace-nowrap">
                      {shortenHash(item.hash)}
                    </code>
                    <CopyButton value={item.hash} label="document hash" />
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate">
                  {item.createdAt}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {item.status === "PENDING" && (
                      <Button asChild variant="primary" size="sm">
                        <Link to={`/documents/${item.id}`}>
                          Request Notary
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/documents/${item.id}`}>
                        <Eye aria-hidden="true" />
                        View
                        <span className="sr-only">{item.name}</span>
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-4 lg:hidden">
        {documents.map((item) => (
          <li key={item.id}>
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-extrabold break-all">{item.name}</p>
                <StatusBadge status={item.status} className="shrink-0" />
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 font-mono text-sm break-all">
                  {shortenHash(item.hash)}
                </code>
                <CopyButton value={item.hash} label="document hash" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate">{item.createdAt}</p>
                <div className="flex items-center gap-2">
                  {item.status === "PENDING" && (
                    <Button asChild variant="primary" size="sm">
                      <Link to={`/documents/${item.id}`}>
                        Request Notary
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/documents/${item.id}`}>
                      <Eye aria-hidden="true" />
                      View
                      <span className="sr-only">{item.name}</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export { DocumentList };

import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";

export type ListState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: T[] };

export interface ListBodyProps<T> {
  state: ListState<T>;
  loadingLabel: string;
  errorTitle: string;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  onRetry: () => void;
  children: (items: T[]) => ReactNode;
}

function ListBody<T>({
  state,
  loadingLabel,
  errorTitle,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRetry,
  children,
}: ListBodyProps<T>) {
  if (state.status === "loading") {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-4">
        <span className="sr-only">{loadingLabel}</span>
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Alert variant="error">
        <AlertTitle>{errorTitle}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{state.message}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<RefreshCw />}
            onClick={onRetry}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (state.items.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return <>{children(state.items)}</>;
}

export { ListBody };

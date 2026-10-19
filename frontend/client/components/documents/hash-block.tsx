import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

export function shortenHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export interface HashBlockProps {
  value: string;
  label: string;
  className?: string;
}

function HashBlock({ value, label, className }: HashBlockProps) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      <code className="brut-border min-w-0 flex-1 rounded-input bg-cream px-3 py-2 font-mono text-sm break-all whitespace-normal text-navy">
        {value}
      </code>
      <CopyButton value={value} label={label} className="shrink-0 print:hidden" />
    </div>
  );
}

export { HashBlock };

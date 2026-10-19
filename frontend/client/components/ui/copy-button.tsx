import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

function CopyButton({ value, label = "value", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Select the text and copy it manually.",
      });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      className={className}
      icon={copied ? <Check /> : <Copy />}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export { CopyButton };

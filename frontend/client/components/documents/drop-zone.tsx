import { forwardRef, useState, type DragEvent } from "react";
import { Upload as UploadIcon } from "lucide-react";

import { DecorIcon } from "@/components/decor";
import { cn } from "@/lib/utils";

export interface DropZoneProps {
  inputId: string;
  title: string;
  description: string;
  onFileSelect: (file: File | undefined) => void;
}

const DropZone = forwardRef<HTMLInputElement, DropZoneProps>(
  ({ inputId, title, description, onFileSelect }, ref) => {
    const [dragging, setDragging] = useState(false);

    const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setDragging(true);
    };

    const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setDragging(false);
      onFileSelect(event.dataTransfer.files[0]);
    };

    return (
      <label
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "brut-border shadow-hard relative flex min-h-80 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-card border-dashed bg-white px-6 py-14 text-center transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-navy",
          dragging && "bg-yellow/30",
        )}
      >
        <DecorIcon
          shape="document"
          className="animate-float absolute top-6 left-6 size-16 print:hidden"
        />
        <DecorIcon
          shape="shield"
          style={{ animationDelay: "1.2s" }}
          className="animate-float absolute right-6 bottom-6 size-20 print:hidden"
        />
        <span
          aria-hidden="true"
          className="brut-border flex size-16 items-center justify-center rounded-input bg-cream"
        >
          <UploadIcon className="size-8" />
        </span>
        <span className="text-xl font-extrabold">{title}</span>
        <span className="text-sm font-medium text-slate">{description}</span>
        <span className="brut-border shadow-hard-sm inline-flex min-h-11 items-center rounded-full bg-yellow px-6 font-bold">
          Choose file
        </span>
        <input
          ref={ref}
          id={inputId}
          type="file"
          className="sr-only"
          onChange={(event) => onFileSelect(event.target.files?.[0])}
        />
      </label>
    );
  },
);
DropZone.displayName = "DropZone";

export { DropZone };

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ChipOption {
  value: string;
  label: string;
}

export interface ChipGroupProps {
  label: string;
  options: ChipOption[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  className?: string;
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
  multiple = false,
  className,
}: ChipGroupProps) {
  const toggle = (optionValue: string) => {
    const isSelected = value.includes(optionValue);
    if (multiple) {
      onChange(
        isSelected
          ? value.filter((item) => item !== optionValue)
          : [...value, optionValue],
      );
      return;
    }
    onChange(isSelected ? [] : [optionValue]);
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const isSelected = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => toggle(option.value)}
            className={cn(
              "brut-border brut-raise shadow-hard-sm inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold",
              isSelected ? "bg-blue text-white" : "bg-white text-navy",
            )}
          >
            {isSelected && <Check className="size-4" aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export { ChipGroup };

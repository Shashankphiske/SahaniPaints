import React, { useRef, useEffect, useState } from "react";
import { Input } from "./input";
import { ChevronDown, X } from "lucide-react";

export interface SearchableSelectOption {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  /** Currently selected option id, or empty string */
  value: string;
  /** The display text shown in the input */
  displayValue: string;
  /** Filtered options to show in the dropdown */
  options: SearchableSelectOption[];
  /** Placeholder when nothing is selected */
  placeholder?: string;
  /** Empty-state label e.g. "No project (optional)" */
  allLabel?: string;
  /** Called when user types in the input */
  onSearchChange: (query: string) => void;
  /** Called when user selects an option */
  onSelect: (id: string, label: string) => void;
  /** Called when user clears selection */
  onClear?: () => void;
  /** Whether the field is required */
  required?: boolean;
  /** Extra class on the wrapper div */
  className?: string;
  /** Height of the input (default h-10) */
  inputHeight?: string;
  /** Text size class (default text-sm) */
  textSize?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Reusable searchable input + dropdown for entity lookups.
 * Replaces native <select> for lists like projects, labours, contractors.
 */
export function SearchableSelect({
  value,
  displayValue,
  options,
  placeholder = "Search...",
  allLabel,
  onSearchChange,
  onSelect,
  onClear,
  required,
  className = "",
  inputHeight = "h-10",
  textSize = "text-sm",
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
    setOpen(true);
  };

  const handleSelect = (opt: SearchableSelectOption) => {
    onSelect(opt.id, opt.label);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear?.();
    onSearchChange("");
    setOpen(false);
  };

  const handleAllOption = () => {
    onSelect("", allLabel || "");
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <Input
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !value}
          className={`${inputHeight} ${textSize} pr-16 font-semibold`}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && onClear && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={disabled}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-[999] mt-1 w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-52 overflow-y-auto animate-in fade-in-50 slide-in-from-top-1 duration-150">
          {allLabel !== undefined && (
            <div
              onMouseDown={handleAllOption}
              className="px-3 py-2.5 text-sm text-muted-foreground italic cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors"
            >
              {allLabel}
            </div>
          )}
          {options.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground italic">
              No matches found.
            </div>
          ) : (
            options.map((opt) => (
              <div
                key={opt.id}
                onMouseDown={() => handleSelect(opt)}
                className={`px-3 py-2.5 cursor-pointer text-sm font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-zinc-900 ${
                  opt.id === value
                    ? "bg-primary/5 text-primary"
                    : "text-slate-800 dark:text-slate-200"
                }`}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

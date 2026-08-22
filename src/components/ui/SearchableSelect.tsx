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
  /** Called when user hits Enter */
  onEnter?: (query: string) => void;
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
  /** Direction of dropdown list display (default 'down') */
  direction?: "up" | "down";
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
  onEnter,
  required,
  className = "",
  inputHeight = "h-10",
  textSize = "text-sm",
  disabled = false,
  direction = "down",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Store the original displayValue when focused, so we can revert on blur/outside click
  const originalDisplayValueRef = useRef(displayValue);

  // Sync typedValue with displayValue when not focused or when displayValue changes
  useEffect(() => {
    if (!isFocused) {
      setTypedValue(displayValue || "");
    }
  }, [displayValue, isFocused]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        onSearchChange(originalDisplayValueRef.current || "");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onSearchChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTypedValue(val);
    onSearchChange(val);
    setOpen(true);
  };

  const handleSelect = (opt: SearchableSelectOption) => {
    originalDisplayValueRef.current = opt.label;
    onSelect(opt.id, opt.label);
    setTypedValue(opt.label);
    onSearchChange(opt.label);
    setIsFocused(false);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    originalDisplayValueRef.current = "";
    onClear?.();
    onSearchChange("");
    setTypedValue("");
    setIsFocused(false);
    setOpen(false);
  };

  const handleAllOption = () => {
    originalDisplayValueRef.current = allLabel || "";
    onSelect("", allLabel || "");
    setTypedValue(allLabel || "");
    setIsFocused(false);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        {value && onClear && (
          <button
            type="button"
            onClick={handleClear}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors z-10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <Input
          showClear={false}
          value={isFocused ? typedValue : (displayValue || "")}
          onChange={handleInputChange}
          onFocus={() => {
            setIsFocused(true);
            setTypedValue(displayValue || "");
            originalDisplayValueRef.current = displayValue;
            setOpen(true);
          }}
          onBlur={() => {
            // Delay slightly to allow onMouseDown on options list to register
            setTimeout(() => {
              setIsFocused(false);
              setOpen(false);
              onSearchChange(originalDisplayValueRef.current || "");
            }, 200);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter?.(isFocused ? typedValue : (displayValue || ""));
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !value}
          className={`${inputHeight} ${textSize} ${value && onClear ? "pl-9" : "pl-3"} pr-9 font-semibold`}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          onMouseDown={(e) => e.preventDefault()}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors z-10"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className={`absolute z-[999] w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-52 overflow-y-auto duration-150 animate-in fade-in-50 ${
          direction === "up" ? "bottom-full mb-1 slide-in-from-bottom-1" : "mt-1 slide-in-from-top-1"
        }`}>
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

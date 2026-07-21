import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface InputProps extends React.ComponentProps<"input"> {
  onClear?: () => void;
  showClear?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, onBlur, onClear, showClear = true, value, defaultValue, disabled, ...props }, ref) => {
    const isNumberType = type === "number";
    const internalRef = React.useRef<HTMLInputElement | null>(null);

    // Dynamic ref setup
    React.useImperativeHandle(ref, () => internalRef.current!);

    const [uncontrolledValue, setUncontrolledValue] = React.useState(
      defaultValue !== undefined ? String(defaultValue) : ""
    );

    const isControlled = value !== undefined;
    const currentVal = isControlled ? String(value ?? "") : uncontrolledValue;
    const hasValue = currentVal.length > 0;

    const isClearableType =
      type !== "file" &&
      type !== "checkbox" &&
      type !== "radio" &&
      type !== "button" &&
      type !== "submit" &&
      type !== "hidden" &&
      !disabled;

    // Override the element properties for React Hook Form compatibility
    React.useEffect(() => {
      if (isNumberType && internalRef.current) {
        const element = internalRef.current;
        
        // Override valueAsNumber
        Object.defineProperty(element, "valueAsNumber", {
          get() {
            const val = element.value;
            const parsed = parseFloat(val);
            return isNaN(parsed) ? NaN : parsed;
          },
          configurable: true,
        });

        // Override type property to return "number"
        Object.defineProperty(element, "type", {
          get() {
            return "number";
          },
          set() {},
          configurable: true,
        });
      }
    }, [isNumberType]);

    const cleanNumericString = (val: string) => {
      if (val === "") return "";
      if (val === "-" || val === "." || val === "-.") return val;
      
      let clean = val.replace(/[^0-9.-]/g, "");
      
      const hasMinus = clean.startsWith("-");
      clean = clean.replace(/-/g, "");
      if (hasMinus) {
        clean = "-" + clean;
      }
      
      const parts = clean.split(".");
      if (parts.length > 2) {
        clean = parts[0] + "." + parts.slice(1).join("");
      }
      
      return clean;
    };

    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const originalValue = e.target.value;
      const cleaned = cleanNumericString(originalValue);
      
      if (originalValue !== cleaned) {
        e.target.value = cleaned;
      }
      
      if (!isControlled) {
        setUncontrolledValue(e.target.value);
      }
      
      if (onChange) {
        onChange(e);
      }
    };

    const handleStandardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setUncontrolledValue(e.target.value);
      }

      if (onChange) {
        onChange(e);
      }
    };

    const handleNumericBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const originalValue = e.target.value;
      const parsed = parseFloat(originalValue);
      const newValue = isNaN(parsed) ? "" : String(parsed);
      
      if (originalValue !== newValue) {
        const element = e.target;
        
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        const setter = valueSetter || prototypeValueSetter;
        
        if (setter) {
          setter.call(element, newValue);
        } else {
          element.value = newValue;
        }
        
        const inputEvent = new Event("input", { bubbles: true });
        element.dispatchEvent(inputEvent);
        
        const changeEvent = new Event("change", { bubbles: true });
        element.dispatchEvent(changeEvent);
      }
      
      if (onBlur) {
        onBlur(e);
      }
    };

    const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const el = internalRef.current;
      if (el) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(el, "");
        } else {
          el.value = "";
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.focus();
      }

      if (!isControlled) {
        setUncontrolledValue("");
      }

      if (onClear) {
        onClear();
      } else if (onChange) {
        const syntheticEvent = {
          target: el || { value: "" },
          currentTarget: el || { value: "" },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    const inputElement = isNumberType ? (
      <input
        type="text"
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          hasValue && showClear && isClearableType && "pr-8",
          className,
        )}
        ref={internalRef}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={handleNumericChange}
        onBlur={handleNumericBlur}
        {...props}
      />
    ) : (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          hasValue && showClear && isClearableType && "pr-8",
          className,
        )}
        ref={internalRef}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={handleStandardChange}
        onBlur={onBlur}
        {...props}
      />
    );

    if (showClear && isClearableType) {
      return (
        <div className="relative flex items-center w-full">
          {inputElement}
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded-full focus:outline-none"
              title="Clear input"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      );
    }

    return inputElement;
  },
);
Input.displayName = "Input";

export { Input };

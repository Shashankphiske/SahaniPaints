import * as React from "react";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<React.ComponentProps<"input">, "type"> {}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, onChange, onBlur, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current!);

    React.useEffect(() => {
      if (inputRef.current) {
        const element = inputRef.current;
        Object.defineProperty(element, "valueAsNumber", {
          get() {
            const val = element.value;
            const parsed = parseFloat(val);
            return isNaN(parsed) ? NaN : parsed;
          },
          configurable: true,
        });

        Object.defineProperty(element, "type", {
          get() {
            return "number";
          },
          set() {},
          configurable: true,
        });
      }
    }, []);

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

    return (
      <input
        type="text"
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={inputRef}
        onChange={handleNumericChange}
        onBlur={handleNumericBlur}
        {...props}
      />
    );
  }
);
NumberInput.displayName = "NumberInput";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    if (type === "number") {
      return <NumberInput ref={ref} className={className} {...props} />;
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

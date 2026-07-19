import { useEffect, useRef, useState } from "react";
import { Plus, Search, Filter, X, Loader2, ChevronDown, Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { apiRequest } from "../../lib/api";
import { useToast } from "../../hooks/use-toast";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type?: "select" | "text" | "number" | "priceRange" | "dateRange";
  options?: FilterOption[];
  placeholder?: string;
}

interface MasterPageLayoutProps {
  title: string;
  searchPlaceholder?: string;
  onSearch: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  onFilterChange?: (filters: Record<string, any>) => void;
  onFilterSubmit?: (filters: Record<string, any>) => void;
  filters?: FilterConfig[];
  onAdd?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  onFilterToggle?: (isOpen: boolean) => void;
  resource?: string;
  importExtraData?: Record<string, any>;
  queryParams?: Record<string, any>;
}

// Simple CSV Schema definition
interface CSVResourceSchema {
  headers: string[];
  required: string[];
  numericFields?: string[];
  downloadHeaders: string[];
}

const CSV_RESOURCE_FIELDS: Record<string, string[]> = {
  customers: ["name", "phonenumber", "alternatePhonenumber", "email", "address"],
  brands: ["name", "description"],
  users: ["role", "username", "email", "password", "phonenumber", "address"],
};

const CSV_SCHEMAS: Record<string, CSVResourceSchema> = {
  brands: {
    headers: ["name", "description"],
    required: ["name"],
    downloadHeaders: ["id", "name", "description", "createdAt"],
  },
  customers: {
    headers: ["name", "phonenumber", "alternatePhonenumber", "email", "address"],
    required: ["name"],
    downloadHeaders: ["id", "name", "phonenumber", "alternatePhonenumber", "email", "address", "createdAt"],
  },
  users: {
    headers: ["username", "email", "password", "phonenumber", "address"],
    required: ["username", "email"],
    downloadHeaders: ["id", "role", "username", "email", "phonenumber", "address", "createdAt"],
  },
};

// CSV parsing / generating helpers
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuote) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++;
        } else {
          insideQuote = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        insideQuote = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = "";
      } else if (char === '\r' || char === '\n') {
        row.push(cell.trim());
        cell = "";
        if (row.length > 0 && row.some(x => x !== "")) {
          result.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        cell += char;
      }
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell.trim());
    if (row.some(x => x !== "")) {
      result.push(row);
    }
  }
  return result;
}

function jsonToCSV(headers: string[], data: any[]): string {
  const headerRow = headers.join(",");
  const rows = data.map(item => {
    return headers.map(header => {
      const val = item[header];
      if (val == null) return '""';
      const strVal = String(val).replace(/"/g, '""');
      if (strVal.includes(",") || strVal.includes("\n") || strVal.includes("\r") || strVal.includes('"')) {
        return `"${strVal}"`;
      }
      return strVal;
    }).join(",");
  });
  return [headerRow, ...rows].join("\n");
}

export function MasterPageLayout({
  title,
  searchPlaceholder = "Search...",
  onSearch,
  onSearchSubmit,
  onFilterChange,
  onFilterSubmit,
  filters = [],
  onAdd,
  children,
  actions,
  onFilterToggle,
  resource,
  importExtraData,
  queryParams
}: MasterPageLayoutProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [showFilters, setShowFilters] = useState(false);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "validating" | "confirm" | "errors" | "importing" | "success">("idle");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [validatedRows, setValidatedRows] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, error: "" });
  const [isDownloading, setIsDownloading] = useState(false);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearchSubmit?.(searchQuery);
    }
  };

  const handleFilterToggle = () => {
    const next = !showFilters;
    setShowFilters(next);
    onFilterToggle?.(next);
  };

  const handleFilterChange = (key: string, value: any) => {
    const updated = value
      ? { ...activeFilters, [key]: value }
      : Object.fromEntries(
          Object.entries(activeFilters).filter(([k]) => k !== key)
        );

    setActiveFilters(updated);
    onFilterChange?.(updated);
  };

  const handleFilterSubmit = () => {
    onFilterSubmit?.(activeFilters);
  };

  const clearFilter = (key: string) => {
    const updated = { ...activeFilters };
    delete updated[key];
    setActiveFilters(updated);
    onFilterChange?.(updated);
    onFilterSubmit?.(updated);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    onFilterChange?.({});
    onFilterSubmit?.({});
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Invalid file format",
        description: "Please upload a valid CSV file.",
        variant: "destructive",
      });
      return;
    }

    setDialogOpen(true);
    setImportStatus("validating");
    setImportErrors([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length <= 1) {
          setImportErrors(["CSV file is empty or contains no data rows."]);
          setImportStatus("errors");
          return;
        }

        const schema = CSV_SCHEMAS[resource || ""];
        if (!schema) {
          setImportErrors([`CSV Import is not supported for resource "${resource}".`]);
          setImportStatus("errors");
          return;
        }

        const csvHeaders = parsed[0].map(h => h.trim().toLowerCase());
        const missingRequired = schema.required.filter(
          reqCol => !csvHeaders.includes(reqCol.toLowerCase())
        );

        if (missingRequired.length > 0) {
          setImportErrors([
            `Missing required column headers: ${missingRequired.join(", ")}.`,
            `Expected headers: ${schema.headers.join(", ")}`
          ]);
          setImportStatus("errors");
          return;
        }

        const rowsToImport: any[] = [];
        const errors: string[] = [];

        for (let rowIdx = 1; rowIdx < parsed.length; rowIdx++) {
          const row = parsed[rowIdx];
          if (row.length === 0 || row.every(cell => cell.trim() === "")) continue;

          const rowErrors: string[] = [];
          const rowObj: Record<string, string> = {};

          csvHeaders.forEach((hdr, colIdx) => {
            const originalHeader = schema.headers.find(eh => eh.toLowerCase() === hdr);
            if (originalHeader) {
              rowObj[originalHeader] = row[colIdx] || "";
            }
          });

          schema.required.forEach(reqField => {
            const val = rowObj[reqField];
            if (val === undefined || val === null || val.trim() === "") {
              rowErrors.push(`"${reqField}" is required`);
            }
          });

          if (rowErrors.length > 0) {
            errors.push(`Row ${rowIdx + 1}: ${rowErrors.join(", ")}`);
          } else {
            const mappedPayload: Record<string, any> = {};
            const allowedFields = CSV_RESOURCE_FIELDS[resource || ""] || [];
            
            schema.headers.forEach(h => {
              const val = rowObj[h];
              if (val !== undefined && val !== null && val.trim() !== "") {
                mappedPayload[h] = val;
              }
            });

            const cleanedPayload = Object.fromEntries(
              Object.entries(mappedPayload).filter(([k]) => allowedFields.includes(k) || k === "password")
            );

            rowsToImport.push(cleanedPayload);
          }
        }

        if (errors.length > 0) {
          setImportErrors(errors);
          setImportStatus("errors");
        } else {
          setValidatedRows(rowsToImport);
          setImportStatus("confirm");
        }
      } catch (err: any) {
        setImportErrors([`An unexpected error occurred during parsing: ${err.message || err}`]);
        setImportStatus("errors");
      }
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const executeImport = async () => {
    setImportStatus("importing");
    setImportProgress({ current: 0, total: validatedRows.length, error: "" });

    try {
      const payloads = validatedRows.map(rowPayload => ({
        ...rowPayload,
        ...importExtraData
      }));
      await apiRequest.bulkCreate(resource || "", payloads);
      setImportProgress({ current: validatedRows.length, total: validatedRows.length, error: "" });
      setImportStatus("success");
      toast({
        title: "Import complete",
        description: `Successfully imported ${validatedRows.length} records.`,
      });
      setTimeout(() => {
        setDialogOpen(false);
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setImportProgress({ current: 0, total: validatedRows.length, error: err.message || "Failed to import batch." });
      setImportStatus("errors");
    }
  };

  const handleExport = async () => {
    if (!resource) return;
    setIsDownloading(true);
    try {
      const schema = CSV_SCHEMAS[resource];
      if (!schema) {
        toast({
          title: "Export failed",
          description: `Export is not supported for "${resource}".`,
          variant: "destructive",
        });
        return;
      }

      // Fetch all items from the database
      const allItems = await apiRequest.fetchAll(resource, queryParams);
      const csv = jsonToCSV(schema.downloadHeaders, allItems);
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${resource}_export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export completed",
        description: `Downloaded ${allItems.length} records in CSV format.`,
      });
    } catch (err: any) {
      toast({
        title: "Export failed",
        description: err.message || "An error occurred while generating export file.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadSampleTemplate = () => {
    if (!resource) return;
    const schema = CSV_SCHEMAS[resource];
    if (!schema) return;

    // Generate CSV template containing just the headers and a sample row
    const csvContent = schema.headers.join(",") + "\n" + schema.headers.map(h => `Sample_${h}`).join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${resource}_sample_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground select-none">{title}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions}

          {/* Import/Export Actions if supported */}
          {resource && CSV_SCHEMAS[resource] && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5"
              >
                <Upload className="h-4 w-4" />
                <span>Import</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isDownloading}
                className="flex items-center gap-1.5"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>Export</span>
              </Button>
            </>
          )}

          {filters.length > 0 && (
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={handleFilterToggle}
              className="flex items-center gap-1.5"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {Object.keys(activeFilters).length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-accent text-accent-foreground rounded-full">
                  {Object.keys(activeFilters).length}
                </span>
              )}
            </Button>
          )}

          {onAdd && (
            <Button onClick={onAdd} size="sm" className="flex items-center gap-1.5 font-medium">
              <Plus className="h-4 w-4" />
              <span>Add New</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters bar */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-sm-soft space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className="pl-9 bg-muted/20 border-border"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
            {onSearchSubmit && (
              <Button onClick={() => onSearchSubmit(searchQuery)} className="w-full md:w-auto font-medium">
                Search
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible filter inputs */}
        {showFilters && filters.length > 0 && (
          <div className="pt-4 border-t border-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filters.map((filter) => (
                <div key={filter.key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {filter.label}
                  </label>
                  {filter.type === "select" ? (
                    <select
                      value={activeFilters[filter.key] ?? ""}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">All</option>
                      {filter.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={filter.type ?? "text"}
                      placeholder={filter.placeholder ?? `Filter by ${filter.label.toLowerCase()}`}
                      value={activeFilters[filter.key] ?? ""}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="bg-muted/10"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear All
              </Button>
              <Button size="sm" onClick={handleFilterSubmit}>
                Apply Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Page Content */}
      <div className="space-y-4">{children}</div>

      {/* CSV Import Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Import Data: {title}</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {importStatus === "validating" && (
              <div className="flex flex-col items-center justify-center p-8 space-y-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm font-semibold">Validating CSV data schema and values...</p>
              </div>
            )}

            {importStatus === "errors" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-destructive bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-900/50">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span className="font-semibold text-sm">Validation failed: {importErrors.length} errors found</span>
                </div>
                
                {importProgress.error && (
                  <p className="text-xs text-destructive mt-1 font-mono">{importProgress.error}</p>
                )}

                <div className="max-h-60 overflow-y-auto border border-border rounded-lg p-3 space-y-1 bg-muted/10 font-mono text-xs">
                  {importErrors.map((err, idx) => (
                    <div key={idx} className="text-destructive py-0.5">
                      • {err}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Please fix these errors in your CSV file and try again. You can download a template for the correct layout below.
                </p>
                <div className="flex justify-start">
                  <Button variant="link" size="sm" onClick={downloadSampleTemplate} className="p-0 text-xs text-primary font-semibold">
                    Download sample CSV template
                  </Button>
                </div>
              </div>
            )}

            {importStatus === "confirm" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span className="font-semibold text-sm">Schema and values verified!</span>
                </div>
                <p className="text-sm">
                  Ready to import <strong className="text-primary">{validatedRows.length}</strong> new records into the database.
                </p>
                <div className="border border-border rounded-lg max-h-40 overflow-y-auto p-3 bg-muted/10 text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border/80">
                        {validatedRows.length > 0 &&
                          Object.keys(validatedRows[0]).slice(0, 4).map(k => (
                            <th key={k} className="pb-1 font-semibold capitalize text-muted-foreground">
                              {k}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validatedRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="border-b border-border/40 last:border-0">
                          {Object.keys(row).slice(0, 4).map(k => (
                            <td key={k} className="py-1.5 truncate max-w-[120px]">
                              {String(row[k])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validatedRows.length > 5 && (
                    <div className="text-center pt-2 text-muted-foreground text-[10px]">
                      And {validatedRows.length - 5} more rows...
                    </div>
                  )}
                </div>
              </div>
            )}

            {importStatus === "importing" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center p-8 space-y-3">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-sm font-semibold">Writing records to database...</p>
                  <p className="text-xs text-muted-foreground">
                    Importing {importProgress.current} of {importProgress.total} records
                  </p>
                </div>
              </div>
            )}

            {importStatus === "success" && (
              <div className="flex flex-col items-center justify-center p-8 space-y-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-bounce" />
                <p className="text-base font-bold text-emerald-600">Import Successful!</p>
                <p className="text-xs text-muted-foreground">Refreshing page data...</p>
              </div>
            )}
          </div>

          <DialogFooter>
            {importStatus === "errors" && (
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
            )}
            {importStatus === "confirm" && (
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={executeImport}>Confirm Import</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

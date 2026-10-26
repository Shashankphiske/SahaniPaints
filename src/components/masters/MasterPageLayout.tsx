import { useEffect, useRef, useState } from "react";
import { Plus, Search, Filter, X, Loader2, ChevronDown, Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
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
  embedded?: boolean;
  titleClassName?: string;
}

// Simple CSV Schema definition
interface CSVResourceSchema {
  headers: string[];
  required: string[];
  numericFields?: string[];
  booleanFields?: string[];
  downloadHeaders: string[];
  sampleRow?: Record<string, string>;
}

const CSV_RESOURCE_FIELDS: Record<string, string[]> = {
  brands: ["name", "description"],
  customers: ["name", "phonenumber", "alternatePhonenumber", "email", "address"],
  users: ["role", "username", "email", "password", "phonenumber", "address"],
  products: ["name", "brandId", "brand", /* "category", */ "price", "size", "coverageSqFt", "coverageRnFt", "hasToken"],
  interiors: ["name", "email", "phonenumber", "alternatePhonenumber", "address", "commissionFeePercentage"],
  areas: ["name"],
  labours: ["name", "paymentPerDay", "tuesdayPaymentAmount", "type", "phonenumber"],
  contractors: ["name", "phonenumber", "email", "address", "type"],
  colors: ["name", "shade"],
};

const CSV_SCHEMAS: Record<string, CSVResourceSchema> = {
  brands: {
    headers: ["name", "description"],
    required: ["name"],
    downloadHeaders: ["id", "name", "description", "createdAt"],
    sampleRow: {
      name: "Asian Paints",
      description: "Premium interior and exterior wall paints",
    },
  },
  customers: {
    headers: ["name", "phonenumber", "alternatePhonenumber", "email", "address"],
    required: ["name"],
    downloadHeaders: ["id", "name", "phonenumber", "alternatePhonenumber", "email", "address", "createdAt"],
    sampleRow: {
      name: "Rajesh Kumar",
      phonenumber: "9876543210",
      alternatePhonenumber: "9123456780",
      email: "rajesh@example.com",
      address: "123 Park Avenue, Mumbai",
    },
  },
  users: {
    headers: ["username", "email", "password", "phonenumber", "role", "address"],
    required: ["username", "email"],
    downloadHeaders: ["id", "role", "username", "email", "phonenumber", "address", "createdAt"],
    sampleRow: {
      username: "amit_supervisor",
      email: "amit@sahanipaints.com",
      password: "User@123",
      phonenumber: "9811223344",
      role: "SALES_ASSOCIATE",
      address: "Bandra West, Mumbai",
    },
  },
  products: {
    headers: ["name", "brand", /* "category", */ "price", "size", "coverageSqFt", "coverageRnFt", "hasToken"],
    required: ["name", "brand", "price"],
    numericFields: ["price", "coverageSqFt", "coverageRnFt"],
    booleanFields: ["hasToken"],
    downloadHeaders: ["id", "name", "brand", /* "category", */ "price", "size", "coverageSqFt", "coverageRnFt", "hasToken", "createdAt"],
    sampleRow: {
      name: "Royale Luxury Emulsion",
      brand: "Asian Paints",
      // category: "Interior", // Disabled - see Paints/SPEC_PRODUCT_CATEGORY.md
      price: "1850",
      size: "1ltr",
      coverageSqFt: "140",
      coverageRnFt: "90",
      hasToken: "No",
    },
  },
  interiors: {
    headers: ["name", "email", "phonenumber", "alternatePhonenumber", "address", "commissionFeePercentage"],
    required: ["name"],
    numericFields: ["commissionFeePercentage"],
    downloadHeaders: ["id", "name", "email", "phonenumber", "alternatePhonenumber", "address", "commissionFeePercentage", "createdAt"],
    sampleRow: {
      name: "Studio Design Works",
      email: "contact@studiodesign.com",
      phonenumber: "9988776655",
      alternatePhonenumber: "",
      address: "Indiranagar, Bangalore",
      commissionFeePercentage: "10",
    },
  },
  areas: {
    headers: ["name"],
    required: ["name"],
    downloadHeaders: ["id", "name", "createdAt"],
    sampleRow: {
      name: "Master Bedroom",
    },
  },
  labours: {
    headers: ["name", "paymentPerDay", "tuesdayPaymentAmount", "type", "phonenumber"],
    required: ["name", "paymentPerDay"],
    numericFields: ["paymentPerDay", "tuesdayPaymentAmount"],
    downloadHeaders: ["id", "name", "paymentPerDay", "tuesdayPaymentAmount", "type", "phonenumber", "createdAt"],
    sampleRow: {
      name: "Ramesh Painter",
      paymentPerDay: "750",
      tuesdayPaymentAmount: "300",
      type: "WEEKLY",
      phonenumber: "9870001122",
    },
  },
  contractors: {
    headers: ["name", "phonenumber", "email", "address", "type"],
    required: ["name"],
    downloadHeaders: ["id", "name", "phonenumber", "email", "address", "type", "createdAt"],
    sampleRow: {
      name: "Sunil Finishing Works",
      phonenumber: "9898989898",
      email: "sunil.contractor@gmail.com",
      address: "Sector 14, Gurgaon",
      type: "WEEKLY",
    },
  },
  colors: {
    headers: ["name", "shade"],
    required: ["name"],
    downloadHeaders: ["id", "name", "shade", "createdAt"],
    sampleRow: {
      name: "Morning Sky",
      shade: "AP-8201",
    },
  },
};

// Normalize string for robust header and key comparisons
function normalizeHeaderKey(str: string): string {
  return str.toLowerCase().replace(/[\s_\-./\\]+/g, "");
}

// Canonical aliases for master attributes
const HEADER_CANONICAL_ALIASES: Record<string, string> = {
  phone: "phonenumber",
  phoneno: "phonenumber",
  phonenumber: "phonenumber",
  mobilenumber: "phonenumber",
  mobile: "phonenumber",
  mobileno: "phonenumber",
  contact: "phonenumber",
  contactnumber: "phonenumber",
  telephonenumber: "phonenumber",

  altphone: "alternatePhonenumber",
  altphoneno: "alternatePhonenumber",
  alternatephone: "alternatePhonenumber",
  alternatephoneno: "alternatePhonenumber",
  alternatephonenumber: "alternatePhonenumber",
  secondaryphone: "alternatePhonenumber",
  altmobile: "alternatePhonenumber",

  paymentperday: "paymentPerDay",
  payperday: "paymentPerDay",
  dailyrate: "paymentPerDay",
  dailywage: "paymentPerDay",
  perday: "paymentPerDay",
  rateperday: "paymentPerDay",

  tuesdaypaymentamount: "tuesdayPaymentAmount",
  tuesdayamount: "tuesdayPaymentAmount",
  tuesdaypayment: "tuesdayPaymentAmount",
  tuesdaypay: "tuesdayPaymentAmount",
  mangalwaramount: "tuesdayPaymentAmount",

  commissionfeepercentage: "commissionFeePercentage",
  commissionpercentage: "commissionFeePercentage",
  commissionfee: "commissionFeePercentage",
  commission: "commissionFeePercentage",
  commissionpct: "commissionFeePercentage",

  coveragesqft: "coverageSqFt",
  coverageinsqft: "coverageSqFt",
  sqftcoverage: "coverageSqFt",
  sqft: "coverageSqFt",

  coveragernft: "coverageRnFt",
  coverageinrnft: "coverageRnFt",
  rnftcoverage: "coverageRnFt",
  rnft: "coverageRnFt",

  brand: "brand",
  brandname: "brand",
  brandid: "brand",

  hastoken: "hasToken",
  token: "hasToken",
  istoken: "hasToken",

  username: "username",
  user: "username",
  uname: "username",
  email: "email",
  emailid: "email",
  mail: "email",
  password: "password",
  pass: "password",
  address: "address",
  location: "address",
  // category: "category", // Category disabled - see Paints/SPEC_PRODUCT_CATEGORY.md
  // cat: "category",
  size: "size",
  packsize: "size",
  price: "price",
  priceperpack: "price",
  packprice: "price",
  rate: "price",
  cost: "price",
  unitprice: "price",
  name: "name",
  fullname: "name",
  shade: "shade",
  colorcode: "shade",
  description: "description",
  desc: "description",
  remarks: "description",
  role: "role",
  type: "type",
};

function matchHeaderToSchema(csvHdr: string, schemaHeaders: string[], resource?: string): string | undefined {
  const norm = normalizeHeaderKey(csvHdr);
  // 1. Direct normalized match
  const direct = schemaHeaders.find(sh => normalizeHeaderKey(sh) === norm);
  if (direct) return direct;

  // 2. Resource-specific entity name aliases
  if (schemaHeaders.includes("name")) {
    if (norm === "name" || norm === "fullname" || norm === "itemname") return "name";
    if (resource === "brands" && (norm === "brand" || norm === "brandname")) return "name";
    if (resource === "products" && (norm === "product" || norm === "productname")) return "name";
    if (resource === "customers" && (norm === "customer" || norm === "customername")) return "name";
    if (resource === "contractors" && (norm === "contractor" || norm === "contractorname")) return "name";
    if (resource === "labours" && (norm === "labour" || norm === "labourname" || norm === "worker" || norm === "workername")) return "name";
    if (resource === "interiors" && (norm === "interior" || norm === "interiorname" || norm === "designer" || norm === "designername")) return "name";
    if (resource === "areas" && (norm === "area" || norm === "areaname")) return "name";
    if (resource === "colors" && (norm === "color" || norm === "colorname")) return "name";
  }

  // 3. Alias lookup
  const canonical = HEADER_CANONICAL_ALIASES[norm];
  if (canonical) {
    const aliasMatch = schemaHeaders.find(sh => normalizeHeaderKey(sh) === normalizeHeaderKey(canonical));
    if (aliasMatch) return aliasMatch;
    const directAlias = schemaHeaders.find(sh => sh.toLowerCase() === canonical.toLowerCase());
    if (directAlias) return directAlias;
  }

  // 4. Suffix match for "...name" if schema has "name" and no other field matches
  if (schemaHeaders.includes("name") && norm.endsWith("name") && !schemaHeaders.some(sh => normalizeHeaderKey(sh) === norm)) {
    if (!(resource === "products" && (norm === "brandname" || norm === "brand"))) {
      return "name";
    }
  }

  return undefined;
}

function parseCleanNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;
  const cleaned = str.replace(/[₹$,%\s]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

// CSV parsing / generating helpers (handles RFC-4180 quotes, multiline cells, and Windows UTF-8 BOM)
function parseCSV(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, "");
  const result: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuote = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

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

function getValueByPath(item: any, path: string): any {
  if (item == null) return "";

  // Exact property match
  if (item[path] !== undefined && item[path] !== null) {
    const val = item[path];
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (typeof val === "object" && !(val instanceof Date)) {
      if ("name" in val) return val.name;
      if ("title" in val) return val.title;
      if ("username" in val) return val.username;
    }
    if (val instanceof Date) return val.toISOString();
    return val;
  }

  // Relations & Aliases
  if (path === "brand") return item.brand?.name || item.brandName || item.brandId || "";
  if (path === "customer") return item.customer?.name || item.customerName || item.customerId || "";
  if (path === "project") return item.project?.name || item.projectName || item.projectId || "";
  if (path === "user") return item.user?.username || item.user?.name || item.userId || "";
  if (path === "contractor") return item.contractor?.name || item.contractorId || "";
  if (path === "labour") return item.labour?.name || item.labourId || "";
  if (path === "area") return item.area?.name || item.areaId || "";
  if (path === "color") return item.color?.name || item.colorId || "";

  // Nested dot notation: "brand.name"
  if (path.includes(".")) {
    const parts = path.split(".");
    let curr = item;
    for (const part of parts) {
      if (curr == null) return "";
      curr = curr[part];
    }
    if (typeof curr === "boolean") return curr ? "Yes" : "No";
    return curr ?? "";
  }

  return "";
}

function jsonToCSV(headers: string[], data: any[]): string {
  const headerRow = headers.join(",");
  const rows = data.map(item => {
    return headers.map(header => {
      const val = getValueByPath(item, header);
      if (val == null || val === "") return '""';
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
  queryParams,
  embedded = false,
  titleClassName,
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

        const rawHeaders = parsed[0].map(h => h.trim());
        const colToSchemaHeader: (string | undefined)[] = rawHeaders.map(rh => matchHeaderToSchema(rh, schema.headers, resource));

        const matchedSchemaHeaderSet = new Set(colToSchemaHeader.filter(Boolean));
        const missingRequired = schema.required.filter(
          reqCol => !matchedSchemaHeaderSet.has(reqCol)
        );

        if (missingRequired.length > 0) {
          setImportErrors([
            `Missing required column headers: ${missingRequired.join(", ")}.`,
            `Found in CSV: ${rawHeaders.join(", ")}`,
            `Expected headers: ${schema.headers.join(", ")}`
          ]);
          setImportStatus("errors");
          return;
        }

        // If products, preload brands for name -> brandId resolution
        const brandsLookup: Map<string, string> = new Map();
        if (resource === "products") {
          try {
            const brandsList = await apiRequest.fetchAll<any>("brands", { limit: 1000 });
            if (Array.isArray(brandsList)) {
              brandsList.forEach(b => {
                if (b.name) brandsLookup.set(b.name.toLowerCase().trim(), b.id);
                if (b.id) brandsLookup.set(b.id.toLowerCase().trim(), b.id);
              });
            }
          } catch {
            // ignore if empty
          }
        }

        const rowsToImport: any[] = [];
        const errors: string[] = [];

        for (let rowIdx = 1; rowIdx < parsed.length; rowIdx++) {
          const row = parsed[rowIdx];
          if (row.length === 0 || row.every(cell => cell.trim() === "")) continue;

          const rowErrors: string[] = [];
          const rowObj: Record<string, string> = {};

          rawHeaders.forEach((_, colIdx) => {
            const schemaHeader = colToSchemaHeader[colIdx];
            if (schemaHeader) {
              rowObj[schemaHeader] = (row[colIdx] || "").trim();
            }
          });

          // Check required fields
          schema.required.forEach(reqField => {
            const val = rowObj[reqField];
            if (val === undefined || val === null || val.trim() === "") {
              rowErrors.push(`"${reqField}" is required`);
            }
          });

          // Validate numeric fields
          if (schema.numericFields) {
            schema.numericFields.forEach(numField => {
              const val = rowObj[numField];
              if (val !== undefined && val !== null && val.trim() !== "") {
                const cleanedNum = parseCleanNumber(val);
                if (cleanedNum === null) {
                  rowErrors.push(`"${numField}" must be a valid number`);
                }
              }
            });
          }

          // Resource-specific validations & mappings
          const cleanedPayload: Record<string, any> = {};

          if (resource === "products") {
            const brandInput = (rowObj.brand || rowObj.brandId || "").trim();
            if (!brandInput) {
              rowErrors.push('"brand" is required');
            } else {
              const matchedId = brandsLookup.get(brandInput.toLowerCase());
              if (!matchedId) {
                rowErrors.push(`Brand "${brandInput}" does not exist. Please create it under Brands master first.`);
              } else {
                cleanedPayload.brandId = matchedId;
              }
            }
            if (rowObj.price !== undefined && rowObj.price !== "") {
              cleanedPayload.price = parseCleanNumber(rowObj.price);
            }
            cleanedPayload.size = rowObj.size?.trim() || "1ltr";
            // cleanedPayload.category = rowObj.category?.trim() || "Emulsion"; // Category disabled - see Paints/SPEC_PRODUCT_CATEGORY.md
            cleanedPayload.hasToken = ["true", "yes", "1", "y"].includes((rowObj.hasToken || "").trim().toLowerCase());
            if (rowObj.coverageSqFt !== undefined && rowObj.coverageSqFt !== "") {
              cleanedPayload.coverageSqFt = parseCleanNumber(rowObj.coverageSqFt);
            }
            if (rowObj.coverageRnFt !== undefined && rowObj.coverageRnFt !== "") {
              cleanedPayload.coverageRnFt = parseCleanNumber(rowObj.coverageRnFt);
            }
          }

          if (resource === "labours") {
            if (rowObj.paymentPerDay !== undefined && rowObj.paymentPerDay !== "") {
              cleanedPayload.paymentPerDay = parseCleanNumber(rowObj.paymentPerDay);
            }
            if (rowObj.tuesdayPaymentAmount !== undefined && rowObj.tuesdayPaymentAmount !== "") {
              cleanedPayload.tuesdayPaymentAmount = parseCleanNumber(rowObj.tuesdayPaymentAmount) ?? 0;
            }
            const tVal = (rowObj.type || "").trim().toUpperCase();
            cleanedPayload.type = tVal === "MONTHLY" ? "MONTHLY" : "WEEKLY";
          }

          if (resource === "contractors") {
            const tVal = (rowObj.type || "").trim().toUpperCase();
            cleanedPayload.type = tVal === "MONTHLY" ? "MONTHLY" : "WEEKLY";
          }

          if (resource === "interiors") {
            if (rowObj.commissionFeePercentage !== undefined && rowObj.commissionFeePercentage !== "") {
              cleanedPayload.commissionFeePercentage = parseCleanNumber(rowObj.commissionFeePercentage);
            }
          }

          if (resource === "users") {
            const rVal = (rowObj.role || "").trim().toUpperCase();
            cleanedPayload.role = ["USER", "ADMIN", "INTERIOR", "SALES_ASSOCIATE", "SUPERVISOR"].includes(rVal) ? rVal : (importExtraData?.role || "USER");
            cleanedPayload.password = rowObj.password?.trim() || "User@123";
          }

          if (resource === "colors") {
            cleanedPayload.shade = rowObj.shade?.trim() || null;
          }

          if (rowErrors.length > 0) {
            errors.push(`Row ${rowIdx + 1}: ${rowErrors.join(", ")}`);
          } else {
            const allowedFields = CSV_RESOURCE_FIELDS[resource || ""] || [];
            schema.headers.forEach(h => {
              const val = rowObj[h];
              if (val !== undefined && val !== null && val.trim() !== "" && cleanedPayload[h] === undefined) {
                cleanedPayload[h] = val.trim();
              }
            });

            const finalPayload = Object.fromEntries(
              Object.entries(cleanedPayload).filter(([k]) => allowedFields.includes(k) || k === "password")
            );

            rowsToImport.push(finalPayload);
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

      // Fetch all items from the database with a high limit
      let allItems: any[] = [];
      try {
        const result = await apiRequest.fetchAll(resource, { limit: 10000, ...queryParams });
        allItems = Array.isArray(result) ? result : [];
      } catch (fetchErr: any) {
        if (fetchErr?.status === 404 || fetchErr?.message?.toLowerCase().includes("not found")) {
          allItems = [];
        } else {
          throw fetchErr;
        }
      }

      if (allItems.length === 0) {
        toast({
          title: "No records to export",
          description: `No records found in "${resource}". Generating template headers.`,
        });
      }

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

    let sampleRowStr = "";
    if (schema.sampleRow) {
      sampleRowStr = schema.headers.map(h => {
        const val = schema.sampleRow?.[h] ?? `Sample_${h}`;
        const strVal = String(val).replace(/"/g, '""');
        return strVal.includes(",") || strVal.includes("\n") || strVal.includes('"') ? `"${strVal}"` : strVal;
      }).join(",");
    } else {
      sampleRowStr = schema.headers.map(h => `Sample_${h}`).join(",");
    }

    const csvContent = schema.headers.join(",") + "\n" + sampleRowStr;
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
          <h1 className={titleClassName || (embedded ? "text-sm font-semibold text-slate-800 dark:text-slate-200 select-none" : "text-2xl font-bold font-display text-foreground select-none")}>
            {title}
          </h1>
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
            <DialogDescription className="sr-only">Upload and import CSV data records</DialogDescription>
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

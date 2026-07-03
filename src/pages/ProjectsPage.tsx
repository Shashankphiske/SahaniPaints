import { useState, useMemo, useEffect } from "react";
import { useMasterData } from "../hooks/use-master-data";
import { apiRequest } from "../lib/api";
import type { Project, Customer, Product, LabourAttendance, LabourPayment } from "../types/master";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "../hooks/use-toast";
import {
  Loader2,
  Plus,
  Trash2,
  Download,
  Check,
  X,
  ArrowLeft,
  IndianRupee,
  Search,
  Calendar,
  FolderOpen,
  AlertTriangle,
  Building,
  TrendingUp,
  Hammer,
  ClipboardCheck,
  DollarSign,
  PackageCheck,
  ChevronDown
} from "lucide-react";
import { generateQuotationPDF } from "../utils/quotationPdfGenerator";
import TasksPage from "./TasksPage";

// Format currency
function fmt(n: any) {
  return (Number(n) || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

// Format date helper: "dd MMM yyyy"
const formatDate = (dateStr: any) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400",
  ACTIVE: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
  GOODS_PENDING: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400",
  GOODS_COMPLETE: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400",
  TAILOR_PENDING: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400",
  TAILOR_COMPLETE: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400",
  DEFAULTER: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-400",
};

interface PaintProductRow {
  productId: string;
  area: number;
  unit: "sq.ft" | "rn.ft";
  rate: number;
  litresUsed?: number | null;
}

export default function ProjectsPage() {
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Load projects, customers, products
  const projectsData = useMasterData<Project>("projects", true, undefined, true);
  const customersData = useMasterData<Customer>("customers", true);
  const productsData = useMasterData<Product>("products", true);

  const projects = useMemo(() => {
    return Array.isArray(projectsData.data) ? projectsData.data : [];
  }, [projectsData.data]);

  const customers = useMemo(() => {
    return Array.isArray(customersData.data) ? customersData.data : [];
  }, [customersData.data]);

  const products = useMemo(() => {
    return Array.isArray(productsData.data) ? productsData.data : [];
  }, [productsData.data]);

  // Project detail fetcher for single project detail tabs
  const [fullProject, setFullProject] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchFullProjectDetails = async (id: string) => {
    setLoadingDetails(true);
    try {
      const res = await apiRequest.execute<any>(`/projects/${id}`);
      setFullProject(res);
    } catch (err: any) {
      toast({
        title: "Error fetching project details",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (viewingProject) {
      fetchFullProjectDetails(viewingProject.id);
    } else {
      setFullProject(null);
    }
  }, [viewingProject]);

  // Search & Filter listing state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = !statusFilter || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  // Delete project handler
  const handleDeleteProject = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      projectsData.remove(id);
      toast({
        title: "Project Deleted",
        description: "The project has been successfully deleted.",
      });
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header Section */}
        {!isCreating && !viewingProject && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display flex items-center gap-2">
                <FolderOpen className="h-7 w-7 text-primary" />
                Paints Projects
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage painting contracts, materials, crew, and finances.
              </p>
            </div>
            <Button onClick={() => setIsCreating(true)} className="font-bold flex items-center gap-1.5 shadow-sm">
              <Plus className="h-4.5 w-4.5" />
              Add Project
            </Button>
          </div>
        )}

        {/* List View */}
        {!isCreating && !viewingProject && (
          <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-md">
            <CardHeader className="p-5 pb-3">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by project or customer..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-10 w-full md:w-48 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="ACTIVE">Active</option>
                    <option value="GOODS_PENDING">Goods Pending</option>
                    <option value="GOODS_COMPLETE">Goods Complete</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="DEFAULTER">Defaulter</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {projectsData.isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-sm font-semibold text-muted-foreground">Loading projects...</span>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground space-y-2">
                  <FolderOpen className="h-12 w-12 mx-auto text-slate-300" />
                  <h3 className="font-bold text-slate-700 dark:text-slate-300">No Projects Found</h3>
                  <p className="text-sm max-w-sm mx-auto">Create a new painting contract to start managing material selection and attendance ledger.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project Name</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Deadline Date</TableHead>
                        <TableHead>Total Charges</TableHead>
                        <TableHead>Agreed Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjects.map((project) => (
                        <TableRow
                          key={project.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 cursor-pointer"
                        >
                          <TableCell
                            className="font-semibold text-slate-900 dark:text-slate-100"
                            onClick={() => setViewingProject(project)}
                          >
                            {project.name}
                          </TableCell>
                          <TableCell onClick={() => setViewingProject(project)}>
                            {project.customer?.name || "—"}
                          </TableCell>
                          <TableCell onClick={() => setViewingProject(project)}>
                            {formatDate(project.projectDate)}
                          </TableCell>
                          <TableCell onClick={() => setViewingProject(project)}>
                            ₹{fmt(project.totalAmount)}
                          </TableCell>
                          <TableCell onClick={() => setViewingProject(project)}>
                            ₹{fmt(project.agreedPrice || project.totalAmount)}
                          </TableCell>
                          <TableCell onClick={() => setViewingProject(project)}>
                            <Badge
                              variant="outline"
                              className={`${STATUS_STYLES[project.status]} border font-semibold px-2 py-0.5 rounded-full`}
                            >
                              {project.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  // Quick quotation download
                                  downloadQuotationPDFHelper(project, products);
                                }}
                                title="Download Quotation PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteProject(project.id)}
                                title="Delete Project"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Project Form View */}
        {isCreating && (
          <CreateProjectForm
            customers={customers}
            products={products}
            onCancel={() => setIsCreating(false)}
            onSave={async (projectPayload) => {
              try {
                await projectsData.createAsync(projectPayload);
                setIsCreating(false);
                toast({
                  title: "Project Added",
                  description: "New paint project has been successfully created.",
                });
              } catch (err: any) {
                toast({
                  title: "Failed to Add Project",
                  description: err.message || "An error occurred.",
                  variant: "destructive",
                });
              }
            }}
          />
        )}

        {/* View / Edit Project Detail Tabs Panel */}
        {viewingProject && (
          <ProjectDetailView
            project={viewingProject}
            fullProject={fullProject}
            loadingDetails={loadingDetails}
            products={products}
            customers={customers}
            onBack={() => {
              setViewingProject(null);
              projectsData.forceServerSearch(""); // Refresh cache list
            }}
            onRefresh={() => fetchFullProjectDetails(viewingProject.id)}
          />
        )}
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── CREATE PROJECT FORM COMPONENT ─────────────────────── */
/* ──────────────────────────────────────────────────────── */
interface CreateProjectFormProps {
  customers: Customer[];
  products: Product[];
  onCancel: () => void;
  onSave: (payload: any) => Promise<void>;
}

function CreateProjectForm({ customers, products, onCancel, onSave }: CreateProjectFormProps) {
  // Form fields
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [projectDate, setProjectDate] = useState("");
  const [status, setStatus] = useState<any>("PENDING");

  // Selected products rows
  const [rows, setRows] = useState<PaintProductRow[]>([
    { productId: "", area: 0, unit: "sq.ft", rate: 0 },
  ]);

  // Tax and Discount
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [showAdvancedPricing, setShowAdvancedPricing] = useState(false);

  const [agreedPrice, setAgreedPrice] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => {
    return rows.reduce((sum, row) => sum + (row.rate * row.area || 0), 0);
  }, [rows]);

  const taxAmount = useMemo(() => (subtotal * taxRate) / 100, [subtotal, taxRate]);

  const discountAmount = useMemo(() => {
    if (discountType === "percent") return (subtotal * discount) / 100;
    return discount;
  }, [subtotal, discount, discountType]);

  const computedAgreedPrice = useMemo(() => {
    return Math.max(0, subtotal + taxAmount - discountAmount);
  }, [subtotal, taxAmount, discountAmount]);

  const finalPrice = agreedPrice !== "" ? Number(agreedPrice) : computedAgreedPrice;

  const handleAddRow = () => {
    setRows((prev) => [...prev, { productId: "", area: 0, unit: "sq.ft", rate: 0 }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      setRows([{ productId: "", area: 0, unit: "sq.ft", rate: 0 }]);
    } else {
      setRows((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleRowChange = (index: number, key: keyof PaintProductRow, value: any) => {
    setRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [key]: value };

      if (key === "productId" || key === "unit") {
        const prod = products.find((p) => p.id === row.productId);
        if (prod) {
          const coverage = row.unit === "sq.ft" ? Number(prod.coverageSqFt) : Number(prod.coverageRnFt);
          row.rate = coverage && coverage > 0 ? Number(prod.price) / coverage : 0;
        } else {
          row.rate = 0;
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please fill in the project name.");
      return;
    }
    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    const filteredRows = rows.filter((r) => r.productId && r.area > 0);
    if (filteredRows.length === 0) {
      alert("Please add at least one product line item with an area greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const cust = customers.find((c) => c.id === customerId);
      const payload = {
        name,
        customerId,
        _customerName: cust?.name,
        projectDate: new Date(projectDate).toISOString(),
        status,
        totalAmount: subtotal,
        tax: taxRate,
        discount,
        discountType,
        agreedPrice: finalPrice,
        projectProducts: filteredRows.map((r) => ({
          productId: r.productId,
          area: r.area,
          unit: r.unit,
          rate: r.rate,
        })),
      };
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadQuotation = () => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) {
      alert("Please select a customer first.");
      return;
    }
    const filteredRows = rows.filter((r) => r.productId && r.area > 0);
    if (filteredRows.length === 0) {
      alert("Please add product selections to generate quotation.");
      return;
    }

    const productsForPDF = filteredRows.map((r) => {
      const prod = products.find((p) => p.id === r.productId);
      return {
        productName: prod?.name || "Paint Product",
        brandName: prod?.brand?.name,
        area: r.area,
        unit: r.unit,
        rate: r.rate,
        total: r.rate * r.area,
      };
    });

    generateQuotationPDF({
      projectName: name || "Paint Contract Quotation",
      projectDate,
      customer: {
        name: cust.name,
        phonenumber: cust.phonenumber,
        email: cust.email,
        address: cust.address,
      },
      creatorName: "Sales Associate",
      products: productsForPDF,
      summary: {
        subtotal,
        tax: taxRate,
        taxAmount,
        discount,
        discountType,
        discountAmount,
        agreedPrice: finalPrice,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onCancel} className="h-9 w-9 p-0 rounded-full border">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div>
          <h2 className="text-lg font-bold font-display text-slate-800 dark:text-slate-200">New Painting Project</h2>
          <p className="text-xs text-muted-foreground">Add project details and select products.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* LEFT COLUMN — main flow */}
          <div className="space-y-6 min-w-0">
            {/* Step 1: Project details */}
            <section className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800/80">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-900">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project Details</h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block">
                    Project / Site Name
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="e.g. Sahani Apartment Penthouse"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground block">Customer</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="">Select customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground block">Deadline Date</label>
                  <Input
                    type="date"
                    value={projectDate}
                    onChange={(e) => setProjectDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </section>

            {/* Step 2: Products */}
            <section className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800/80">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-900 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Products</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  className="font-medium flex items-center gap-1 text-xs h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add product
                </Button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-zinc-900">
                {rows.map((row, idx) => (
                  <div key={idx} className="p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <select
                        value={row.productId}
                        onChange={(e) => handleRowChange(idx, "productId", e.target.value)}
                        className="flex h-10 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Choose product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{Number(p.price)}/L)
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 w-10 shrink-0 p-0 text-slate-400 hover:text-red-500 rounded-full"
                        onClick={() => handleRemoveRow(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground block">Area</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={row.area || ""}
                          onChange={(e) => handleRowChange(idx, "area", Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground block">Unit</label>
                        <select
                          value={row.unit}
                          onChange={(e) => handleRowChange(idx, "unit", e.target.value)}
                          className="flex h-10 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="sq.ft">sq.ft</option>
                          <option value="rn.ft">rn.ft</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground block">Rate (₹)</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={row.rate || ""}
                          onChange={(e) => handleRowChange(idx, "rate", Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end text-sm">
                      <span className="text-muted-foreground mr-1">Line total:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        ₹{fmt(row.rate * row.area || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Step 3: Tax & discount (collapsed by default) */}
            <section className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={() => setShowAdvancedPricing((v) => !v)}
                className="w-full px-5 py-3 flex items-center justify-between text-left"
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tax & Discount</h3>
                  <p className="text-xs text-muted-foreground">
                    {taxRate || discount
                      ? `Tax ${taxRate}% · Discount ${discountType === "percent" ? `${discount}%` : `₹${fmt(discount)}`}`
                      : "Optional — none applied"}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showAdvancedPricing ? "rotate-180" : ""}`} />
              </button>

              {showAdvancedPricing && (
                <div className="px-5 pb-5 grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-zinc-900 pt-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground block">Tax Rate (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={taxRate || ""}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground block">Discount</label>
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        min="0"
                        value={discount || ""}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        placeholder="0"
                        className="flex-1"
                      />
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as any)}
                        className="flex h-10 w-16 rounded-lg border border-input bg-background px-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="amount">₹</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN — sticky summary */}
          <div className="lg:sticky lg:top-4 space-y-4">
            <div className="bg-slate-50/60 dark:bg-zinc-900/40 p-5 rounded-xl border border-slate-200/60 dark:border-zinc-800/50 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Summary</h3>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">₹{fmt(subtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax ({taxRate}%)</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">+ ₹{fmt(taxAmount)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Discount</span>
                    <span className="font-medium text-rose-600 dark:text-rose-400">- ₹{fmt(discountAmount)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1 pt-3 border-t border-slate-200 dark:border-zinc-800">
                <label className="text-xs font-medium text-muted-foreground block">Final Agreed Price</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="number"
                    min="0"
                    value={agreedPrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAgreedPrice(val === "" ? "" : Number(val));
                    }}
                    className="pl-9 font-semibold"
                    placeholder={`${fmt(computedAgreedPrice)}`}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Leave blank to use the calculated total.</p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-baseline">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total</span>
                <span className="text-2xl font-bold text-primary flex items-center">
                  <IndianRupee className="h-5 w-5 mr-0.5 shrink-0" />
                  {fmt(finalPrice)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Button type="submit" disabled={saving} className="w-full font-semibold">
                {saving ? "Creating Project..." : "Add Project"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleDownloadQuotation}
                className="w-full flex items-center justify-center gap-1.5 font-medium"
              >
                <Download className="h-4 w-4" />
                Download Quotation
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── PROJECT VIEW / EDIT TABS PANEL ────────────────────── */
/* ──────────────────────────────────────────────────────── */
interface ProjectDetailViewProps {
  project: Project;
  fullProject: any | null;
  loadingDetails: boolean;
  products: Product[];
  customers: Customer[];
  onBack: () => void;
  onRefresh: () => void;
}

function ProjectDetailView({
  project,
  fullProject,
  loadingDetails,
  products,
  customers,
  onBack,
  onRefresh,
}: ProjectDetailViewProps) {
  const [activeTab, setActiveTab] = useState("overview");

  if (loadingDetails || !fullProject) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-semibold text-slate-500 animate-pulse">Loading project details & ledgers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Detail header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-900 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="h-9 w-9 p-0 rounded-full border">
            <ArrowLeft className="h-4.5 w-4.5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold font-display text-slate-800 dark:text-slate-200">
                {fullProject.name}
              </h2>
              <Badge variant="outline" className={`${STATUS_STYLES[fullProject.status]} font-bold`}>
                {fullProject.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Customer: {fullProject.customer?.name} | Deadline: {formatDate(fullProject.projectDate)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Convert projectProducts to matching options structure
              const productsForPDF = (fullProject.projectProducts ?? []).map((pp: any) => ({
                productName: pp.product?.name || "Paint Product",
                brandName: pp.product?.brand?.name,
                area: Number(pp.area),
                unit: pp.unit,
                rate: Number(pp.rate),
                total: Number(pp.rate) * Number(pp.area),
              }));

              generateQuotationPDF({
                projectName: fullProject.name,
                projectDate: fullProject.projectDate,
                customer: {
                  name: fullProject.customer?.name || "Client",
                  phonenumber: fullProject.customer?.phonenumber,
                  email: fullProject.customer?.email,
                  address: fullProject.customer?.address,
                },
                creatorName: fullProject.creator?.username || "Sales Associate",
                products: productsForPDF,
                summary: {
                  subtotal: Number(fullProject.totalAmount),
                  tax: Number(fullProject.tax || 0),
                  taxAmount: (Number(fullProject.totalAmount) * Number(fullProject.tax || 0)) / 100,
                  discount: Number(fullProject.discount || 0),
                  discountType: (fullProject.discountType || "amount") as any,
                  discountAmount: fullProject.discountType === "percent"
                    ? (Number(fullProject.totalAmount) * Number(fullProject.discount || 0)) / 100
                    : Number(fullProject.discount || 0),
                  agreedPrice: Number(fullProject.agreedPrice || fullProject.totalAmount),
                },
              });
            }}
            className="flex items-center gap-1 text-xs"
          >
            <Download className="h-4 w-4" />
            Quotation
          </Button>
        </div>
      </div>

      {/* Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl max-w-full">
          <TabsTrigger value="overview" className="rounded-lg text-xs font-bold py-1.5 px-3">
            Overview / Edit
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-lg text-xs font-bold py-1.5 px-3">
            Selected Products
          </TabsTrigger>
          <TabsTrigger value="quotation" className="rounded-lg text-xs font-bold py-1.5 px-3">
            Quotation
          </TabsTrigger>
          <TabsTrigger value="profitloss" className="rounded-lg text-xs font-bold py-1.5 px-3">
            Profit / Loss
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CONSOLIDATED OVERVIEW & SPEC DETAILS */}
        <TabsContent value="overview">
          <OverviewEditTab
            fullProject={fullProject}
            customers={customers}
            onSuccess={onRefresh}
          />
        </TabsContent>

        {/* TAB 2: PRODUCT CONTRACT SELECTIONS */}
        <TabsContent value="products">
          <SelectedProductsTab
            fullProject={fullProject}
            products={products}
            onSuccess={onRefresh}
          />
        </TabsContent>

        {/* TAB 3: TAX, DISCOUNT & QUOTATION SUMMARY */}
        <TabsContent value="quotation">
          <QuotationTab
            fullProject={fullProject}
            onSuccess={onRefresh}
          />
        </TabsContent>

        {/* TAB 4: PROFIT & LOSS CALCULATOR */}
        <TabsContent value="profitloss">
          <ProfitLossTab fullProject={fullProject} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: OVERVIEW & PRODUCT EDITOR ─────────────── */
/* ──────────────────────────────────────────────────────── */
interface OverviewEditTabProps {
  fullProject: any;
  customers: Customer[];
  onSuccess: () => void;
}

function OverviewEditTab({ fullProject, customers, onSuccess }: OverviewEditTabProps) {
  const [name, setName] = useState(fullProject.name);
  const [customerId, setCustomerId] = useState(fullProject.customerId || "");
  const [projectDate, setProjectDate] = useState(() => {
    return fullProject.projectDate ? new Date(fullProject.projectDate).toISOString().split("T")[0] : "";
  });
  const [status, setStatus] = useState<any>(fullProject.status);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(fullProject.name);
    setCustomerId(fullProject.customerId || "");
    setProjectDate(fullProject.projectDate ? new Date(fullProject.projectDate).toISOString().split("T")[0] : "");
    setStatus(fullProject.status);
  }, [fullProject]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const cust = customers.find((c) => c.id === customerId);
      const payload = {
        name,
        customerId,
        _customerName: cust?.name,
        projectDate: new Date(projectDate).toISOString(),
        status,
        totalAmount: Number(fullProject.totalAmount),
        tax: Number(fullProject.tax || 0),
        discount: Number(fullProject.discount || 0),
        discountType: fullProject.discountType || "amount",
        agreedPrice: Number(fullProject.agreedPrice || fullProject.totalAmount),
        projectProducts: (fullProject.projectProducts || []).map((pp: any) => ({
          productId: pp.productId,
          area: Number(pp.area),
          unit: pp.unit,
          rate: Number(pp.rate),
          litresUsed: pp.litresUsed,
        })),
      };

      await apiRequest.update("projects", fullProject.id, payload as any);
      toast({
        title: "Project Details Saved",
        description: "General project information has been updated.",
      });
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* General Details */}
      <form onSubmit={handleUpdate} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
          <div className="space-y-1 md:col-span-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Project / Site Name *
            </span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Customer *
            </span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none"
              required
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Deadline Date *
            </span>
            <Input type="date" value={projectDate} onChange={(e) => setProjectDate(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
            >
              <option value="PENDING">Pending</option>
              <option value="ACTIVE">Active</option>
              <option value="GOODS_PENDING">Goods Pending</option>
              <option value="GOODS_COMPLETE">Goods Complete</option>
              <option value="COMPLETED">Completed</option>
              <option value="DEFAULTER">Defaulter</option>
            </select>
          </div>
          <div className="flex justify-end pt-2 col-span-1 md:col-span-4 border-t border-slate-100 dark:border-zinc-900 mt-2">
            <Button type="submit" disabled={saving} size="sm" className="font-bold">
              {saving ? "Saving Details..." : "Save Details"}
            </Button>
          </div>
        </div>
      </form>

      {/* Material Used Section */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
        <MaterialUsedTab
          projectId={fullProject.id}
          projectProducts={fullProject.projectProducts || []}
          onSuccess={onSuccess}
        />
      </div>

      {/* Measurements Section */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
        <MeasurementsTab projectProducts={fullProject.projectProducts || []} />
      </div>

      {/* Labour Section */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
        <LabourCrewTab attendance={fullProject.attendance || []} />
      </div>

      {/* Tasks Section */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tasks</h3>
          <p className="text-xs text-muted-foreground">Manage and track project checklist items.</p>
        </div>
        <TasksPage projectId={fullProject.id} />
      </div>

      {/* Payments Section */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
        <PaymentsTab fullProject={fullProject} onSuccess={onSuccess} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: SELECTED PRODUCTS ────────────────────── */
/* ──────────────────────────────────────────────────────── */
interface SelectedProductsTabProps {
  fullProject: any;
  products: Product[];
  onSuccess: () => void;
}

function SelectedProductsTab({ fullProject, products, onSuccess }: SelectedProductsTabProps) {
  const [rows, setRows] = useState<PaintProductRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fullProject.projectProducts) {
      setRows(
        fullProject.projectProducts.map((pp: any) => ({
          productId: pp.productId,
          area: Number(pp.area),
          unit: pp.unit as any,
          rate: Number(pp.rate),
          litresUsed: pp.litresUsed != null ? Number(pp.litresUsed) : null,
        }))
      );
    }
  }, [fullProject.projectProducts]);

  const handleAddRow = () => {
    setRows((prev) => [...prev, { productId: "", area: 0, unit: "sq.ft", rate: 0 }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      setRows([{ productId: "", area: 0, unit: "sq.ft", rate: 0 }]);
    } else {
      setRows((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleRowChange = (index: number, key: keyof PaintProductRow, value: any) => {
    setRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [key]: value };

      if (key === "productId" || key === "unit") {
        const prod = products.find((p) => p.id === row.productId);
        if (prod) {
          const coverage = row.unit === "sq.ft" ? Number(prod.coverageSqFt) : Number(prod.coverageRnFt);
          if (coverage && coverage > 0) {
            row.rate = Number(prod.price) / coverage;
          } else {
            row.rate = 0;
          }
        } else {
          row.rate = 0;
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const filteredRows = rows.filter((r) => r.productId && r.area > 0);
    if (filteredRows.length === 0) {
      alert("Please select at least one product with area > 0.");
      return;
    }

    setSaving(true);
    try {
      const newSubtotal = filteredRows.reduce((sum, r) => sum + (r.rate * r.area || 0), 0);
      const payload = {
        name: fullProject.name,
        customerId: fullProject.customerId,
        _customerName: fullProject.customer?.name,
        projectDate: fullProject.projectDate,
        status: fullProject.status,
        totalAmount: newSubtotal,
        tax: Number(fullProject.tax || 0),
        discount: Number(fullProject.discount || 0),
        discountType: fullProject.discountType || "amount",
        agreedPrice: Number(fullProject.agreedPrice || newSubtotal),
        projectProducts: filteredRows.map((r) => ({
          productId: r.productId,
          area: r.area,
          unit: r.unit,
          rate: r.rate,
          litresUsed: r.litresUsed,
        })),
      };

      await apiRequest.update("projects", fullProject.id, payload as any);
      toast({
        title: "Selected Products Saved",
        description: "Contract product selections have been successfully updated.",
      });
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Selected Products
            </CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            className="font-bold flex items-center gap-1 text-xs border border-primary/20 hover:bg-primary/5 text-primary h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30">
                  <TableHead className="w-5/12">Product Description</TableHead>
                  <TableHead className="w-2/12">Designated Area</TableHead>
                  <TableHead className="w-2/12">Unit Option</TableHead>
                  <TableHead className="w-2/12">Rate (₹/Unit)</TableHead>
                  <TableHead className="w-1/12 text-right">Total</TableHead>
                  <TableHead className="w-10 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="p-3">
                      <select
                        value={row.productId}
                        onChange={(e) => handleRowChange(idx, "productId", e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                      >
                        <option value="">Choose Product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{Number(p.price)}/L)
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="p-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.area || ""}
                        onChange={(e) => handleRowChange(idx, "area", Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell className="p-3">
                      <select
                        value={row.unit}
                        onChange={(e) => handleRowChange(idx, "unit", e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
                      >
                        <option value="sq.ft">sq.ft</option>
                        <option value="rn.ft">rn.ft</option>
                      </select>
                    </TableCell>
                    <TableCell className="p-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.rate || ""}
                        onChange={(e) => handleRowChange(idx, "rate", Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell className="p-3 text-right font-semibold">
                      ₹{fmt(row.rate * row.area || 0)}
                    </TableCell>
                    <TableCell className="p-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 rounded-full"
                        onClick={() => handleRemoveRow(idx)}
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-900">
        <Button type="submit" disabled={saving} className="font-bold">
          {saving ? "Saving Products..." : "Save Products"}
        </Button>
      </div>
    </form>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: QUOTATION ────────────────────────────── */
/* ──────────────────────────────────────────────────────── */
interface QuotationTabProps {
  fullProject: any;
  onSuccess: () => void;
}

function QuotationTab({ fullProject, onSuccess }: QuotationTabProps) {
  const [taxRate, setTaxRate] = useState(Number(fullProject.tax || 0));
  const [discount, setDiscount] = useState(Number(fullProject.discount || 0));
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    (fullProject.discountType || "amount") as any
  );
  const [agreedPrice, setAgreedPrice] = useState<number>(Number(fullProject.agreedPrice || 0));
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => {
    const projectProducts = fullProject.projectProducts ?? [];
    return projectProducts.reduce((sum: number, pp: any) => sum + (Number(pp.rate) * Number(pp.area) || 0), 0);
  }, [fullProject.projectProducts]);

  const taxAmount = useMemo(() => {
    return (subtotal * taxRate) / 100;
  }, [subtotal, taxRate]);

  const discountAmount = useMemo(() => {
    if (discountType === "percent") {
      return (subtotal * discount) / 100;
    }
    return discount;
  }, [subtotal, discount, discountType]);

  const computedAgreedPrice = useMemo(() => {
    return Math.max(0, subtotal + taxAmount - discountAmount);
  }, [subtotal, taxAmount, discountAmount]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const finalPrice = agreedPrice !== undefined ? Number(agreedPrice) : computedAgreedPrice;
      const payload = {
        name: fullProject.name,
        customerId: fullProject.customerId,
        _customerName: fullProject.customer?.name,
        projectDate: fullProject.projectDate,
        status: fullProject.status,
        totalAmount: subtotal,
        tax: taxRate,
        discount,
        discountType,
        agreedPrice: finalPrice,
        projectProducts: (fullProject.projectProducts || []).map((pp: any) => ({
          productId: pp.productId,
          area: Number(pp.area),
          unit: pp.unit,
          rate: Number(pp.rate),
          litresUsed: pp.litresUsed,
        })),
      };

      await apiRequest.update("projects", fullProject.id, payload as any);
      toast({
        title: "Quotation Settings Saved",
        description: "Tax, discounts, and agreed price updated successfully.",
      });
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-50/40 dark:bg-zinc-900/20 p-5 rounded-xl border border-slate-200/50 dark:border-zinc-800/50 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Tax & Discounts
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Tax Rate (%)</span>
              <Input
                type="number"
                min="0"
                max="100"
                value={taxRate || ""}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Discount Value</span>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  min="0"
                  value={discount || ""}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="flex-1"
                />
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="flex h-10 w-20 rounded-lg border border-input bg-background px-2.5 py-2 text-sm focus-visible:outline-none"
                >
                  <option value="amount">₹</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Final Agreed Price (₹)</span>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="number"
                min="0"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(Number(e.target.value))}
                className="pl-9 font-bold"
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-50/60 dark:bg-zinc-900/40 p-5 rounded-xl border border-slate-200/60 dark:border-zinc-800/50 shadow-sm-soft flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Charges Summary
            </h3>
            <div className="space-y-2 text-sm border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Subtotal (Charges):</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">₹{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">GST / Tax ({taxRate}%):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+ ₹{fmt(taxAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Discount Applied:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">- ₹{fmt(discountAmount)}</span>
              </div>
            </div>
          </div>
          <div className="pt-4 flex justify-between items-baseline">
            <span className="font-extrabold text-slate-400 text-xs uppercase tracking-widest">Agreed Quote Total</span>
            <span className="text-3xl font-extrabold text-primary flex items-center">
              <IndianRupee className="h-6 w-6 mr-0.5" />
              {fmt(agreedPrice !== undefined ? agreedPrice : computedAgreedPrice)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-900">
        <Button type="submit" disabled={saving} className="font-bold">
          {saving ? "Saving Quotation..." : "Save Quotation"}
        </Button>
      </div>
    </form>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: MATERIAL USED & COVERAGE ──────────────── */
/* ──────────────────────────────────────────────────────── */
interface MaterialUsedTabProps {
  projectId: string;
  projectProducts: any[];
  onSuccess: () => void;
}

function MaterialUsedTab({ projectId, projectProducts, onSuccess }: MaterialUsedTabProps) {
  const [litresState, setLitresState] = useState<Record<string, number | "">>({});
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const state: Record<string, number | ""> = {};
    projectProducts.forEach((pp) => {
      state[pp.id] = pp.litresUsed != null ? Number(pp.litresUsed) : "";
    });
    setLitresState(state);
  }, [projectProducts]);

  const handleLitresChange = (id: string, value: string) => {
    setLitresState((prev) => ({
      ...prev,
      [id]: value === "" ? "" : Number(value),
    }));
  };

  const handleSaveLitres = async () => {
    setUpdating(true);
    try {
      const payloadProducts = projectProducts.map((pp) => {
        const inputVal = litresState[pp.id];
        return {
          productId: pp.productId,
          area: Number(pp.area),
          unit: pp.unit,
          rate: Number(pp.rate),
          litresUsed: inputVal === "" ? null : Number(inputVal),
        };
      });

      await apiRequest.update("projects", projectId, {
        projectProducts: payloadProducts,
      } as any);

      toast({
        title: "Material Usage Saved",
        description: "Actual litres used and coverages updated.",
      });
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Failed to Save",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Material Usage</h3>
          <p className="text-xs text-muted-foreground">Log litres used on-site to view paint coverage efficiency.</p>
        </div>
        <Button onClick={handleSaveLitres} disabled={updating} size="sm" className="font-bold">
          {updating ? "Saving..." : "Save Material Usage"}
        </Button>
      </div>

      <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Litres Used</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectProducts.map((pp) => {
              const currentLitres = litresState[pp.id];
              const litresNum = currentLitres === "" || currentLitres === undefined ? 0 : Number(currentLitres);

              const coverageSqFtL = pp.product?.coverageSqFt != null ? Number(pp.product.coverageSqFt) : 0;
              const coverageRnFtL = pp.product?.coverageRnFt != null ? Number(pp.product.coverageRnFt) : 0;

              const actualCoverage = pp.unit === "sq.ft" ? litresNum * coverageSqFtL : litresNum * coverageRnFtL;
              const designatedArea = Number(pp.area);

              const isExceeding = actualCoverage > designatedArea;
              const diff = isExceeding ? actualCoverage - designatedArea : 0;

              return (
                <TableRow key={pp.id}>
                  <TableCell className="font-semibold">{pp.product?.name || "Paint Product"}</TableCell>
                  <TableCell>
                    {fmt(pp.area)} {pp.unit}
                  </TableCell>
                  <TableCell className="w-40">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentLitres}
                        onChange={(e) => handleLitresChange(pp.id, e.target.value)}
                        placeholder="0.00"
                        className="h-9 font-medium"
                      />
                      <span className="text-xs font-bold text-muted-foreground">L</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{fmt(actualCoverage)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">{pp.unit}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {litresNum === 0 ? (
                      <Badge variant="outline" className="bg-slate-50 text-slate-400">
                        No Usage Logged
                      </Badge>
                    ) : isExceeding ? (
                      <Badge
                        variant="outline"
                        className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 flex items-center gap-1.5 justify-end w-fit ml-auto"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Exceeding by {fmt(diff)} {pp.unit}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                      >
                        Within Limits
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: MEASUREMENTS Read Only ────────────────── */
/* ──────────────────────────────────────────────────────── */
function MeasurementsTab({ projectProducts }: { projectProducts: any[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Measurements</h3>
        <p className="text-xs text-muted-foreground">View product application area sizes.</p>
      </div>

      <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-sm max-w-2xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Area Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectProducts.map((pp) => (
              <TableRow key={pp.id}>
                <TableCell className="font-semibold">{pp.product?.name}</TableCell>
                <TableCell className="capitalize text-xs text-muted-foreground">
                  {pp.product?.category}
                </TableCell>
                <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200">
                  {fmt(pp.area)} {pp.unit}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: LABOUR CREW ATTENDANCE & WAGES ───────── */
/* ──────────────────────────────────────────────────────── */
interface LabourCrewTabProps {
  attendance: LabourAttendance[];
}

function LabourCrewTab({ attendance }: LabourCrewTabProps) {
  // Aggregate attendance data: Group by worker
  const aggregatedLabour = useMemo(() => {
    const map: Record<string, { name: string; paymentPerDay: number; days: string[]; phone: string }> = {};

    attendance.forEach((att) => {
      const labourId = att.labourId;
      const lName = att.labour?.name || "Unknown Crew";
      const paymentRate = Number(att.labour?.paymentPerDay || 0);
      const phoneNum = att.labour?.phonenumber || "—";
      
      const parsedDate = new Date(att.date);
      if (isNaN(parsedDate.getTime())) return;
      const dateStr = parsedDate.toISOString().split("T")[0];

      if (!map[labourId]) {
        map[labourId] = {
          name: lName,
          paymentPerDay: paymentRate,
          days: [],
          phone: phoneNum,
        };
      }
      if (!map[labourId].days.includes(dateStr)) {
        map[labourId].days.push(dateStr);
      }
    });

    return Object.entries(map).map(([id, item]) => ({
      id,
      name: item.name,
      paymentPerDay: item.paymentPerDay,
      daysPresentCount: item.days.length,
      totalWages: item.days.length * item.paymentPerDay,
      phone: item.phone,
    }));
  }, [attendance]);

  const totalLabourWages = useMemo(() => {
    return aggregatedLabour.reduce((sum, item) => sum + item.totalWages, 0);
  }, [aggregatedLabour]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Labour Attendance</h3>
        <p className="text-xs text-muted-foreground">View crew attendance logs and wages.</p>
      </div>

      {aggregatedLabour.length === 0 ? (
        <Card className="p-8 text-center border border-dashed text-muted-foreground">
          <Hammer className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <h4 className="font-bold">No Attendance History Marked</h4>
          <p className="text-xs max-w-sm mx-auto mt-1">Open the daily attendance ledger in sidebar menu, select this project site, and add crew logs.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <Card className="lg:col-span-2 border border-slate-200/80 dark:border-zinc-800/80 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Labour Name</TableHead>
                  <TableHead>Contact Phone</TableHead>
                  <TableHead>Wages / Day</TableHead>
                  <TableHead>Days Present</TableHead>
                  <TableHead className="text-right">Total Wages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregatedLabour.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-semibold">{item.name}</TableCell>
                    <TableCell className="text-slate-500 text-xs font-mono">{item.phone}</TableCell>
                    <TableCell>₹{fmt(item.paymentPerDay)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-bold px-2 py-0.5 rounded-full">
                        {item.daysPresentCount} days
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200">
                      ₹{fmt(item.totalWages)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200/60 dark:border-zinc-800/50 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Hammer className="h-5 w-5" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cost Summary</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Active Crew Members:</span>
                <span className="font-bold">{aggregatedLabour.length} workers</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Attendance Days:</span>
                <span className="font-bold">
                  {aggregatedLabour.reduce((sum, item) => sum + item.daysPresentCount, 0)} present marks
                </span>
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-zinc-800 pt-3 flex justify-between items-baseline">
              <span className="text-xs font-semibold text-slate-500">Total Wages</span>
              <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                ₹{fmt(totalLabourWages)}
              </span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: PAYMENTS (CUSTOMER & LABOUR) ──────────── */
/* ──────────────────────────────────────────────────────── */
interface PaymentsTabProps {
  fullProject: any;
  onSuccess: () => void;
}

function PaymentsTab({ fullProject, onSuccess }: PaymentsTabProps) {
  const [paidVal, setPaidVal] = useState<number>(Number(fullProject.paid || 0));
  const [savingPaid, setSavingPaid] = useState(false);

  useEffect(() => {
    setPaidVal(Number(fullProject.paid || 0));
  }, [fullProject.paid]);

  const handleSavePaidAmount = async () => {
    setSavingPaid(true);
    try {
      await apiRequest.update("projects", fullProject.id, {
        paid: Number(paidVal),
      } as any);
      toast({
        title: "Payments Updated",
        description: "Customer paid amount registry updated.",
      });
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Failed to Update",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSavingPaid(false);
    }
  };

  const dueBalance = Math.max(0, Number(fullProject.agreedPrice || fullProject.totalAmount) - Number(fullProject.paid || 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Payment Ledger */}
        <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-sm p-5 space-y-4">
          <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-zinc-900 pb-3">
            <div className="flex items-center gap-2 text-primary">
              <DollarSign className="h-5 w-5" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Customer Payments
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">Track and update customer payment receipts.</p>
          </div>

          <div className="space-y-3.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Agreed Contract Price:</span>
              <span className="font-bold">₹{fmt(fullProject.agreedPrice || fullProject.totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Received Paid Amount:</span>
              <div className="flex gap-2 items-center">
                <div className="relative w-36">
                  <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    type="number"
                    min="0"
                    value={paidVal}
                    onChange={(e) => setPaidVal(Number(e.target.value))}
                    className="h-8 pl-7 pr-2 font-bold py-0 text-right w-full"
                  />
                </div>
                <Button
                  onClick={handleSavePaidAmount}
                  disabled={savingPaid}
                  size="sm"
                  className="h-8 font-bold text-xs"
                >
                  {savingPaid ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-zinc-900 pt-3 flex justify-between items-baseline">
              <span className="font-bold text-slate-500">Due Outstanding Balance:</span>
              <span className={`text-xl font-extrabold ${dueBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                ₹{fmt(dueBalance)}
              </span>
            </div>
          </div>
        </Card>

        {/* Labour payments registry */}
        <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-sm p-5 space-y-4">
          <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-zinc-900 pb-3">
            <div className="flex items-center gap-2 text-primary">
              <Hammer className="h-5 w-5" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Labour Payments
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">Record payments paid to crew members.</p>
          </div>

          {(fullProject.labourPayments || []).length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">No payments registered to labours for this site.</p>
          ) : (
            <div className="overflow-y-auto max-h-48">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-2">Worker Name</TableHead>
                    <TableHead className="p-2">Date</TableHead>
                    <TableHead className="p-2 text-right">Amount Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(fullProject.labourPayments || []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="p-2 font-semibold text-xs">{p.labour?.name}</TableCell>
                      <TableCell className="p-2 text-[10px] text-muted-foreground">
                        {formatDate(p.paymentDate)}
                      </TableCell>
                      <TableCell className="p-2 text-right text-xs font-bold">₹{fmt(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: PROFIT & LOSS CALCULATOR ──────────────── */
/* ──────────────────────────────────────────────────────── */
interface ProfitLossTabProps {
  fullProject: any;
}

function ProfitLossTab({ fullProject }: ProfitLossTabProps) {
  // Agreed price
  const agreedPrice = Number(fullProject.agreedPrice || fullProject.totalAmount || 0);

  // Compute Product Cost
  const productCost = useMemo(() => {
    const projectProducts = fullProject.projectProducts ?? [];
    return projectProducts.reduce((sum: number, pp: any) => {
      const priceLitre = Number(pp.product?.price || 0);

      // Litres used
      if (pp.litresUsed != null && Number(pp.litresUsed) > 0) {
        return sum + Number(pp.litresUsed) * priceLitre;
      }

      // Fallback: area * rate (which is rate * area = total row price)
      return sum + Number(pp.rate) * Number(pp.area);
    }, 0);
  }, [fullProject.projectProducts]);

  // Compute Labour Cost from attendance ledger
  const labourCost = useMemo(() => {
    const attendance = fullProject.attendance ?? [];
    const map: Record<string, { paymentPerDay: number; days: string[] }> = {};

    attendance.forEach((att: any) => {
      const labourId = att.labourId;
      const paymentRate = Number(att.labour?.paymentPerDay || 0);
      
      const parsedDate = new Date(att.date);
      if (isNaN(parsedDate.getTime())) return;
      const dateStr = parsedDate.toISOString().split("T")[0];

      if (!map[labourId]) {
        map[labourId] = { paymentPerDay: paymentRate, days: [] };
      }
      if (!map[labourId].days.includes(dateStr)) {
        map[labourId].days.push(dateStr);
      }
    });

    return Object.values(map).reduce((sum, item) => sum + item.days.length * item.paymentPerDay, 0);
  }, [fullProject.attendance]);

  const totalCost = productCost + labourCost;
  const profitLoss = agreedPrice - totalCost;
  const isProfit = profitLoss >= 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Profit & Loss</h3>
        <p className="text-xs text-muted-foreground">Compare agreed price with actual material costs and labour wages.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric Cards */}
        <Card className="border border-slate-200/80 dark:border-zinc-800/80 p-5 shadow-sm-soft">
          <div className="flex items-center gap-2 text-primary mb-1">
            <DollarSign className="h-4.5 w-4.5" />
            <span className="text-xs font-semibold text-slate-500">Revenue</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-200">₹{fmt(agreedPrice)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Agreed price contract value.</p>
        </Card>

        <Card className="border border-slate-200/80 dark:border-zinc-800/80 p-5 shadow-sm-soft">
          <div className="flex items-center gap-2 text-rose-500 mb-1">
            <TrendingUp className="h-4.5 w-4.5" />
            <span className="text-xs font-semibold text-slate-500">Expenses</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-200">₹{fmt(totalCost)}</p>
          <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
            <div className="flex justify-between">
              <span>Materials (Paints):</span>
              <span className="font-bold">₹{fmt(productCost)}</span>
            </div>
            <div className="flex justify-between">
              <span>Labour Wages:</span>
              <span className="font-bold">₹{fmt(labourCost)}</span>
            </div>
          </div>
        </Card>

        <Card className={`border p-5 shadow-sm-soft ${isProfit ? "bg-emerald-50/40 border-emerald-200/60 dark:bg-emerald-950/10" : "bg-red-50/40 border-red-200/60 dark:bg-red-950/10"}`}>
          <div className={`flex items-center gap-2 mb-1 ${isProfit ? "text-emerald-600" : "text-rose-600"}`}>
            <PackageCheck className="h-4.5 w-4.5" />
            <span className="text-xs font-semibold text-slate-500">Net Margin</span>
          </div>
          <p className={`text-2xl font-extrabold ${isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {isProfit ? "+" : ""}₹{fmt(profitLoss)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {isProfit ? "Representing project net positive margin." : "Contract current operational deficit."}
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── QUICK DOWNLOAD QUOTATION PDF HELPER ────────────────── */
/* ──────────────────────────────────────────────────────── */
const downloadQuotationPDFHelper = (project: Project, products: Product[]) => {
  // Reconstruct nested options
  const projectProducts = project.projectProducts ?? [];

  const subtotal = projectProducts.reduce((sum, pp) => {
    return sum + (Number(pp.rate) * Number(pp.area) || 0);
  }, 0);

  const taxRate = Number(project.tax || 0);
  const taxAmount = (subtotal * taxRate) / 100;

  const discountVal = Number(project.discount || 0);
  const discountAmount = project.discountType === "percent"
    ? (subtotal * discountVal) / 100
    : discountVal;

  const finalPrice = Number(project.agreedPrice || subtotal + taxAmount - discountAmount);

  const pdfProducts = projectProducts.map((pp) => {
    const matched = products.find((p) => p.id === pp.productId);
    return {
      productName: matched?.name || "Paint Product",
      brandName: matched?.brand?.name,
      area: Number(pp.area),
      unit: pp.unit,
      rate: Number(pp.rate),
      total: Number(pp.rate) * Number(pp.area),
    };
  });

  generateQuotationPDF({
    projectName: project.name,
    projectDate: project.projectDate ? new Date(project.projectDate).toISOString().split("T")[0] : undefined,
    customer: {
      name: project.customer?.name || "Customer",
      phonenumber: project.customer?.phonenumber || null,
      email: project.customer?.email || null,
      address: project.customer?.address || null,
    },
    creatorName: project.creator?.username || "Sales Associate",
    products: pdfProducts,
    summary: {
      subtotal,
      tax: taxRate,
      taxAmount,
      discount: discountVal,
      discountType: (project.discountType || "amount") as any,
      discountAmount,
      agreedPrice: finalPrice,
    },
  });

  toast({
    title: "Quotation Generated",
    description: `PDF Quotation downloaded for "${project.name}"`,
  });
};

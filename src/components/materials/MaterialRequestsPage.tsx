import { useState, useEffect, useMemo } from "react";
import { useMasterData } from "@/hooks/use-master-data";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import {
  Plus,
  Trash2,
  Search,
  ClipboardList,
  Loader2,
  PackagePlus,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  Calendar,
  Package,
  Layers,
} from "lucide-react";
import type { LowMaterial, Project, Product } from "@/types/master";

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

interface MaterialItemRow {
  id: string;
  selectedProductId: string;
  materialName: string;
  productFilter: string;
  color: string;
  shade: string;
  quantity: string;
}

export interface ParsedRequestItem {
  index: number;
  material: string;
  color: string;
  shade: string;
  quantity: string;
}

export const parseRequestItems = (rawMaterial: string, rawQuantity?: string): ParsedRequestItem[] => {
  if (!rawMaterial) return [];
  const matLines = rawMaterial.split("\n").map((l) => l.trim()).filter(Boolean);
  const qtyLines = (rawQuantity || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const cleanQuantities = qtyLines.map((q) => q.replace(/^\d+\.\s*/, "").trim());

  return matLines.map((line, idx) => {
    const cleanLine = line.replace(/^\d+\.\s*/, "");
    const match = cleanLine.match(/^(.*?)(?:\s*\[(?:Color:\s*([^|\]]+?)\s*\|\s*)?Shade:\s*([^\]]+)\])?$/i);
    let material = cleanLine;
    let color = "—";
    let shade = "—";

    if (match && (match[2] !== undefined || match[3] !== undefined)) {
      material = match[1].trim() || cleanLine;
      color = (match[2] || "").trim() || "—";
      shade = (match[3] || "").trim() || "—";
    }

    const quantity = cleanQuantities[idx] || (idx === 0 && rawQuantity ? rawQuantity.trim() : "") || "—";

    return {
      index: idx + 1,
      material,
      color,
      shade,
      quantity,
    };
  });
};

export default function MaterialRequestsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { data: requestsRaw, isLoading, create, update, remove } = useMasterData<LowMaterial>("low-materials");
  const projectsData = useMasterData<Project>("projects");
  const productsData = useMasterData<Product>("products");

  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDisplay, setProjectDisplay] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [requestDate, setRequestDate] = useState(() => getTodayString());
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [statusFilter, setStatusFilter] = useState<"active" | "pending_approval" | "pending_delivery" | "completed">("active");

  // Multi-material item rows
  const [items, setItems] = useState<MaterialItemRow[]>([
    { id: "1", selectedProductId: "", materialName: "", productFilter: "", color: "", shade: "", quantity: "" },
  ]);

  const [fullSelectedProject, setFullSelectedProject] = useState<Project | null>(null);
  const [fetchingProject, setFetchingProject] = useState(false);

  const fetchFullProjectDetails = async (projectId: string) => {
    setFetchingProject(true);
    try {
      const full = await apiRequest.execute<Project>(`/projects/${projectId}`);
      setFullSelectedProject(full);
    } catch (err: any) {
      console.error("MaterialRequestsPage: Error fetching project details:", err);
      toast({
        title: "Error fetching project details",
        description: err.message || "Failed to load project details.",
        variant: "destructive",
      });
    } finally {
      setFetchingProject(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchFullProjectDetails(selectedProjectId);
    } else {
      setFullSelectedProject(null);
    }
  }, [selectedProjectId]);

  const requests = useMemo(() => (Array.isArray(requestsRaw) ? requestsRaw : []), [requestsRaw]);
  const projectsList = useMemo(() => (Array.isArray(projectsData.data) ? projectsData.data : []), [projectsData.data]);
  const productsList = useMemo(() => (Array.isArray(productsData.data) ? productsData.data : []), [productsData.data]);

  // Project options filtered by typed query
  const filteredProjectOptions = useMemo(
    () =>
      projectsList
        .filter((p) => !projectFilter || p.name.toLowerCase().includes(projectFilter.toLowerCase()))
        .slice(0, 10)
        .map((p) => ({ id: p.id, label: p.name })),
    [projectsList, projectFilter]
  );

  // Helper to get filtered catalog and project products for a specific row
  const getProductOptionsForRow = (filterQuery: string) => {
    const q = (filterQuery || "").toLowerCase().trim();
    const projectProducts = fullSelectedProject?.projectProducts?.map((pp: any) => pp.product).filter(Boolean) || [];

    if (projectProducts.length > 0) {
      const projFiltered = projectProducts
        .filter((p: any) => !q || p.name.toLowerCase().includes(q))
        .map((p: any) => ({ id: p.id, label: `${p.name} (Project)` }));

      const projIds = new Set(projectProducts.map((p: any) => p.id));
      const catalogFiltered = productsList
        .filter((p) => !projIds.has(p.id) && (!q || p.name.toLowerCase().includes(q)))
        .slice(0, 15)
        .map((p) => ({ id: p.id, label: p.name }));

      return [...projFiltered, ...catalogFiltered];
    }

    return productsList
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 15)
      .map((p) => ({ id: p.id, label: p.name }));
  };

  // Actions for item rows
  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random().toString().slice(2, 5), selectedProductId: "", materialName: "", productFilter: "", color: "", shade: "", quantity: "" },
    ]);
  };

  const removeItemRow = (id: string) => {
    if (items.length <= 1) {
      toast({ title: "At least one item required", description: "You cannot remove all material rows.", variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemRow = (id: string, updates: Partial<MaterialItemRow>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const validRequests = useMemo(() => {
    return requests.filter((r) => !r.material?.startsWith("[WASTAGE]"));
  }, [requests]);

  const counts = useMemo(() => {
    let active = 0;
    let pendingApproval = 0;
    let pendingDelivery = 0;
    let completed = 0;

    validRequests.forEach((r) => {
      const isCompleted = Boolean(r.approved && r.delivered);
      if (isCompleted) {
        completed++;
      } else {
        active++;
        if (!r.approved) pendingApproval++;
        if (!r.delivered) pendingDelivery++;
      }
    });

    return { active, pendingApproval, pendingDelivery, completed, total: validRequests.length };
  }, [validRequests]);

  const filteredRequests = useMemo(() => {
    return validRequests.filter((r) => {
      const isCompleted = Boolean(r.approved && r.delivered);

      if (statusFilter === "active" && isCompleted) return false;
      if (statusFilter === "pending_approval" && (r.approved || isCompleted)) return false;
      if (statusFilter === "pending_delivery" && (r.delivered || isCompleted)) return false;
      if (statusFilter === "completed" && !isCompleted) return false;

      const projName = r.project?.name || "";
      const matName = r.material || "";
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        projName.toLowerCase().includes(q) ||
        matName.toLowerCase().includes(q)
      );
    });
  }, [validRequests, statusFilter, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast({ title: "Validation Error", description: "Please select a site/project.", variant: "destructive" });
      return;
    }

    const validItems = items.filter((item) => item.materialName.trim() && item.quantity.trim());

    if (validItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please specify at least one material and quantity.",
        variant: "destructive",
      });
      return;
    }

    // Check if any row has missing shade (Shade is compulsory)
    const missingShade = items.find((item) => (item.materialName.trim() || item.quantity.trim()) && !item.shade.trim());
    if (missingShade) {
      toast({
        title: "Validation Error",
        description: "Shade number is compulsory for all requested materials.",
        variant: "destructive",
      });
      return;
    }

    // Check if any row has incomplete data
    const incompleteItem = items.find(
      (item) =>
        (item.materialName.trim() && (!item.quantity.trim() || !item.shade.trim())) ||
        (!item.materialName.trim() && (item.quantity.trim() || item.shade.trim() || item.color.trim()))
    );
    if (incompleteItem) {
      toast({
        title: "Validation Error",
        description: "Please fill in material name, shade number, and quantity for all material rows.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const dateISO = new Date(requestDate).toISOString();
      
      const finalMaterialString =
        validItems.length === 1
          ? `${validItems[0].materialName.trim()} [Color: ${validItems[0].color.trim() || "—"} | Shade: ${validItems[0].shade.trim()}]`
          : validItems
              .map(
                (item, i) =>
                  `${i + 1}. ${item.materialName.trim()} [Color: ${item.color.trim() || "—"} | Shade: ${item.shade.trim()}]`
              )
              .join("\n");

      const finalQuantityString =
        validItems.length === 1
          ? validItems[0].quantity.trim()
          : validItems.map((item, i) => `${i + 1}. ${item.quantity.trim()}`).join("\n");

      // Create a SINGLE record containing all requested materials as a package
      await create({
        projectId: selectedProjectId,
        _projectName: projectDisplay,
        material: finalMaterialString,
        quantity: finalQuantityString,
        date: dateISO,
        approved: false,
        delivered: false,
      } as any);

      toast({
        title: "Material Request Submitted",
        description: `Successfully created material request package with ${validItems.length} item${validItems.length > 1 ? "s" : ""}.`,
      });

      setIsOpen(false);
      // Reset Form
      setSelectedProjectId("");
      setProjectDisplay("");
      setProjectFilter("");
      setItems([{ id: "1", selectedProductId: "", materialName: "", productFilter: "", color: "", shade: "", quantity: "" }]);
      setRequestDate(getTodayString());
    } catch (err: any) {
      toast({ title: "Error creating requests", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = (req: LowMaterial) => {
    update({
      id: req.id,
      data: { approved: true } as any,
    });
    toast({ title: "Request Approved", description: "Office approval recorded." });
  };

  const handleDeliver = (req: LowMaterial) => {
    update({
      id: req.id,
      data: { delivered: true } as any,
    });
    toast({ title: "Request Delivered", description: "Material marked as delivered." });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Material Requests
          </h2>
          <p className="text-xs text-muted-foreground">Manage and track site material requests, approvals, and deliveries.</p>
        </div>

        {/* Add Request Button Trigger */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold flex items-center gap-1.5 shadow-sm">
              <Plus className="h-4.5 w-4.5" />
              Add Requests
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader className="pb-3 border-b border-border/60">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <PackagePlus className="h-5 w-5 text-primary" />
                <span>New Material Request</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Request single or multiple materials for a project site.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-2">
              {/* Site & Date Selection Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/70 dark:bg-zinc-900/40 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Site / Project *</label>
                  <SearchableSelect
                    value={selectedProjectId}
                    displayValue={projectDisplay}
                    options={filteredProjectOptions}
                    placeholder="Select site"
                    inputHeight="h-10"
                    onSearchChange={(q) => setProjectFilter(q)}
                    onSelect={(id, label) => {
                      setSelectedProjectId(id);
                      setProjectDisplay(label);
                      setProjectFilter("");
                    }}
                    onClear={() => {
                      setSelectedProjectId("");
                      setProjectDisplay("");
                      setProjectFilter("");
                    }}
                    onEnter={(val) => projectsData.forceServerSearch(val)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Request Date *</label>
                  <Input
                    type="date"
                    max={getTodayString()}
                    value={requestDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      const today = getTodayString();
                      if (val > today) setRequestDate(today);
                      else setRequestDate(val);
                    }}
                    className="h-10 text-sm font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Multi-Material Items Section */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Materials Required ({items.length})
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItemRow}
                    className="h-8 text-[11px] font-bold gap-1 text-primary hover:text-primary/80 border-primary/20 hover:bg-primary/5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Another Material</span>
                  </Button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2 relative shadow-2xs group"
                      style={{ zIndex: items.length + 10 - index }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Material #{index + 1}
                        </span>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItemRow(item.id)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Remove material row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-4 space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Material Name *
                          </label>
                          <SearchableSelect
                            value={item.selectedProductId || item.materialName}
                            displayValue={item.materialName}
                            options={getProductOptionsForRow(item.productFilter)}
                            placeholder={fetchingProject ? "Loading..." : "Search product / material"}
                            inputHeight="h-10"
                            onSearchChange={(q) => {
                              updateItemRow(item.id, {
                                productFilter: q,
                                materialName: q ? q : item.materialName,
                                selectedProductId: q ? "" : item.selectedProductId,
                              });
                            }}
                            onSelect={(id, label) => {
                              const cleanName = label.replace(/\s*\(Project\)$/, "");
                              updateItemRow(item.id, {
                                selectedProductId: id,
                                materialName: cleanName,
                                productFilter: "",
                              });
                            }}
                            onClear={() => {
                              updateItemRow(item.id, {
                                selectedProductId: "",
                                materialName: "",
                                productFilter: "",
                              });
                            }}
                            onEnter={(val) => {
                              updateItemRow(item.id, { materialName: val });
                            }}
                            required
                          />
                        </div>

                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Color
                          </label>
                          <Input
                            placeholder="e.g. Royal Blue"
                            value={item.color}
                            onChange={(e) => updateItemRow(item.id, { color: e.target.value })}
                            className="h-10 text-sm font-semibold"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Shade * <span className="text-rose-500 font-bold">*</span>
                          </label>
                          <Input
                            placeholder="e.g. 8214"
                            value={item.shade}
                            onChange={(e) => updateItemRow(item.id, { shade: e.target.value })}
                            className="h-10 text-sm font-semibold font-mono"
                            required
                          />
                        </div>

                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Quantity *
                          </label>
                          <Input
                            placeholder="e.g. 50 Ltrs"
                            value={item.quantity}
                            onChange={(e) => updateItemRow(item.id, { quantity: e.target.value })}
                            className="h-10 text-sm font-semibold"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItemRow}
                  className="h-9 text-xs font-bold gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add More</span>
                </Button>

                <Button type="submit" disabled={submitting} className="font-bold h-10 px-5">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit {items.length > 1 ? `${items.length} Requests` : "Request"}</span>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter("active")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "active"
              ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20"
              : "bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900 border-slate-200/80 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Active Requests</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground mt-1.5">{counts.active}</div>
        </div>

        <div
          onClick={() => setStatusFilter("pending_approval")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "pending_approval"
              ? "bg-amber-500/10 border-amber-500 shadow-xs ring-1 ring-amber-500/20"
              : "bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900 border-slate-200/80 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold">
            <span>Pending Office</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1.5">{counts.pendingApproval}</div>
        </div>

        <div
          onClick={() => setStatusFilter("pending_delivery")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "pending_delivery"
              ? "bg-blue-500/10 border-blue-500 shadow-xs ring-1 ring-blue-500/20"
              : "bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900 border-slate-200/80 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <span>Pending Delivery</span>
            <Truck className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1.5">{counts.pendingDelivery}</div>
        </div>

        <div
          onClick={() => setStatusFilter("completed")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === "completed"
              ? "bg-emerald-500/10 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20"
              : "bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900 border-slate-200/80 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span>Delivered</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1.5">{counts.completed}</div>
        </div>
      </div>

      {/* Filters and List */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden p-4 space-y-4">
        {/* Toolbar: Search & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by site or material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto bg-slate-100 dark:bg-zinc-850 p-1 rounded-lg border border-slate-200/60 dark:border-zinc-750">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              onClick={() => setViewMode("cards")}
              className={`h-7 px-2.5 text-xs font-bold gap-1.5 ${viewMode === "cards" ? "bg-white dark:bg-zinc-900 shadow-xs" : ""}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cards</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              onClick={() => setViewMode("table")}
              className={`h-7 px-2.5 text-xs font-bold gap-1.5 ${viewMode === "table" ? "bg-white dark:bg-zinc-900 shadow-xs" : ""}`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table</span>
            </Button>
          </div>
        </div>

        {/* Requests Content */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-7 w-7 animate-spin mx-auto text-primary" />
            <span className="text-xs text-muted-foreground mt-2 block">Loading requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs italic bg-slate-50/50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-border/60">
            No material requests found {statusFilter !== "active" ? `for filter "${statusFilter.replace("_", " ")}"` : ""}.
          </div>
        ) : viewMode === "cards" ? (
          /* Cards View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRequests.map((req) => {
              const requestItems = parseRequestItems(req.material, req.quantity);

              return (
                <Card
                  key={req.id}
                  className="group relative overflow-hidden border border-border/80 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between rounded-xl"
                >
                  <CardContent className="p-4 space-y-3.5 flex flex-col justify-between h-full">
                    {/* Top Row: Project & Date & Delete */}
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-foreground font-bold text-sm min-w-0 flex-1">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate" title={req.project?.name || "No Project"}>
                            {req.project?.name || "—"}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this material request?")) {
                              remove(req.id);
                              toast({ title: "Request Removed", description: "Material request deleted." });
                            }
                          }}
                          className="h-7 w-7 text-muted-foreground/50 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 shrink-0 -mr-1 -mt-1"
                          title="Delete Request"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center text-[11px] text-muted-foreground gap-1.5">
                        <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="font-mono">{formatDate(req.date)}</span>
                      </div>
                    </div>

                    {/* Requested Items Box */}
                    <div className="space-y-2 bg-slate-50/70 dark:bg-zinc-900/40 p-3 rounded-lg border border-slate-100 dark:border-zinc-800/80 min-w-0 flex-1">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-primary" />
                          Requested Items
                        </span>
                        <span className="bg-slate-200/70 dark:bg-zinc-800 px-1.5 py-0.2 rounded text-[9px] font-semibold text-slate-700 dark:text-slate-300">
                          {requestItems.length} {requestItems.length === 1 ? "item" : "items"}
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-0.5 custom-scrollbar">
                        {requestItems.map((item) => (
                          <div
                            key={item.index}
                            className="bg-white dark:bg-zinc-850 p-2 rounded-md border border-slate-200/60 dark:border-zinc-700/60 text-xs space-y-1"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <span className="font-bold text-foreground line-clamp-2 leading-snug">
                                {requestItems.length > 1 ? `${item.index}. ` : ""}{item.material}
                              </span>
                              <Badge
                                variant="secondary"
                                className="font-bold text-[10px] shrink-0 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/50 px-1.5 py-0.2 leading-tight"
                              >
                                {item.quantity.toLowerCase().startsWith("qty") ? item.quantity : `Qty: ${item.quantity}`}
                              </Badge>
                            </div>

                            {(item.shade !== "—" || item.color !== "—") && (
                              <div className="flex items-center gap-1.5 text-[10px] flex-wrap pt-0.5">
                                {item.shade !== "—" && (
                                  <span className="font-mono font-semibold bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 border border-slate-200/40 dark:border-zinc-700/40">
                                    Shade: {item.shade}
                                  </span>
                                )}
                                {item.color !== "—" && (
                                  <span className="text-muted-foreground">
                                    Color: <strong className="text-foreground">{item.color}</strong>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status & Approvals Section */}
                    <div className="space-y-2 pt-1 border-t border-border/40 text-xs">
                      {/* Office Approval */}
                      <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/60">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Office Approval</span>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                              req.approved
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200"
                            }`}
                          >
                            {req.approved ? "Approved" : "Pending"}
                          </Badge>
                          {isAdmin && !req.approved && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(req)}
                              className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/50 font-bold px-2 py-0"
                            >
                              Approve
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Delivery Status */}
                      <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/60">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Site Delivery</span>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                              req.delivered
                                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200"
                                : "bg-slate-100 dark:bg-zinc-800 text-slate-500 border-slate-200"
                            }`}
                          >
                            {req.delivered ? "Delivered" : "Pending"}
                          </Badge>
                          {isAdmin && !req.delivered && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeliver(req)}
                              className="h-6 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 font-bold px-2 py-0"
                            >
                              Mark Delivered
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-zinc-900">
                <TableRow>
                  <TableHead className="w-[105px] text-xs">Date</TableHead>
                  <TableHead className="min-w-[130px] text-xs">Site / Project</TableHead>
                  <TableHead className="min-w-[280px] text-xs">Requested Items</TableHead>
                  <TableHead className="w-[170px] text-xs">Approved by Office</TableHead>
                  <TableHead className="w-[170px] text-xs">Delivered</TableHead>
                  <TableHead className="w-[60px] text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => {
                  const requestItems = parseRequestItems(req.material, req.quantity);

                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs">{formatDate(req.date)}</TableCell>
                      <TableCell className="font-bold text-xs">{req.project?.name || "—"}</TableCell>
                      <TableCell className="py-2.5">
                        <div className="space-y-1.5">
                          {requestItems.map((item) => (
                            <div key={item.index} className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-foreground">
                                {requestItems.length > 1 ? `${item.index}. ` : ""}{item.material}
                              </span>
                              <Badge
                                variant="secondary"
                                className="font-bold text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/50"
                              >
                                {item.quantity.toLowerCase().startsWith("qty") ? item.quantity : `Qty: ${item.quantity}`}
                              </Badge>
                              {item.shade !== "—" && (
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-5 bg-slate-50 dark:bg-zinc-900">
                                  Shade: {item.shade}
                                </Badge>
                              )}
                              {item.color !== "—" && (
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  ({item.color})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              req.approved
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border-emerald-200"
                                : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 border-amber-200"
                            }`}
                          >
                            {req.approved ? "Approved" : "Pending"}
                          </Badge>
                          {isAdmin && !req.approved && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(req)}
                              className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold px-2"
                            >
                              Approve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              req.delivered
                                ? "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-450 border-blue-200"
                                : "bg-slate-50 dark:bg-zinc-900 text-slate-500 border-slate-200"
                            }`}
                          >
                            {req.delivered ? "Delivered" : "Pending"}
                          </Badge>
                          {isAdmin && !req.delivered && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeliver(req)}
                              className="h-6 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold px-2"
                            >
                              Mark Delivered
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this request?")) {
                              remove(req.id);
                              toast({ title: "Request Removed", description: "Material request deleted." });
                            }
                          }}
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

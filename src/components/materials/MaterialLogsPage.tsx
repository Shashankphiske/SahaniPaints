import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMasterData } from "@/hooks/use-master-data";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Calendar,
  Building,
  PackagePlus,
  X,
  Plus,
  Minus,
  Loader2,
  Trash2,
  Package,
  ChevronDown,
  ClipboardList,
  SlidersHorizontal,
  ArrowLeft,
  CheckCircle2,
  Search,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { Project, Product, ProjectMaterialLog } from "@/types/master";
import { supabase } from "@/lib/realtime";

const getProductSizeInLitres = (sizeStr?: string): number => {
  if (!sizeStr) return 1;
  const normalized = sizeStr.toLowerCase().trim();
  if (normalized.endsWith("ml")) {
    const val = parseFloat(normalized);
    return isNaN(val) ? 1 : val / 1000;
  }
  if (normalized.endsWith("ltr") || normalized.endsWith("l") || normalized.endsWith("lt")) {
    const val = parseFloat(normalized);
    return isNaN(val) ? 1 : val;
  }
  const val = parseFloat(normalized);
  return isNaN(val) ? 1 : val;
};

interface QueuedMaterial {
  queueId: string;
  product: Product;
  quantity: number;
  allocatedArea: number;
  unit: string;
}

export default function MaterialLogsPage() {
  const { data: projectsData } = useMasterData<Project>("projects");
  const { data: allProductsData } = useMasterData<Product>("products");

  const queryClient = useQueryClient();
  const { data: logsList = [], isLoading: loadingLogs } = useQuery<ProjectMaterialLog[]>({
    queryKey: ["material-logs"],
    queryFn: () => apiRequest.fetchAll<ProjectMaterialLog>("project-material-logs"),
    staleTime: Infinity,
  });

  const { toast } = useToast();

  const projectsList = useMemo(() => (Array.isArray(projectsData) ? projectsData : []), [projectsData]);
  const allProducts = useMemo(() => (Array.isArray(allProductsData) ? allProductsData : []), [allProductsData]);

  // Main navigation modes: "ledger" (default list), "detail" (view date group), or "add" (direct add view)
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedDetailGroup, setSelectedDetailGroup] = useState<{
    date: string;
    projectId: string;
    projectName: string;
  } | null>(null);

  // Form Fields State
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectSelectDisplay, setProjectSelectDisplay] = useState("");
  const [fullSelectedProject, setFullSelectedProject] = useState<Project | null>(null);
  const [fetchingProject, setFetchingProject] = useState(false);

  // Staged materials queue before submitting
  const [tempSelectedMaterials, setTempSelectedMaterials] = useState<QueuedMaterial[]>([]);
  const [submittingLogs, setSubmittingLogs] = useState(false);

  // Product searchable dropdown states for adding materials
  const [productSelectId, setProductSelectId] = useState("");
  const [productSelectDisplay, setProductSelectDisplay] = useState("");

  // Search fields
  const [siteSearch, setSiteSearch] = useState("");
  const [detailProductSearch, setDetailProductSearch] = useState("");

  // Filters state for ledger table
  const [showFilterCard, setShowFilterCard] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterProjectDisplay, setFilterProjectDisplay] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Fetch full project details when selecting a site to get allocated products
  const fetchFullProjectDetails = async (projectId: string) => {
    setFetchingProject(true);
    try {
      const full = await apiRequest.execute<Project>(`/projects/${projectId}`);
      setFullSelectedProject(full);
    } catch (err: any) {
      toast({
        title: "Error fetching project details",
        description: err.message || "Failed to load project details.",
        variant: "destructive",
      });
    } finally {
      setFetchingProject(false);
    }
  };

  // Products available in the dropdown (site-allocated products appear first with a tag, followed by entire catalog)
  const productOptions = useMemo(() => {
    const query = productSelectDisplay.toLowerCase().trim();

    // Set of product IDs allocated to the selected project
    const allocatedProductIds = new Set(
      (fullSelectedProject?.projectProducts || [])
        .map((pp: any) => pp?.product?.id || pp?.productId)
        .filter(Boolean)
    );

    // Filter products by search query
    const matched = allProducts.filter((p) => {
      if (!query) return true;
      return (
        p.name?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.brand?.name?.toLowerCase().includes(query) ||
        p.size?.toLowerCase().includes(query)
      );
    });

    // Sort matched: project allocated products first, then others alphabetically
    const sorted = [...matched].sort((a, b) => {
      const aInProject = allocatedProductIds.has(a.id) ? 1 : 0;
      const bInProject = allocatedProductIds.has(b.id) ? 1 : 0;
      if (aInProject !== bInProject) {
        return bInProject - aInProject; // allocated first
      }
      return (a.name || "").localeCompare(b.name || "");
    });

    return sorted.slice(0, 30).map((p) => {
      const isAllocated = allocatedProductIds.has(p.id);
      const badge = isAllocated ? " (Project)" : "";
      const priceVal = Number(p.price || 0);
      const priceStr = priceVal > 0 ? ` • ₹${priceVal.toLocaleString("en-IN")}` : "";
      return {
        id: p.id,
        label: `${p.name}${badge}${priceStr}`,
      };
    });
  }, [allProducts, productSelectDisplay, fullSelectedProject]);

  // Realtime: keep the React Query cache live for changes from other users
  useEffect(() => {
    const channel = supabase
      .channel("db-material-logs-sync")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_material_logs" },
        async (payload) => {
          try {
            const newRecord = await apiRequest.execute<ProjectMaterialLog>(
              `/project-material-logs/${payload.new.id}`
            );
            queryClient.setQueryData<ProjectMaterialLog[]>(["material-logs"], (prev = []) => {
              if (prev.some((r) => r.id === newRecord.id)) return prev;
              return [newRecord, ...prev];
            });
          } catch {
            queryClient.invalidateQueries({ queryKey: ["material-logs"] });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "project_material_logs" },
        (payload) => {
          queryClient.setQueryData<ProjectMaterialLog[]>(["material-logs"], (prev = []) =>
            prev.filter((r) => r.id !== payload.old.id)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "project_material_logs" },
        (payload) => {
          queryClient.setQueryData<ProjectMaterialLog[]>(["material-logs"], (prev = []) =>
            prev.map((r) => (r.id === payload.new.id ? { ...r, ...payload.new } : r))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Add a product to the staging queue (or increment if already queued)
  const handleQueueProduct = (product: Product & { allocatedArea?: number; unit?: string }) => {
    if (!selectedProject) {
      toast({
        title: "Site required",
        description: "Please choose a project site first.",
        variant: "destructive",
      });
      return;
    }

    setTempSelectedMaterials((prev) => {
      const existing = prev.find((item) => item.product?.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product?.id === product.id
            ? { ...item, quantity: Number((item.quantity + 1).toFixed(2)) }
            : item
        );
      }
      return [
        ...prev,
        {
          queueId: Math.random().toString(36).substring(2, 9),
          product,
          quantity: 1,
          allocatedArea: product.allocatedArea || 0,
          unit: product.unit || "sq.ft",
        },
      ];
    });

    toast({
      title: "Added to Log",
      description: `${product.name} staged for logging.`,
    });
  };

  const handleSelectProductFromDropdown = (id: string, label: string) => {
    if (!id) return;
    const match = allProducts.find((p) => p.id === id);
    if (match) {
      handleQueueProduct(match);
      setProductSelectId("");
      setProductSelectDisplay("");
    }
  };

  const handleRemoveFromQueue = (queueId: string) => {
    setTempSelectedMaterials((prev) => prev.filter((item) => item.queueId !== queueId));
  };

  const handleUpdateQueueQuantity = (queueId: string, quantity: number) => {
    setTempSelectedMaterials((prev) =>
      prev.map((item) => (item.queueId === queueId ? { ...item, quantity } : item))
    );
  };

  // Check if any queued item has quantity <= 0 or is invalid
  const hasInvalidQuantity = useMemo(() => {
    return (
      tempSelectedMaterials.length === 0 ||
      tempSelectedMaterials.some(
        (item) => Number(item.quantity) <= 0 || isNaN(Number(item.quantity))
      )
    );
  }, [tempSelectedMaterials]);

  // Save queued materials to database
  const handleSaveLogs = async (keepOpen = false) => {
    const activeProject = selectedProject;
    if (!activeProject || tempSelectedMaterials.length === 0) {
      toast({
        title: "Cannot save",
        description: "Please select a site and add at least one material to log.",
        variant: "destructive",
      });
      return;
    }

    if (tempSelectedMaterials.some((item) => Number(item.quantity) <= 0 || isNaN(Number(item.quantity)))) {
      toast({
        title: "Invalid quantity",
        description: "All quantities must be greater than 0 to save.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingLogs(true);
    let successCount = 0;
    const newRecords: ProjectMaterialLog[] = [];
    const activeDate = currentDate;

    for (const item of tempSelectedMaterials) {
      try {
        const payload = {
          date: new Date(activeDate).toISOString(),
          projectId: activeProject.id,
          productId: item.product.id,
          quantity: item.quantity,
        };

        const result = await apiRequest.create<ProjectMaterialLog>("project-material-logs", payload as any);

        const fullRecord: ProjectMaterialLog = {
          ...payload,
          ...result,
          project: { name: activeProject.name },
          product: {
            name: item.product.name,
            price: Number(item.product.price),
            size: item.product.size,
          },
        };
        newRecords.push(fullRecord);
        successCount++;
      } catch (err: any) {
        toast({
          title: `Failed to log ${item.product.name}`,
          description: err.message || "An error occurred.",
          variant: "destructive",
        });
      }
    }

    if (successCount > 0) {
      queryClient.setQueryData<ProjectMaterialLog[]>(["material-logs"], (prev = []) => [
        ...newRecords,
        ...prev,
      ]);
      toast({
        title: "Materials logged successfully",
        description: `Successfully logged ${successCount} material(s) for "${activeProject.name}".`,
      });
      setTempSelectedMaterials([]);
      if (!keepOpen) {
        setIsAddMode(false);
      }
    }
    setSubmittingLogs(false);
  };

  // Delete logged entry
  const handleDeleteLog = async (id: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete the log for ${productName}?`)) return;

    try {
      await apiRequest.delete("project-material-logs", id);
      queryClient.setQueryData<ProjectMaterialLog[]>(["material-logs"], (prev = []) =>
        prev.filter((item) => item.id !== id)
      );
      toast({
        title: "Log deleted",
        description: `Successfully deleted material log for "${productName}".`,
      });
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message || "Could not delete log.",
        variant: "destructive",
      });
    }
  };

  // Filtered logs for ledger view
  const filteredLogs = useMemo(() => {
    return logsList.filter((log) => {
      if (siteSearch.trim()) {
        const term = siteSearch.toLowerCase().trim();
        const matchProj = projectsList.find((p) => p.id === log.projectId);
        const projName = (log.project?.name || matchProj?.name || "").toLowerCase();
        if (!projName.includes(term)) return false;
      }
      if (filterSearch.trim()) {
        const term = filterSearch.toLowerCase().trim();
        if (!log.product?.name?.toLowerCase().includes(term)) return false;
      }
      if (filterProjectId && log.projectId !== filterProjectId) return false;
      if (filterDate) {
        const start = new Date(filterDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filterDate);
        end.setHours(23, 59, 59, 999);
        const logDate = new Date(log.date);
        if (logDate < start || logDate > end) return false;
      }
      return true;
    });
  }, [logsList, siteSearch, filterSearch, filterDate, filterProjectId, projectsList]);

  // Group logs by Date + Project
  const groupedLogs = useMemo(() => {
    const groups: Record<
      string,
      { date: string; projectId: string; projectName: string; records: ProjectMaterialLog[] }
    > = {};

    filteredLogs.forEach((log) => {
      const parsedDate = new Date(log.date);
      if (isNaN(parsedDate.getTime())) return;
      const dStr = parsedDate.toISOString().split("T")[0];
      const groupKey = `${dStr}_${log.projectId}`;
      if (!groups[groupKey]) {
        const matchProj = projectsList.find((p) => p.id === log.projectId);
        groups[groupKey] = {
          date: dStr,
          projectId: log.projectId,
          projectName: log.project?.name || matchProj?.name || "Unknown Project",
          records: [],
        };
      }
      groups[groupKey].records.push(log);
    });

    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredLogs, projectsList]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Detailed group records
  const activeDetailRecords = useMemo(() => {
    if (!selectedDetailGroup) return [];
    return logsList.filter((r) => {
      if (r.projectId !== selectedDetailGroup.projectId) return false;
      try {
        const parsed = new Date(r.date);
        if (isNaN(parsed.getTime())) return false;
        const dStr = parsed.toISOString().split("T")[0];
        return dStr === selectedDetailGroup.date;
      } catch {
        return false;
      }
    });
  }, [logsList, selectedDetailGroup]);

  // Filtered detailed group records when searching products
  const filteredDetailRecords = useMemo(() => {
    if (!detailProductSearch.trim()) return activeDetailRecords;
    const term = detailProductSearch.toLowerCase().trim();
    return activeDetailRecords.filter((r) => {
      const name = r.product?.name?.toLowerCase() || "";
      const size = r.product?.size?.toLowerCase() || "";
      return name.includes(term) || size.includes(term);
    });
  }, [activeDetailRecords, detailProductSearch]);

  const handleBackToLedger = () => {
    setSelectedDetailGroup(null);
    setDetailProductSearch("");
    setIsAddMode(false);
    setTempSelectedMaterials([]);
  };

  // Total quantity staged in current queue
  const totalStagedQuantity = useMemo(() => {
    return tempSelectedMaterials.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [tempSelectedMaterials]);

  // Total estimated amount staged in current queue
  const totalStagedAmount = useMemo(() => {
    return tempSelectedMaterials.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * Number(item.product?.price || 0),
      0
    );
  }, [tempSelectedMaterials]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ─────────────────────────────────────────────────────────────
          MODE 1: DIRECT ADD MATERIAL USAGE PAGE / CARD
      ───────────────────────────────────────────────────────────── */}
      {isAddMode && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-zinc-800/80 pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddMode(false);
                  setTempSelectedMaterials([]);
                  setProductSelectId("");
                  setProductSelectDisplay("");
                }}
                className="h-9 px-3 gap-1.5 font-semibold text-xs rounded-xl"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Ledger
              </Button>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 font-display flex items-center gap-2">
                  <PackagePlus className="h-6 w-6 text-primary" />
                  Log Material Usage
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Record paints and materials consumed on site directly
                </p>
              </div>
            </div>

            {selectedProject && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold px-3 py-1 text-xs rounded-full">
                  <Building className="h-3 w-3 mr-1 inline" />
                  {selectedProject.name}
                </Badge>
                <Badge variant="secondary" className="font-semibold text-xs px-3 py-1 rounded-full">
                  <Calendar className="h-3 w-3 mr-1 inline" />
                  {formatDate(currentDate)}
                </Badge>
              </div>
            )}
          </div>

          {/* Unified Card for Logging Material Usage */}
          <Card className="border border-slate-200/80 bg-white dark:bg-zinc-950 shadow-md rounded-2xl overflow-visible">
            <CardHeader className="py-4 px-6 border-b bg-slate-50/50 dark:bg-zinc-900/20">
              <CardTitle className="text-sm font-extrabold tracking-tight flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <ClipboardList className="h-4 w-4 text-primary" />
                Material Usage Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6 overflow-visible">
              {/* Step 1: Work Date & Project Site */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Work Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Work Date *
                  </label>
                  <Input
                    type="date"
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                    className="font-medium h-10 pl-3"
                  />
                </div>

                {/* Project Site Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-primary" />
                    Project Site *
                  </label>
                  <SearchableSelect
                    value={selectedProject?.id || ""}
                    displayValue={projectSelectDisplay}
                    options={projectsList
                      .filter(
                        (p) =>
                          !projectSelectDisplay ||
                          p.name.toLowerCase().includes(projectSelectDisplay.toLowerCase())
                      )
                      .slice(0, 15)
                      .map((p) => ({ id: p.id, label: p.name }))}
                    placeholder="Search project site..."
                    allLabel="Select a project site"
                    onSearchChange={setProjectSelectDisplay}
                    onSelect={(id, label) => {
                      const match = projectsList.find((p) => p.id === id);
                      if (match) {
                        setSelectedProject(match);
                        setProjectSelectDisplay(label);
                        fetchFullProjectDetails(id);
                      }
                    }}
                    onClear={() => {
                      setSelectedProject(null);
                      setProjectSelectDisplay("");
                      setFullSelectedProject(null);
                      setTempSelectedMaterials([]);
                      setProductSelectId("");
                      setProductSelectDisplay("");
                    }}
                    inputHeight="h-10"
                    textSize="text-sm font-medium"
                  />
                </div>
              </div>

              {/* Step 2: Product / Material Searchable Dropdown */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    Product / Material *
                  </span>
                  {selectedProject && (
                    <span className="text-[11px] text-muted-foreground font-normal">
                      (Site materials & all catalog products available)
                    </span>
                  )}
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                  <div className="flex-1">
                    <SearchableSelect
                      value={productSelectId}
                      displayValue={productSelectDisplay}
                      options={productOptions}
                      placeholder={
                        !selectedProject
                          ? "Select a project site first..."
                          : "Search product from catalog by name, brand, or category..."
                      }
                      disabled={!selectedProject}
                      onSearchChange={setProductSelectDisplay}
                      onSelect={(id, label) => {
                        handleSelectProductFromDropdown(id, label);
                      }}
                      onClear={() => {
                        setProductSelectId("");
                        setProductSelectDisplay("");
                      }}
                      inputHeight="h-10"
                      textSize="text-sm font-medium"
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={!selectedProject || !productSelectId}
                    onClick={() => {
                      handleSelectProductFromDropdown(productSelectId, productSelectDisplay);
                    }}
                    className="h-10 px-4 font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Log
                  </Button>
                </div>
              </div>

              {/* Step 3: Staged Materials List */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5 text-emerald-600" />
                    Materials Being Logged ({tempSelectedMaterials.length})
                  </h3>
                  {tempSelectedMaterials.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTempSelectedMaterials([])}
                      className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                    >
                      Clear All
                    </Button>
                  )}
                </div>

                {tempSelectedMaterials.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl space-y-2 bg-slate-50/40 dark:bg-zinc-900/20">
                    <PackagePlus className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-bold text-foreground">No materials added yet</p>
                    <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                      {!selectedProject
                        ? "Select a project site first, then search and choose products from the dropdown above."
                        : "Use the searchable dropdown above to select products from the catalog or site materials to log for this date."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="divide-y border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
                      {tempSelectedMaterials.map(
                        ({ queueId, product: p, quantity }) => {
                          if (!p) return null;
                          const isInvalid = Number(quantity) <= 0 || isNaN(Number(quantity));

                          return (
                            <div
                              key={queueId}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-xs text-slate-800 dark:text-slate-100">
                                    {p.name}
                                  </p>
                                  {p.brand?.name && (
                                    <span className="text-[10px] text-muted-foreground font-medium">
                                      ({p.brand.name})
                                    </span>
                                  )}
                                  {Number(p.price || 0) > 0 && (
                                    <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 px-1.5 py-0.5 rounded">
                                      ₹{Number(p.price).toLocaleString("en-IN")} / unit
                                    </span>
                                  )}
                                </div>
                                {Number(p.price || 0) > 0 && Number(quantity) > 0 && (
                                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                    Total: <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{(Number(quantity) * Number(p.price)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-4 self-end sm:self-center">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                    Quantity:
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      showClear={false}
                                      value={quantity === 0 ? "0" : (quantity ?? "")}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        handleUpdateQueueQuantity(
                                          queueId,
                                          raw === "" ? 0 : parseFloat(raw)
                                        );
                                      }}
                                      className={`h-8 w-20 text-xs font-bold text-center px-2 ${
                                        isInvalid
                                          ? "border-destructive focus-visible:ring-destructive text-destructive"
                                          : ""
                                      }`}
                                      placeholder="0"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQueueQuantity(queueId, 0)}
                                      tabIndex={-1}
                                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-full focus:outline-none ml-1.5"
                                      title="Clear value"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                    {isInvalid && (
                                      <span className="text-[10px] text-destructive font-semibold ml-2 whitespace-nowrap">
                                        Must be &gt; 0
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromQueue(queueId)}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                  title="Remove from log"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>

                    {/* Summary Bar */}
                    <div className="p-3.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-muted-foreground font-medium">
                          Total Products:{" "}
                          <strong className="text-foreground">{tempSelectedMaterials.length}</strong>
                        </span>
                        <span className="text-muted-foreground font-medium">
                          Total Quantity:{" "}
                          <strong className="text-foreground font-mono">{totalStagedQuantity} Packs</strong>
                        </span>
                        {totalStagedAmount > 0 && (
                          <span className="text-muted-foreground font-medium">
                            Total Value:{" "}
                            <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                              ₹{totalStagedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                      <Button
                        type="button"
                        onClick={() => handleSaveLogs(false)}
                        disabled={submittingLogs || hasInvalidQuantity}
                        className="flex-1 font-bold h-10 shadow-md"
                      >
                        {submittingLogs ? "Saving..." : "Save"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={submittingLogs || hasInvalidQuantity}
                        onClick={() => handleSaveLogs(true)}
                        className="sm:w-auto font-semibold h-10 px-4"
                      >
                        Save & Log Another Site
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setTempSelectedMaterials([]);
                          setIsAddMode(false);
                          setProductSelectId("");
                          setProductSelectDisplay("");
                        }}
                        className="sm:w-auto text-xs text-muted-foreground h-10 px-4"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 2: LEDGER VIEW (DEFAULT)
      ───────────────────────────────────────────────────────────── */}
      {!isAddMode && !selectedDetailGroup && (
        <>
          {/* PAGE HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 font-display">
                Material Usage Logs
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Quick Search for Project Site */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search project site..."
                  value={siteSearch}
                  onChange={(e) => setSiteSearch(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-lg shadow-sm font-medium"
                />
                {siteSearch && (
                  <button
                    type="button"
                    onClick={() => setSiteSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Button
                variant={showFilterCard ? "default" : "outline"}
                onClick={() => setShowFilterCard(!showFilterCard)}
                className="font-medium flex items-center gap-1.5 shadow-sm h-9 text-xs"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {filterSearch || filterDate || filterProjectId ? (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full font-medium">
                    !
                  </span>
                ) : null}
              </Button>

              <Button
                onClick={() => {
                  setIsAddMode(true);
                  setSelectedDetailGroup(null);
                }}
                className="font-medium flex items-center gap-1.5 shadow-sm h-9 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Log Material Usage
              </Button>
            </div>
          </div>

          {/* FILTER CONTROLS FOR TABLE LISTINGS */}
          {showFilterCard && (
            <Card className="border border-slate-200/60 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl">
              <CardHeader className="py-4 border-b border-slate-100 dark:border-zinc-900 flex flex-row items-center gap-2">
                <SlidersHorizontal size={14} className="text-primary" />
                <CardTitle className="text-xs font-extrabold uppercase text-slate-600 dark:text-zinc-400 tracking-wider">
                  Filter Ledger Records
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex flex-wrap gap-4 items-end">
                <div className="space-y-1 w-full sm:w-56">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">Search Product</label>
                  <Input
                    placeholder="Filter by product name..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1 w-full sm:w-48">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">Project Site</label>
                  <SearchableSelect
                    value={filterProjectId}
                    displayValue={filterProjectDisplay}
                    options={projectsList
                      .filter(
                        (p) =>
                          !filterProjectDisplay ||
                          p.name.toLowerCase().includes(filterProjectDisplay.toLowerCase())
                      )
                      .slice(0, 10)
                      .map((p) => ({ id: p.id, label: p.name }))}
                    placeholder="All Projects"
                    allLabel="All Projects"
                    onSearchChange={setFilterProjectDisplay}
                    onSelect={(id, label) => {
                      setFilterProjectId(id);
                      setFilterProjectDisplay(id ? label : "");
                    }}
                    onClear={() => {
                      setFilterProjectId("");
                      setFilterProjectDisplay("");
                    }}
                    inputHeight="h-9"
                    textSize="text-xs"
                  />
                </div>
                <div className="space-y-1 w-full sm:w-40">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">Log Date</label>
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterSearch("");
                    setFilterProjectId("");
                    setFilterDate("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold h-9 ml-auto"
                >
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          )}

          {/* GROUPED LEDGER LOGS TABLE */}
          <div className="space-y-6">
            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-zinc-950/40 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm font-semibold text-slate-500 animate-pulse">
                  Fetching material logs ledger...
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto no-scrollbar bg-card border border-border rounded-xl shadow-sm-soft">
                <table className="w-full min-w-max text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 transition-colors">
                      <th className="h-12 px-4 text-left font-medium text-muted-foreground select-none">Date</th>
                      <th className="h-12 px-4 text-left font-medium text-muted-foreground select-none">Project Site</th>
                      <th className="h-12 px-4 text-center font-medium text-muted-foreground select-none">Items Logged</th>
                      <th className="h-12 px-4 text-right font-medium text-muted-foreground select-none">Total Value</th>
                      <th className="h-12 px-4 text-center font-medium text-muted-foreground select-none">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="h-28 text-center text-muted-foreground align-middle">
                          <div className="flex flex-col items-center justify-center space-y-1.5">
                            {siteSearch ? (
                              <>
                                <p className="text-sm font-semibold">
                                  No project sites matching "{siteSearch}"
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSiteSearch("")}
                                  className="text-xs text-primary font-bold h-7"
                                >
                                  Clear Search
                                </Button>
                              </>
                            ) : filterSearch || filterProjectId || filterDate ? (
                              <>
                                <p className="text-sm font-semibold">
                                  No material logs match active filters.
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setFilterSearch("");
                                    setFilterProjectId("");
                                    setFilterDate("");
                                  }}
                                  className="text-xs text-primary font-bold h-7"
                                >
                                  Reset Filters
                                </Button>
                              </>
                            ) : (
                              <p className="text-sm font-semibold">
                                No material logs found. Click "Log Material Usage" above to start logging.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      groupedLogs.map((g) => {
                        const totalAmount = g.records.reduce((sum, r) => {
                          return (
                            sum +
                            Number(r.quantity || 0) * Number(r.product?.price || 0)
                          );
                        }, 0);
                        return (
                          <tr
                            key={`${g.date}_${g.projectId}`}
                            className="border-b transition-colors hover:bg-muted/30 cursor-pointer"
                            onClick={() => {
                              setSelectedDetailGroup(g);
                              setDetailProductSearch("");
                              const matchProj = projectsList.find((p) => p.id === g.projectId);
                              if (matchProj) {
                                setSelectedProject(matchProj);
                                setProjectSelectDisplay(matchProj.name);
                                fetchFullProjectDetails(matchProj.id);
                              }
                            }}
                          >
                            <td className="p-4 align-middle font-medium">{formatDate(g.date)}</td>
                            <td className="p-4 align-middle font-bold text-foreground">
                              {g.projectName}
                            </td>
                            <td className="p-4 align-middle text-center">
                              <Badge
                                variant="secondary"
                                className="bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-semibold text-xs px-2.5 py-0.5 rounded-full border border-slate-200/20"
                              >
                                {g.records.length} Item{g.records.length > 1 ? "s" : ""}
                              </Badge>
                            </td>
                            <td className="p-4 align-middle text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {totalAmount > 0
                                ? `₹${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "—"}
                            </td>
                            <td className="p-4 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedDetailGroup(g);
                                  setDetailProductSearch("");
                                  const matchProj = projectsList.find((p) => p.id === g.projectId);
                                  if (matchProj) {
                                    setSelectedProject(matchProj);
                                    setProjectSelectDisplay(matchProj.name);
                                    fetchFullProjectDetails(matchProj.id);
                                  }
                                }}
                                className="font-bold text-xs text-primary hover:text-primary hover:bg-primary/5 rounded-lg"
                              >
                                View Sheet
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 3: DETAILED VIEW MODE (VIEW SPECIFIC SHEET)
      ───────────────────────────────────────────────────────────── */}
      {selectedDetailGroup && !isAddMode && (
        <div className="space-y-6">
          {/* Back Button and Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-zinc-800/60 pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToLedger}
                className="h-9 w-9 p-0 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-display">
                  {selectedDetailGroup.projectName}
                </h1>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Material Usage Sheet for {formatDate(selectedDetailGroup.date)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold px-3 py-1 text-xs rounded-full">
                {activeDetailRecords.length} Items Logged
              </Badge>
              {activeDetailRecords.reduce((sum, r) => sum + Number(r.quantity || 0) * Number(r.product?.price || 0), 0) > 0 && (
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold px-3 py-1 text-xs rounded-full">
                  Total Value: ₹{activeDetailRecords
                    .reduce(
                      (sum, r) =>
                        sum + Number(r.quantity || 0) * Number(r.product?.price || 0),
                      0
                    )
                    .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Badge>
              )}
              <Button
                size="sm"
                className="font-bold h-8 ml-2"
                onClick={() => {
                  setCurrentDate(selectedDetailGroup.date);
                  const matchProj =
                    projectsList.find((p) => p.id === selectedDetailGroup.projectId) ||
                    selectedProject;
                  if (matchProj) {
                    setSelectedProject(matchProj);
                    setProjectSelectDisplay(matchProj.name);
                    fetchFullProjectDetails(matchProj.id);
                  }
                  setIsAddMode(true);
                  setSelectedDetailGroup(null);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Log More Materials
              </Button>
            </div>
          </div>

          <div className="w-full">
            {/* Logged Materials List */}
            <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-md bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <ClipboardList className="h-4 w-4 text-emerald-500" />
                  Logged Materials ({filteredDetailRecords.length}
                  {filteredDetailRecords.length !== activeDetailRecords.length ? ` / ${activeDetailRecords.length}` : ""})
                </CardTitle>

                {/* Product Search Field */}
                {activeDetailRecords.length > 0 && (
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search products in this sheet..."
                      value={detailProductSearch}
                      onChange={(e) => setDetailProductSearch(e.target.value)}
                      className="pl-8 pr-7 h-9 text-xs bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-lg font-medium"
                    />
                    {detailProductSearch && (
                      <button
                        type="button"
                        onClick={() => setDetailProductSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                        title="Clear product search"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {activeDetailRecords.length === 0 ? (
                  <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                    <Package className="h-10 w-10 opacity-30 animate-pulse" />
                    <p className="text-sm font-semibold">No materials logged for this site yet.</p>
                    <p className="text-xs opacity-70">Click "Log More Materials" above to add paint products.</p>
                  </div>
                ) : filteredDetailRecords.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2">
                    <Search className="h-8 w-8 opacity-30" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No products found matching "{detailProductSearch}"
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailProductSearch("")}
                      className="text-xs text-primary font-bold h-7"
                    >
                      Clear Product Search
                    </Button>
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto no-scrollbar">
                    <table className="w-full min-w-max text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 transition-colors">
                          <th className="h-12 px-4 text-left font-medium text-muted-foreground select-none">
                            Product Name
                          </th>
                          <th className="h-12 px-4 text-right font-medium text-muted-foreground select-none">
                            Price / Unit
                          </th>
                          <th className="h-12 px-4 text-center font-medium text-muted-foreground select-none">
                            Pack Quantity
                          </th>
                          <th className="h-12 px-4 text-right font-medium text-muted-foreground select-none">
                            Total Price
                          </th>
                          <th className="h-12 px-4 text-center font-medium text-muted-foreground select-none">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDetailRecords.map((r) => {
                          const unitPrice = Number(r.product?.price || 0);
                          const totalPrice = Number(r.quantity || 0) * unitPrice;
                          return (
                            <tr key={r.id} className="border-b transition-colors hover:bg-muted/30">
                              <td className="p-4 align-middle font-bold text-slate-800 dark:text-slate-200">
                                {r.product?.name}
                              </td>
                              <td className="p-4 align-middle text-right font-mono text-slate-700 dark:text-slate-300">
                                {unitPrice > 0 ? `₹${unitPrice.toLocaleString("en-IN")}` : "—"}
                              </td>
                              <td className="p-4 align-middle text-center font-semibold">
                                {Number(r.quantity)} Pack{Number(r.quantity) > 1 ? "s" : ""}
                              </td>
                              <td className="p-4 align-middle text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {totalPrice > 0
                                  ? `₹${totalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : "—"}
                              </td>
                              <td className="p-4 align-middle text-center">
                                <button
                                  onClick={() => handleDeleteLog(r.id, r.product?.name || "Product")}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                                  title="Delete Log"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

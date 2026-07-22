import { useState, useEffect, useMemo, useRef } from "react";
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
  Loader2,
  Trash2,
  Package,
  ChevronDown,
  ClipboardList,
  SlidersHorizontal
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
  if (normalized.endsWith("ltr")) {
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
  const { data: productsData } = useMasterData<Product>("products");

  // State for all material logs
  const [logsList, setLogsList] = useState<ProjectMaterialLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Form Fields State
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [fullSelectedProject, setFullSelectedProject] = useState<Project | null>(null);
  const [fetchingProject, setFetchingProject] = useState(false);

  
  // Temporary queue states before submitting
  const [tempSelectedMaterials, setTempSelectedMaterials] = useState<QueuedMaterial[]>([]);
  const [submittingLogs, setSubmittingLogs] = useState(false);

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

  // Site (Project) search dropdown states
  const [projectSearch, setProjectSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectSearching, setProjectSearching] = useState(false);
  const [localProjectsList, setLocalProjectsList] = useState<Project[]>([]);
  const projectRef = useRef<HTMLDivElement>(null);

  // Product search dropdown states
  const [productSearch, setProductSearch] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [productSearching, setProductSearching] = useState(false);
  const [localProductsList, setLocalProductsList] = useState<Product[]>([]);
  const productRef = useRef<HTMLDivElement>(null);

  // Listings filtration states
  const [filterSearch, setFilterSearch] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterProjectDisplay, setFilterProjectDisplay] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const { toast } = useToast();

  const projectsList = useMemo(() => Array.isArray(projectsData) ? projectsData : [], [projectsData]);
  const productsList = useMemo(() => Array.isArray(productsData) ? productsData : [], [productsData]);

  // Sync server list with local options
  useEffect(() => {
    setLocalProjectsList(projectsList);
  }, [projectsList]);

  useEffect(() => {
    setLocalProductsList(productsList);
  }, [productsList]);

  // Fetch all material logs on load
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const result = await apiRequest.fetchAll<ProjectMaterialLog>("project-material-logs");
      setLogsList(Array.isArray(result) ? result : []);
    } catch (err: any) {
      toast({
        title: "Fetch Error",
        description: err.message || "Failed to load material logs.",
        variant: "destructive",
      });
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Listeners for real-time synchronization
    const channel = supabase
      .channel("db-material-logs-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_material_logs" },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle outside clicks to close dropdown lists
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setProjectOpen(false);
      }
      if (productRef.current && !productRef.current.contains(e.target as Node)) {
        setProductOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Search projects on server
  const searchProjectsFromServer = async (query: string) => {
    if (!query.trim()) return;
    setProjectSearching(true);
    try {
      const res = await apiRequest.fetchAll<Project>("projects", { search: query });
      setLocalProjectsList(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setProjectSearching(false);
    }
  };

  // Search products on server
  const searchProductsFromServer = async (query: string) => {
    if (!query.trim()) return;
    setProductSearching(true);
    try {
      const res = await apiRequest.fetchAll<Product>("products", { search: query });
      setLocalProductsList(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setProductSearching(false);
    }
  };

  // Queue product locally before saving
  const handleQueueProduct = (product: Product & { allocatedArea?: number; unit?: string }) => {
    if (!selectedProject) {
      toast({
        title: "Site required",
        description: "Please choose a project site first.",
        variant: "destructive",
      });
      return;
    }

    setTempSelectedMaterials((prev) => [
      ...prev,
      {
        queueId: Math.random().toString(36).substring(2, 9),
        product,
        quantity: 1.0,
        allocatedArea: product.allocatedArea || 0,
        unit: product.unit || "sq.ft"
      }
    ]);
    setProductOpen(false);
    setProductSearch("");
  };

  const handleRemoveFromQueue = (queueId: string) => {
    setTempSelectedMaterials((prev) => prev.filter((item) => item.queueId !== queueId));
  };

  const handleUpdateQueueQuantity = (queueId: string, quantity: number) => {
    setTempSelectedMaterials((prev) =>
      prev.map((item) => (item.queueId === queueId ? { ...item, quantity } : item))
    );
  };

  // Save queued materials to database
  const handleSaveLogs = async () => {
    if (!selectedProject || tempSelectedMaterials.length === 0) return;

    setSubmittingLogs(true);
    let successCount = 0;
    const newRecords: ProjectMaterialLog[] = [];

    for (const item of tempSelectedMaterials) {
      try {
        const payload = {
          date: new Date(currentDate).toISOString(),
          projectId: selectedProject.id,
          productId: item.product.id,
          quantity: item.quantity,
        };

        const result = await apiRequest.create<ProjectMaterialLog>("project-material-logs", payload as any);

        const fullRecord: ProjectMaterialLog = {
          ...payload,
          ...result,
          project: { name: selectedProject.name },
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
      setLogsList((prev) => [...newRecords, ...prev]);
      toast({
        title: "Materials logged",
        description: `Successfully added ${successCount} material logs to "${selectedProject.name}".`,
      });
      setTempSelectedMaterials([]);
    }
    setSubmittingLogs(false);
  };

  // Delete logged entry
  const handleDeleteLog = async (id: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete the log for ${productName}?`)) return;

    try {
      await apiRequest.delete("project-material-logs", id);
      setLogsList((prev) => prev.filter((item) => item.id !== id));
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



  // Filter projects local list
  const filteredProjects = useMemo(() => {
    const term = projectSearch.toLowerCase().trim();
    if (!term) return localProjectsList.slice(0, 10);
    return localProjectsList.filter((p) => p.name?.toLowerCase().includes(term));
  }, [localProjectsList, projectSearch]);

  // Filter products across full catalog (all products)
  const filteredProducts = useMemo(() => {
    const catalog = localProductsList.length > 0 ? localProductsList : productsList;
    const term = productSearch.toLowerCase().trim();
    if (!term) return catalog.slice(0, 30);
    return catalog.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term)
    );
  }, [productsList, localProductsList, productSearch]);

  // Apply UI Filters for Listings
  const filteredLogs = useMemo(() => {
    return logsList.filter((log) => {
      // Product name search
      if (filterSearch.trim()) {
        const term = filterSearch.toLowerCase().trim();
        if (!log.product?.name?.toLowerCase().includes(term)) return false;
      }
      // Project filter
      if (filterProjectId && log.projectId !== filterProjectId) return false;
      // Date filter
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
  }, [logsList, filterSearch, filterDate, filterProjectId]);

  // Group logs by Date + Project
  const groupedLogs = useMemo(() => {
    const groups: Record<string, { date: string; projectId: string; projectName: string; records: ProjectMaterialLog[] }> = {};

    filteredLogs.forEach((log) => {
      const parsedDate = new Date(log.date);
      if (isNaN(parsedDate.getTime())) return;
      const dStr = parsedDate.toISOString().split("T")[0];
      const groupKey = `${dStr}_${log.projectId}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          date: dStr,
          projectId: log.projectId,
          projectName: log.project?.name || "Unknown Project",
          records: [],
        };
      }
      groups[groupKey].records.push(log);
    });

    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredLogs]);

  // Separate today's logs from historical logs
  const todayStr = new Date().toISOString().split("T")[0];
  const todaysGroups = useMemo(() => {
    return groupedLogs.filter((g) => g.date === currentDate);
  }, [groupedLogs, currentDate]);

  const historyGroups = useMemo(() => {
    return groupedLogs.filter((g) => g.date !== currentDate);
  }, [groupedLogs, currentDate]);

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

  // Toggle card states
  const [showAddCard, setShowAddCard] = useState(false);
  const [showFilterCard, setShowFilterCard] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
            Material Usage Logs
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showFilterCard ? "default" : "outline"}
            onClick={() => setShowFilterCard(!showFilterCard)}
            className="font-medium flex items-center gap-1.5 shadow-sm"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {(filterSearch || filterDate || filterProjectId) ? (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full font-medium">
                !
              </span>
            ) : null}
          </Button>

          <Button
            variant={showAddCard ? "default" : "outline"}
            onClick={() => setShowAddCard(!showAddCard)}
            className="font-medium flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Log Material Usage
          </Button>
        </div>
      </div>

      {/* ADD DAILY LOGS CARD */}
      {showAddCard && (
        <Card className="border border-slate-200/80 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl overflow-visible">
          <CardHeader className="border-b bg-slate-50/50 dark:bg-zinc-900/10">
            <CardTitle className="text-sm font-extrabold tracking-wide uppercase text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary animate-pulse" />
              Register Materials Added
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6 overflow-visible">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Select Work Date *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="date"
                    className="pl-9 font-medium"
                    value={currentDate}
                    onChange={(e) => {
                      setCurrentDate(e.target.value);
                      setTempSelectedMaterials([]);
                    }}
                  />
                </div>
              </div>

              {/* Site Selection Input */}
              <div ref={projectRef} className="space-y-1 relative overflow-visible">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Select Project Site *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9 pr-8 font-medium"
                    placeholder="Type project name... (Enter to search server)"
                    value={projectSearch}
                    onFocus={() => setProjectOpen(true)}
                    onChange={(e) => {
                      setProjectSearch(e.target.value);
                      setProjectOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchProjectsFromServer(projectSearch);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setProjectOpen(!projectOpen)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {projectOpen && (
                  <div className="absolute z-[999] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-48 overflow-y-auto mt-2 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                    {projectSearching && (
                      <div className="px-4 py-2 text-xs text-muted-foreground italic flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        Searching server...
                      </div>
                    )}
                    {filteredProjects.map((p) => (
                      <div
                        key={p.id}
                        className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm font-semibold transition-colors"
                        onMouseDown={() => {
                          setSelectedProject(p);
                          fetchFullProjectDetails(p.id);
                          setProjectSearch(p.name);
                          setProjectOpen(false);
                          setTempSelectedMaterials([]);
                        }}
                      >
                        {p.name}
                      </div>
                    ))}
                    {!projectSearching && filteredProjects.length === 0 && (
                      <div className="px-4 py-2 text-xs text-muted-foreground">
                        No matches. Press Enter to search server.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Product search box */}
            <div ref={productRef} className="space-y-1 relative overflow-visible">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Search & Add Product *
              </label>
              <div className="relative">
                <PackagePlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9 pr-8"
                  placeholder="Type product name or brand to select..."
                  value={productSearch}
                  disabled={!selectedProject}
                  onFocus={() => setProductOpen(true)}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchProductsFromServer(productSearch);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setProductOpen(!productOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {productOpen && selectedProject && (
                <div className="absolute z-[998] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-56 overflow-y-auto mt-2 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                  {productSearching && (
                    <div className="px-4 py-2 text-xs text-muted-foreground italic flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      Searching server...
                    </div>
                  )}
                  {filteredProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm font-semibold transition-colors flex items-center justify-between"
                      onMouseDown={() => handleQueueProduct(prod)}
                    >
                      <div>
                        <span>{prod.name}</span>
                        {prod.category && (
                          <span className="text-[10px] text-muted-foreground ml-2 px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-normal">
                            {prod.category}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {prod.size || "1ltr"}
                      </span>
                    </div>
                  ))}
                  {!productSearching && filteredProducts.length === 0 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground italic">
                      No matching products found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* QUEUED PRODUCTS LIST */}
            {tempSelectedMaterials.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-slate-600 dark:text-zinc-400 tracking-wider">
                    Selected Items to Log ({tempSelectedMaterials.length})
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveLogs}
                    disabled={submittingLogs}
                    className="font-bold text-xs shadow-md"
                  >
                    {submittingLogs ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Saving Logs...
                      </>
                    ) : (
                      <>
                        <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
                        Confirm & Save Log Entry
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {tempSelectedMaterials.map(({ queueId, product: p, quantity, allocatedArea, unit }) => {
                    const litresPerPack = getProductSizeInLitres(p.size);
                    const totalLitresLogged = quantity * litresPerPack;
                    const coveragePerLitre = Number(p.coverageSqFt || p.coverageRnFt || 0);
                    const actualCoverage = totalLitresLogged * coveragePerLitre;
                    const isExceeding = allocatedArea > 0 && actualCoverage > allocatedArea;

                    return (
                      <div
                        key={queueId}
                        className="p-3.5 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{p.name}</span>
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {p.size || "1ltr"}
                            </Badge>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromQueue(queueId)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Allocated Target</p>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {allocatedArea > 0 ? `${allocatedArea} ${unit}` : "No Allocation Set"}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={quantity}
                              onChange={(e) => handleUpdateQueueQuantity(queueId, Number(e.target.value))}
                              className="h-8 w-20 text-xs font-bold text-center px-1"
                            />
                            <span className="text-[10px] font-bold text-slate-400">Packs</span>
                          </div>

                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Calculated Coverage</p>
                            <p className={`text-xs font-extrabold ${isExceeding ? "text-rose-600" : "text-emerald-600"}`}>
                              {actualCoverage.toFixed(2)} {unit}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                  .filter((p) => !filterProjectDisplay || p.name.toLowerCase().includes(filterProjectDisplay.toLowerCase()))
                  .slice(0, 10)
                  .map((p) => ({ id: p.id, label: p.name }))}
                placeholder="All Projects"
                allLabel="All Projects"
                onSearchChange={setFilterProjectDisplay}
                onSelect={(id, label) => { setFilterProjectId(id); setFilterProjectDisplay(id ? label : ""); }}
                onClear={() => { setFilterProjectId(""); setFilterProjectDisplay(""); }}
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

      {/* GROUPED LEDGER LOGS AND TIMELINE */}
      <div className="space-y-6">
        {loadingLogs ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-zinc-950/40 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-slate-500 animate-pulse">
              Fetching material logs ledger...
            </p>
          </div>
        ) : (
          <>
            {/* TODAY'S LIVE MATERIAL GROUPS */}
            {todaysGroups.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold tracking-widest text-primary uppercase flex items-center gap-1">
                  <span className="relative flex h-2 w-2 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Today's Material Additions
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {todaysGroups.map((g) => (
                    <Card
                      key={`${g.date}_${g.projectId}`}
                      className="border border-slate-200/80 bg-white dark:bg-zinc-950 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="p-5 pb-3 border-b border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex justify-between items-center">
                          <div className="space-y-0.5">
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                              {g.projectName}
                            </h4>
                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                              {formatDate(g.date)}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/25 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                            {g.records.length} Items Logged
                          </Badge>
                        </div>

                        <div className="p-5 pt-4 space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {g.records.map((r) => (
                              <Badge
                                key={r.id}
                                variant="secondary"
                                className="pl-3 pr-2 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200/40 rounded-full flex items-center gap-2 select-none"
                              >
                                <span className="text-slate-700 dark:text-slate-300">
                                  {r.product?.name || "Paint Product"}{" "}
                                  <span className="text-[10px] font-extrabold text-primary ml-1">
                                    {Number(r.quantity) * getProductSizeInLitres(r.product?.size)} L ({Number(r.quantity)} pack{Number(r.quantity) > 1 ? "s" : ""})
                                  </span>
                                </span>
                                <button
                                  onClick={() => handleDeleteLog(r.id, r.product?.name || "Product")}
                                  className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-650 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* PAST HISTORY LOG GROUPS */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-extrabold tracking-widest text-slate-400 dark:text-zinc-650 uppercase flex items-center gap-1 select-none">
                <ClipboardList className="h-3.5 w-3.5" />
                Historical Material Logs
              </h3>

              {historyGroups.length === 0 && todaysGroups.length === 0 ? (
                <div className="p-14 text-center rounded-2xl bg-white/40 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center space-y-4">
                  <Package className="h-12 w-12 text-slate-300 dark:text-zinc-700" />
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-base">
                      No Material Logs Found
                    </h4>
                    <p className="text-sm text-slate-500 max-w-sm">
                      Check your filters or register today's paint quantities to construct project checkbooks.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {historyGroups.map((g) => (
                    <Card
                      key={`${g.date}_${g.projectId}`}
                      className="border border-slate-200/50 bg-white dark:bg-zinc-950 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="p-5 pb-3 border-b border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex justify-between items-center">
                          <div className="space-y-0.5">
                            <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-350">
                              {g.projectName}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {formatDate(g.date)}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-slate-50 text-slate-650 border-slate-200 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                            {g.records.length} Items Logged
                          </Badge>
                        </div>

                        <div className="p-5 pt-4 space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {g.records.map((r) => (
                              <Badge
                                key={r.id}
                                variant="secondary"
                                className="pl-3 pr-2 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200/40 rounded-full flex items-center gap-2 select-none"
                              >
                                <span className="text-slate-700 dark:text-slate-300">
                                  {r.product?.name || "Paint Product"}{" "}
                                  <span className="text-[10px] font-extrabold text-primary ml-1">
                                    {Number(r.quantity) * getProductSizeInLitres(r.product?.size)} L ({Number(r.quantity)} pack{Number(r.quantity) > 1 ? "s" : ""})
                                  </span>
                                </span>
                                <button
                                  onClick={() => handleDeleteLog(r.id, r.product?.name || "Product")}
                                  className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-650 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from "react";
import { useMasterData } from "@/hooks/use-master-data";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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

interface QueuedMaterial {
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
  const [copyFromDate, setCopyFromDate] = useState("");
  
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
  const [localProductsList, setLocalProductsList] = useState<Product[]>([]);
  const productRef = useRef<HTMLDivElement>(null);

  // Listings filtration states
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");

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

    // Check if already queued
    if (tempSelectedMaterials.some((item) => item.product.id === product.id)) {
      toast({
        title: "Product already queued",
        description: `"${product.name}" is already in the list to be added.`,
        variant: "destructive",
      });
      setProductOpen(false);
      return;
    }

    // Check if duplicate on same date & project in existing logs
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const isDuplicate = logsList.some((log) => {
      const logDate = new Date(log.date);
      return (
        log.projectId === selectedProject.id &&
        log.productId === product.id &&
        logDate >= startOfDay &&
        logDate <= endOfDay
      );
    });

    if (isDuplicate) {
      toast({
        title: "Product already logged",
        description: `"${product.name}" is already logged for this project on today's date.`,
        variant: "destructive",
      });
      setProductOpen(false);
      return;
    }

    setTempSelectedMaterials((prev) => [
      ...prev,
      {
        product,
        quantity: 1.0,
        allocatedArea: product.allocatedArea || 0,
        unit: product.unit || "sq.ft"
      }
    ]);
    setProductOpen(false);
    setProductSearch("");
  };

  const handleRemoveFromQueue = (productId: string) => {
    setTempSelectedMaterials((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleUpdateQueueQuantity = (productId: string, quantity: number) => {
    setTempSelectedMaterials((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
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

  // Copy logs from past date
  const handleCopyLogs = async () => {
    if (!selectedProject || !copyFromDate) return;

    // Filter past date records from logsList
    const startOfCopy = new Date(copyFromDate);
    startOfCopy.setHours(0, 0, 0, 0);
    const endOfCopy = new Date(copyFromDate);
    endOfCopy.setHours(23, 59, 59, 999);

    const pastRecords = logsList.filter((log) => {
      const d = new Date(log.date);
      return log.projectId === selectedProject.id && d >= startOfCopy && d <= endOfCopy;
    });

    if (pastRecords.length === 0) {
      toast({
        title: "No source logs",
        description: `No material logs found for "${formatDate(copyFromDate)}".`,
        variant: "destructive",
      });
      return;
    }

    // Filter out products already logged on the target date
    const startOfTarget = new Date(currentDate);
    startOfTarget.setHours(0, 0, 0, 0);
    const endOfTarget = new Date(currentDate);
    endOfTarget.setHours(23, 59, 59, 999);

    const targetProductIds = new Set(
      logsList
        .filter((log) => {
          const d = new Date(log.date);
          return log.projectId === selectedProject.id && d >= startOfTarget && d <= endOfTarget;
        })
        .map((log) => log.productId)
    );

    const materialsToCopy = pastRecords.filter((r) => !targetProductIds.has(r.productId));

    if (materialsToCopy.length === 0) {
      toast({
        title: "Logs already exist",
        description: "All products from that date are already logged for the target date.",
      });
      return;
    }

    try {
      const payload = materialsToCopy.map((r) => ({
        date: new Date(currentDate).toISOString(),
        projectId: selectedProject.id,
        productId: r.productId,
        quantity: Number(r.quantity),
      }));

      const results = await apiRequest.bulkCreate<ProjectMaterialLog>("project-material-logs", payload as any);

      // Update local state
      const formattedResults = results.map((res, i) => {
        const originalInput = payload[i];
        const matchingProduct = productsList.find((p) => p.id === originalInput.productId);
        return {
          ...originalInput,
          ...res,
          project: { name: selectedProject.name },
          product: matchingProduct
            ? {
                name: matchingProduct.name,
                price: Number(matchingProduct.price),
              }
            : undefined,
        };
      });

      setLogsList((prev) => [...formattedResults, ...prev]);
      toast({
        title: "Materials copied",
        description: `Successfully copied ${formattedResults.length} material logs.`,
      });
    } catch (err: any) {
      toast({
        title: "Copy operation failed",
        description: err.message || "An error occurred.",
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

  // Get list of products allocated to selected project
  const allocatedProductsList = useMemo(() => {
    if (!fullSelectedProject) return [];
    return (fullSelectedProject.projectProducts || []).map((pp: any) => ({
      ...pp.product,
      allocatedArea: Number(pp.area),
      unit: pp.unit
    })).filter((p: any) => p != null && p.id);
  }, [fullSelectedProject]);

  // Filter products local list
  const filteredProducts = useMemo(() => {
    const term = productSearch.toLowerCase().trim();
    if (!term) return allocatedProductsList;
    return allocatedProductsList.filter((p) => p.name?.toLowerCase().includes(term));
  }, [allocatedProductsList, productSearch]);

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

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-1.5 border-b pb-5">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
            Material Usage Logs
          </h2>
        </div>
        <p className="text-sm text-slate-500 font-medium">
          Log actual materials and paint quantities delivered/consumed on project sites.
        </p>
      </div>

      {/* ACTIONS GRID: LOG DATA + COPY LISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD DAILY LOGS CARD */}
        <Card className="lg:col-span-2 border border-slate-200/80 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl overflow-visible">
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
                    className="pl-9 pr-8"
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
                          setProjectSearch(p.name);
                          setProjectOpen(false);
                          setTempSelectedMaterials([]);
                          fetchFullProjectDetails(p.id);
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

              {/* Add Material Dropdown */}
              <div ref={productRef} className="space-y-1 md:col-span-2 relative overflow-visible">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Select Paint Product *
                </label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9 pr-8"
                    placeholder="Search and select product name..."
                    value={productSearch}
                    disabled={!selectedProject}
                    onFocus={() => setProductOpen(true)}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setProductOpen(true);
                    }}
                  />
                </div>

                {productOpen && selectedProject && (
                  <div className="absolute z-[998] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-48 overflow-y-auto mt-2 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        className="px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm font-semibold transition-colors flex items-center justify-between"
                        onMouseDown={() => handleQueueProduct(p)}
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            Allocated: {p.allocatedArea} {p.unit}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono font-bold">
                          {p.category}
                        </span>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="px-4 py-2.5 text-xs text-rose-500 font-semibold italic text-left">
                        No products are currently scoped/allocated to this project site. Go to Projects and add products first.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Queued Materials Staging List */}
            {tempSelectedMaterials.length > 0 && (
              <div className="md:col-span-2 space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                    Ready to Log ({tempSelectedMaterials.length})
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
                        Logging...
                      </>
                    ) : (
                      <>
                        <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
                        Save Logs
                      </>
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tempSelectedMaterials.map(({ product: p, quantity, allocatedArea, unit }) => {
                    const coverageSqFtL = p.coverageSqFt != null ? Number(p.coverageSqFt) : 0;
                    const coverageRnFtL = p.coverageRnFt != null ? Number(p.coverageRnFt) : 0;
                    const actualCoverage = unit === "sq.ft" ? quantity * coverageSqFtL : quantity * coverageRnFtL;
                    const isExceeding = actualCoverage > allocatedArea;

                    return (
                      <div
                        key={p.id}
                        className="flex flex-col p-4 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5 max-w-[75%] text-left">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">
                              Allocated: <span className="font-bold text-slate-650 dark:text-slate-350">{allocatedArea} {unit}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromQueue(p.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between border-t pt-2.5">
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={quantity}
                              onChange={(e) => handleUpdateQueueQuantity(p.id, Number(e.target.value))}
                              className="h-8 w-20 text-xs font-bold text-center px-1"
                            />
                            <span className="text-[10px] font-bold text-slate-400">Litres</span>
                          </div>

                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Coverage</p>
                            <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                              {actualCoverage.toFixed(2)} {unit}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end pt-0.5">
                          {isExceeding ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 text-[10px] py-0">
                              Exceeding by {(actualCoverage - allocatedArea).toFixed(2)} {unit}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 text-[10px] py-0">
                              Within Limit ({(allocatedArea - actualCoverage).toFixed(2)} {unit} remaining)
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* COPY PAST DATE LOGS CARD */}
        <Card className="border border-slate-200/80 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl flex flex-col justify-between">
          <div>
            <CardHeader className="border-b bg-slate-50/50 dark:bg-zinc-900/10">
              <CardTitle className="text-sm font-extrabold tracking-wide uppercase text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Copy Roster Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Quickly copy a project's product list and quantities from a previous work day to today's staging queue.
              </p>
              
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block">
                    Copy Logs From Date
                  </label>
                  <Input
                    type="date"
                    value={copyFromDate}
                    onChange={(e) => setCopyFromDate(e.target.value)}
                    disabled={!selectedProject}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full font-bold text-xs bg-white hover:bg-slate-100 h-9"
                  onClick={handleCopyLogs}
                  disabled={!selectedProject || !copyFromDate}
                >
                  Replicate Logs
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>

      {/* FILTER CONTROLS FOR TABLE LISTINGS */}
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
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Projects</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
                                    {Number(r.quantity)} L
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
                                    {Number(r.quantity)} L
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

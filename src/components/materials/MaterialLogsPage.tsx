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
  SlidersHorizontal,
  ArrowLeft
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
  const [selectedDetailGroup, setSelectedDetailGroup] = useState<{ date: string; projectId: string; projectName: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    const activeProject = selectedProject || (selectedDetailGroup && projectsList.find(p => p.id === selectedDetailGroup.projectId));
    if (!activeProject || tempSelectedMaterials.length === 0) return;

    setSubmittingLogs(true);
    let successCount = 0;
    const newRecords: ProjectMaterialLog[] = [];

    const activeDate = selectedDetailGroup ? selectedDetailGroup.date : currentDate;

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
      setLogsList((prev) => [...newRecords, ...prev]);
      toast({
        title: "Materials logged",
        description: `Successfully added ${successCount} material logs to "${activeProject.name}".`,
      });
      setTempSelectedMaterials([]);
      setIsModalOpen(false);
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

  const activeDetailRecords = useMemo(() => {
    if (!selectedDetailGroup) return [];
    return logsList.filter((r) => {
      if (r.projectId !== selectedDetailGroup.projectId) return false;
      try {
        const parsed = new Date(r.date);
        if (isNaN(parsed.getTime())) return false;
        const offset = parsed.getTimezoneOffset();
        const local = new Date(parsed.getTime() - (offset * 60 * 1000));
        return local.toISOString().split("T")[0] === selectedDetailGroup.date;
      } catch {
        return false;
      }
    });
  }, [logsList, selectedDetailGroup]);

  const handleBackToLedger = () => {
    setSelectedDetailGroup(null);
    setSelectedProject(null);
    setFullSelectedProject(null);
    setTempSelectedMaterials([]);
  };

  // Toggle card states
  const [showAddCard, setShowAddCard] = useState(false);
  const [showFilterCard, setShowFilterCard] = useState(false);  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Ledger Mode */}
      {!selectedDetailGroup && (
        <>
          {/* PAGE HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 font-display">
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
                  Start Material Logging
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4 overflow-visible">
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
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

                <Button
                  className="w-full font-bold shadow-md h-10 mt-2"
                  disabled={!selectedProject}
                  onClick={() => {
                    if (selectedProject) {
                      setSelectedDetailGroup({
                        date: currentDate,
                        projectId: selectedProject.id,
                        projectName: selectedProject.name
                      });
                      fetchFullProjectDetails(selectedProject.id);
                      setShowAddCard(false);
                    }
                  }}
                >
                  Start Logging Materials
                </Button>
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
              <div className="w-full overflow-x-auto no-scrollbar bg-card border border-border rounded-xl shadow-sm-soft">
                <table className="w-full min-w-max text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 transition-colors">
                      <th className="h-12 px-4 text-left font-medium text-muted-foreground select-none">Date</th>
                      <th className="h-12 px-4 text-left font-medium text-muted-foreground select-none">Project Site</th>
                      <th className="h-12 px-4 text-center font-medium text-muted-foreground select-none">Items Logged</th>
                      <th className="h-12 px-4 text-right font-medium text-muted-foreground select-none">Total Volume</th>
                      <th className="h-12 px-4 text-center font-medium text-muted-foreground select-none">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="h-24 text-center text-muted-foreground align-middle">
                          No results found.
                        </td>
                      </tr>
                    ) : (
                      groupedLogs.map((g) => {
                        const totalVolume = g.records.reduce((sum, r) => {
                          return sum + (Number(r.quantity || 0) * getProductSizeInLitres(r.product?.size));
                        }, 0);
                        return (
                          <tr
                            key={`${g.date}_${g.projectId}`}
                            className="border-b transition-colors hover:bg-muted/30 cursor-pointer"
                            onClick={() => {
                              setSelectedDetailGroup(g);
                              const matchProj = projectsList.find(p => p.id === g.projectId);
                              if (matchProj) {
                                setSelectedProject(matchProj);
                                fetchFullProjectDetails(matchProj.id);
                              }
                            }}
                          >
                            <td className="p-4 align-middle">
                              {formatDate(g.date)}
                            </td>
                            <td className="p-4 align-middle font-bold text-foreground">
                              {g.projectName}
                            </td>
                            <td className="p-4 align-middle text-center">
                              <Badge variant="secondary" className="bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-semibold text-xs px-2.5 py-0.5 rounded-full border border-slate-200/20">
                                {g.records.length} Item{g.records.length > 1 ? "s" : ""}
                              </Badge>
                            </td>
                            <td className="p-4 align-middle text-right font-mono font-bold">
                              {totalVolume.toFixed(1)} Litres
                            </td>
                            <td className="p-4 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedDetailGroup(g);
                                  const matchProj = projectsList.find(p => p.id === g.projectId);
                                  if (matchProj) {
                                    setSelectedProject(matchProj);
                                    fetchFullProjectDetails(matchProj.id);
                                  }
                                }}
                                className="font-bold text-xs text-primary hover:text-primary hover:bg-primary/5 rounded-lg"
                              >
                                View & Log
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

      {/* Detailed View Mode */}
      {selectedDetailGroup && (
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
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold px-3 py-1 text-xs rounded-full">
                Volume: {activeDetailRecords.reduce((sum, r) => sum + (Number(r.quantity || 0) * getProductSizeInLitres(r.product?.size)), 0).toFixed(1)} L
              </Badge>
              <Button size="sm" className="font-bold h-8 ml-2" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Log Materials
              </Button>
            </div>
          </div>

          <div className="w-full">
            {/* Logged Materials List */}
            <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-md bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden">
              <CardHeader className="p-5 border-b border-slate-100 dark:border-zinc-900">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <ClipboardList className="h-4 w-4 text-emerald-500" />
                  Logged Materials ({activeDetailRecords.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {activeDetailRecords.length === 0 ? (
                  <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                    <Package className="h-10 w-10 opacity-30 animate-pulse" />
                    <p className="text-sm font-semibold">No materials logged for this site yet.</p>
                    <p className="text-xs opacity-70">Click "Log Materials" above to search and add paint products.</p>
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto no-scrollbar">
                    <table className="w-full min-w-max text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 transition-colors">
                          <th className="h-12 px-4 text-left font-medium text-muted-foreground select-none">Product Name</th>
                          <th className="h-12 px-4 text-center font-medium text-muted-foreground select-none">Pack Quantity</th>
                          <th className="h-12 px-4 text-right font-medium text-muted-foreground select-none">Total Volume</th>
                          <th className="h-12 px-4 text-center font-medium text-muted-foreground select-none">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDetailRecords.map((r) => {
                          const litresPerPack = getProductSizeInLitres(r.product?.size);
                          const totalLitres = Number(r.quantity) * litresPerPack;
                          return (
                            <tr key={r.id} className="border-b transition-colors hover:bg-muted/30">
                              <td className="p-4 align-middle font-bold text-slate-800 dark:text-slate-200">
                                {r.product?.name}
                                <span className="text-[10px] text-muted-foreground font-normal ml-2">({r.product?.size || "1ltr"})</span>
                              </td>
                              <td className="p-4 align-middle text-center font-semibold">
                                {Number(r.quantity)} Pack{Number(r.quantity) > 1 ? "s" : ""}
                              </td>
                              <td className="p-4 align-middle text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {totalLitres.toFixed(1)} Litres
                              </td>
                              <td className="p-4 align-middle text-center">
                                <button
                                  onClick={() => handleDeleteLog(r.id, r.product?.name || "Product")}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
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

          {/* Form Entry Dialog Modal */}
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-visible">
              <DialogHeader>
                <DialogTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Log Materials Added
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2 overflow-visible">
                {/* Search Products */}
                <div ref={productRef} className="space-y-1.5 relative overflow-visible">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Search & Select Product *
                  </label>
                  <div className="relative">
                    <PackagePlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-9 pr-8"
                      placeholder="Type product name or brand to select..."
                      value={productSearch}
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {productOpen && (
                    <div className="absolute z-[999] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-48 overflow-y-auto mt-2 animate-in fade-in-50 slide-in-from-top-1 duration-150">
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
                    </div>
                  )}
                </div>

                {/* Queued Materials List */}
                {tempSelectedMaterials.length > 0 && (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase text-slate-600 dark:text-zinc-400 tracking-wider">
                        Queue ({tempSelectedMaterials.length})
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
                            Saving...
                          </>
                        ) : (
                          <>
                            <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
                            Log Entry
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {tempSelectedMaterials.map(({ queueId, product: p, quantity, allocatedArea, unit }) => {
                        const litresPerPack = getProductSizeInLitres(p.size);
                        const totalLitresLogged = quantity * litresPerPack;
                        const coveragePerLitre = Number(p.coverageSqFt || p.coverageRnFt || 0);
                        const actualCoverage = totalLitresLogged * coveragePerLitre;
                        const isExceeding = allocatedArea > 0 && actualCoverage > allocatedArea;

                        return (
                          <div
                            key={queueId}
                            className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{p.name}</span>
                                <Badge variant="outline" className="text-[9px] px-1 py-0 rounded">
                                  {p.size || "1ltr"}
                                </Badge>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleQueueProduct(p)} // toggles remove from queue
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-0.5 items-center">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={quantity}
                                  onChange={(e) => handleUpdateQueueQuantity(queueId, Number(e.target.value))}
                                  className="h-7 w-16 text-xs text-center px-1"
                                />
                                <span className="text-[10px] text-slate-400 font-bold">Packs</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block font-semibold">Coverage:</span>
                                <span className={`text-[11px] font-bold ${isExceeding ? "text-rose-600" : "text-emerald-600"}`}>
                                  {actualCoverage.toFixed(1)} {unit}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="h-9 text-xs font-bold"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

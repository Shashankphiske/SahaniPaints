import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMasterData } from "@/hooks/use-master-data";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  PackageMinus,
  Calendar,
  AlertTriangle,
  Building,
  Layers,
  Sparkles,
  FilterX,
} from "lucide-react";
import type { Project, Product, WastageMaterialLog } from "@/types/master";

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

export default function WastageMaterialLogsPage() {
  const queryClient = useQueryClient();

  // Master lists
  const { data: projectsData, isLoading: loadingProjects } = useMasterData<Project>("projects");
  const { data: allProductsData } = useMasterData<Product>("products");

  // Fetch wastage logs from API
  const { data: wastageLogsRaw = [], isLoading: loadingLogs } = useQuery<WastageMaterialLog[]>({
    queryKey: ["wastage-materials"],
    queryFn: async () => {
      const res = await apiRequest.fetchAll<WastageMaterialLog>("wastage-materials");
      return Array.isArray(res) ? res : [];
    },
  });

  const projectsList = useMemo(() => (Array.isArray(projectsData) ? projectsData : []), [projectsData]);
  const allProducts = useMemo(() => (Array.isArray(allProductsData) ? allProductsData : []), [allProductsData]);
  const wastageLogs = useMemo(() => (Array.isArray(wastageLogsRaw) ? wastageLogsRaw : []), [wastageLogsRaw]);

  // Dialog State
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDisplay, setProjectDisplay] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [fullSelectedProject, setFullSelectedProject] = useState<Project | null>(null);
  const [fetchingProject, setFetchingProject] = useState(false);

  // Form Inputs
  const [selectedProductId, setSelectedProductId] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [color, setColor] = useState("");
  const [shade, setShade] = useState("");
  const [quantity, setQuantity] = useState("");
  const [logDate, setLogDate] = useState(() => getTodayString());
  const [remarks, setRemarks] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("ALL");

  // Fetch full project details to retrieve site-allocated products
  const fetchProjectDetails = async (projectId: string) => {
    if (!projectId) {
      setFullSelectedProject(null);
      return;
    }
    setFetchingProject(true);
    try {
      const full = await apiRequest.execute<Project>(`/projects/${projectId}`);
      setFullSelectedProject(full);
    } catch (err: any) {
      console.error("Error fetching project details:", err);
    } finally {
      setFetchingProject(false);
    }
  };

  const handleSelectProject = (projectId: string, display: string) => {
    setSelectedProjectId(projectId);
    setProjectDisplay(display);
    setProjectFilter("");
    setSelectedProductId("");
    setMaterialName("");
    setProductFilter("");
    fetchProjectDetails(projectId);
  };

  const handleClearProject = () => {
    setSelectedProjectId("");
    setProjectDisplay("");
    setProjectFilter("");
    setFullSelectedProject(null);
    setSelectedProductId("");
    setMaterialName("");
  };

  // Products available in the dropdown
  const productOptions = useMemo(() => {
    const q = (productFilter || "").toLowerCase().trim();
    const siteProducts = fullSelectedProject?.projectProducts?.map((pp: any) => pp.product).filter(Boolean) || [];

    if (siteProducts.length > 0) {
      const siteFiltered = siteProducts
        .filter((p: any) => !q || p.name.toLowerCase().includes(q))
        .map((p: any) => ({ id: p.id, label: `${p.name} (Site Product)` }));

      const siteIds = new Set(siteProducts.map((p: any) => p.id));
      const catalogFiltered = allProducts
        .filter((p) => !siteIds.has(p.id) && (!q || p.name.toLowerCase().includes(q)))
        .slice(0, 15)
        .map((p) => ({ id: p.id, label: p.name }));

      return [...siteFiltered, ...catalogFiltered];
    }

    return allProducts
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 20)
      .map((p) => ({ id: p.id, label: p.name }));
  }, [allProducts, fullSelectedProject, productFilter]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: {
      projectId: string;
      material: string;
      color: string;
      shade: string;
      quantity: string;
      date: string;
      remarks?: string;
    }) => {
      return await apiRequest.create<WastageMaterialLog>("wastage-materials", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wastage-materials"] });
      toast({
        title: "Wastage Logged",
        description: `Successfully recorded wastage for "${materialName}".`,
      });
      setIsOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({
        title: "Error creating log",
        description: err.message || "Failed to record wastage material.",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest.delete("wastage-materials", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wastage-materials"] });
      toast({
        title: "Log Removed",
        description: "Wastage material log has been deleted.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Delete Failed",
        description: err.message || "Could not delete wastage log.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedProjectId("");
    setProjectDisplay("");
    setProjectFilter("");
    setFullSelectedProject(null);
    setSelectedProductId("");
    setMaterialName("");
    setProductFilter("");
    setColor("");
    setShade("");
    setQuantity("");
    setRemarks("");
    setLogDate(getTodayString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProjectId) {
      toast({
        title: "Project Required",
        description: "Please select a project site.",
        variant: "destructive",
      });
      return;
    }

    if (!materialName.trim()) {
      toast({
        title: "Material Required",
        description: "Please specify the material name.",
        variant: "destructive",
      });
      return;
    }

    if (!shade.trim()) {
      toast({
        title: "Shade Number Required",
        description: "Shade number is compulsory.",
        variant: "destructive",
      });
      return;
    }

    if (!quantity.trim()) {
      toast({
        title: "Quantity Required",
        description: "Please specify how much material was wasted.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      projectId: selectedProjectId,
      material: materialName.trim(),
      color: color.trim() || "—",
      shade: shade.trim(),
      quantity: quantity.trim(),
      date: logDate,
      remarks: remarks.trim(),
    });
  };

  // Filtered list
  const filteredLogs = useMemo(() => {
    return wastageLogs.filter((log) => {
      if (filterProjectId !== "ALL" && log.projectId !== filterProjectId) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const pName = (log.projectName || log.project?.name || "").toLowerCase();
      const mat = (log.material || "").toLowerCase();
      const col = (log.color || "").toLowerCase();
      const sh = (log.shade || "").toLowerCase();
      const rem = (log.remarks || "").toLowerCase();

      return (
        pName.includes(q) ||
        mat.includes(q) ||
        col.includes(q) ||
        sh.includes(q) ||
        rem.includes(q)
      );
    });
  }, [wastageLogs, filterProjectId, searchQuery]);

  // Aggregate stats
  const uniqueSites = useMemo(() => {
    const set = new Set(wastageLogs.map((l) => l.projectId));
    return set.size;
  }, [wastageLogs]);

  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <PackageMinus className="h-6 w-6 text-rose-500" />
            <span>Wastage Material Logs</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor and record damaged, spoiled, or wasted paint & material inventory on site.
          </p>
        </div>

        {/* Add Wastage Log Button Trigger */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold flex items-center gap-1.5 shadow-sm bg-rose-600 hover:bg-rose-700 text-white">
              <Plus className="h-4 w-4" />
              <span>Record Wastage</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl">
            <DialogHeader className="pb-3 border-b border-border/60">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
                <span>New Wastage Material Entry</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Log spoiled, spilled, or wasted paint stock against a site project.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-2">
              {/* Site Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/70 dark:bg-zinc-900/40 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Choose Project Site *
                  </label>
                  <SearchableSelect
                    value={selectedProjectId}
                    displayValue={projectDisplay}
                    options={projectsList
                      .filter((p) => !projectFilter || p.name.toLowerCase().includes(projectFilter.toLowerCase()))
                      .slice(0, 15)
                      .map((p) => ({ id: p.id, label: p.name }))}
                    placeholder="Search or select site..."
                    inputHeight="h-10"
                    onSearchChange={setProjectFilter}
                    onSelect={(id, label) => handleSelectProject(id, label)}
                    onClear={handleClearProject}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Wastage Date *
                  </label>
                  <Input
                    type="date"
                    max={getTodayString()}
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="h-10 text-sm font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Material Details Section */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-3.5 shadow-2xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Choose Material / Paint Product *
                  </label>
                  <SearchableSelect
                    value={selectedProductId || materialName}
                    displayValue={materialName}
                    options={productOptions}
                    placeholder={fetchingProject ? "Loading site products..." : "Search product or type material name..."}
                    inputHeight="h-10"
                    onSearchChange={(q) => {
                      setProductFilter(q);
                      setMaterialName(q);
                      setSelectedProductId("");
                    }}
                    onSelect={(id, label) => {
                      const cleanName = label.replace(/\s*\(Site Product\)$/, "");
                      setSelectedProductId(id);
                      setMaterialName(cleanName);
                      setProductFilter("");
                    }}
                    onClear={() => {
                      setSelectedProductId("");
                      setMaterialName("");
                      setProductFilter("");
                    }}
                    onEnter={(val) => setMaterialName(val)}
                    required
                  />
                </div>

                {/* Color and Shade */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Color
                    </label>
                    <Input
                      placeholder="e.g. Royal Blue / Pearl White"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-10 text-sm font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Shade * <span className="text-rose-500 font-bold">(Compulsory)</span>
                    </label>
                    <Input
                      placeholder="e.g. 8214 / L102"
                      value={shade}
                      onChange={(e) => setShade(e.target.value)}
                      className="h-10 text-sm font-semibold font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Quantity Wasted */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Quantity Wasted *
                  </label>
                  <Input
                    placeholder="e.g. 5 Ltrs / 2 Buckets / 10 kg"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-10 text-sm font-semibold"
                    required
                  />
                </div>

                {/* Reason / Remarks */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Reason / Remarks (Optional)
                  </label>
                  <Input
                    placeholder="e.g. Spilled during ceiling coat, expired stock, wrong shade mixed"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="h-10 text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Form Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-9 text-xs font-semibold"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="font-bold h-9 px-5 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Wastage Log</span>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 shadow-xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Total Logs
              </span>
              <span className="text-2xl font-black tracking-tight text-foreground">
                {wastageLogs.length}
              </span>
            </div>
            <div className="h-11 w-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
              <PackageMinus className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 shadow-xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Sites Impacted
              </span>
              <span className="text-2xl font-black tracking-tight text-foreground">
                {uniqueSites}
              </span>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Building className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 shadow-xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Filtered Results
              </span>
              <span className="text-2xl font-black tracking-tight text-foreground">
                {filteredLogs.length}
              </span>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table Card */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden p-4 space-y-4">
        {/* Controls row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search site, material, color, shade, remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Project Sites</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {(searchQuery || filterProjectId !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterProjectId("ALL");
                }}
                className="h-9 text-xs font-semibold text-slate-500 hover:text-slate-700 gap-1 px-2.5"
              >
                <FilterX className="h-3.5 w-3.5" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Wastage Logs Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-zinc-900">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Site / Project</TableHead>
                <TableHead>Material / Product</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Shade</TableHead>
                <TableHead>Quantity Wasted</TableHead>
                <TableHead>Reason / Remarks</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLogs ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <span className="text-xs text-muted-foreground mt-2 block">Loading wastage logs...</span>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-xs italic">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center">
                        <PackageMinus className="h-5 w-5 text-slate-400" />
                      </div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No wastage records found</p>
                      <p className="text-[11px] text-slate-400">
                        {searchQuery || filterProjectId !== "ALL"
                          ? "Try clearing filters to see more results."
                          : 'Click "+ Record Wastage" to log wasted material for a site.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/20 transition-colors">
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.date)}
                    </TableCell>
                    <TableCell className="font-bold text-xs">
                      {log.projectName || log.project?.name || "—"}
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-indigo-650 dark:text-indigo-400">
                      {log.material}
                    </TableCell>
                    <TableCell className="font-medium text-xs text-slate-800 dark:text-slate-200">
                      {log.color || "—"}
                    </TableCell>
                    <TableCell>
                      {log.shade && log.shade !== "—" ? (
                        <Badge
                          variant="outline"
                          className="font-mono font-bold text-xs bg-slate-100/70 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-slate-100 px-2 py-0.5"
                        >
                          {log.shade}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground italic text-xs font-normal">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-bold text-xs px-2.5 py-0.5"
                      >
                        {log.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-zinc-400 max-w-[220px] truncate">
                      {log.remarks || <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete this wastage record?")) {
                            deleteMutation.mutate(log.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        title="Delete log"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

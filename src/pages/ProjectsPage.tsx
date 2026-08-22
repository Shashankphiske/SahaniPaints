import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useMasterData } from "../hooks/use-master-data";
import { getResourceChannel } from "../lib/realtime";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import type { Project, Customer, Product, LabourAttendance, LabourPayment, Contractor, ContractorWorkLog, ProjectAreaColor, Area, Color, LowMaterial } from "../types/master";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "../hooks/use-toast";
import { SearchableSelect } from "../components/ui/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { MasterForm } from "../components/masters/MasterForm";
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
  ChevronDown,
  LayoutGrid,
  List,
  SlidersHorizontal,
  ClipboardList,
  User,
  UserCheck,
  Ruler,
  Package,
  Paintbrush,
  MapPin,
  CheckCircle2,
  Edit
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
  area: number | "";
  unit: "sq.ft" | "rn.ft";
  rate: number | "";
  litresUsed?: number | null;
  _search?: string;
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get("projectId") || searchParams.get("id");
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Search & Filter listing state
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const projectParams = useMemo(() => {
    const params: Record<string, any> = {};
    if (startDateFilter) params.startDate = startDateFilter;
    if (endDateFilter) params.endDate = endDateFilter;
    return params;
  }, [startDateFilter, endDateFilter]);

  // Load projects, customers, products, and users (for supervisors)
  const projectsData = useMasterData<Project>("projects", true, projectParams, true);
  const customersData = useMasterData<Customer>("customers", true);
  const productsData = useMasterData<Product>("products", true);
  const usersData = useMasterData<any>("users", true);
  const contractorsData = useMasterData<Contractor>("contractors", true);

  const projects = useMemo(() => {
    return Array.isArray(projectsData.data) ? projectsData.data : [];
  }, [projectsData.data]);

  const customers = useMemo(() => {
    return Array.isArray(customersData.data) ? customersData.data : [];
  }, [customersData.data]);

  const products = useMemo(() => {
    return Array.isArray(productsData.data) ? productsData.data : [];
  }, [productsData.data]);

  const supervisors = useMemo(() => {
    return Array.isArray(usersData.data) ? usersData.data.filter((u: any) => u.role === "SUPERVISOR") : [];
  }, [usersData.data]);

  const contractors = useMemo(() => {
    return Array.isArray(contractorsData.data) ? contractorsData.data : [];
  }, [contractorsData.data]);

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

  useEffect(() => {
    if (projectIdParam && projects.length > 0) {
      const match = projects.find((p) => p.id === projectIdParam);
      if (match) {
        setViewingProject(match);
      }
    }
  }, [projectIdParam, projects]);

  // Real-time synchronization of project payments and ledger records
  useEffect(() => {
    // 1. Project Payments Real-time listener
    const paymentsChannel = getResourceChannel("project-payments");
    paymentsChannel.on("broadcast", { event: "sync" }, ({ payload }: any) => {
      if (payload?.resource === "project-payments" && payload.data) {
        const payment = payload.data;
        const pId = payment.projectId;
        const isIncoming = payment.type !== "OUTGOING";
        const amt = Number(payment.amount || 0);

        // Update list/card query cache of projects
        queryClient.setQueriesData<any>({ queryKey: ["projects_infinite"] }, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              records: (page.records || []).map((p: any) => {
                if (p.id !== pId) return p;
                const prevPaid = Number(p.paid || 0);
                let newPaid = prevPaid;
                if (payload.action === "CREATE") {
                  newPaid = prevPaid + (isIncoming ? amt : -amt);
                } else if (payload.action === "DELETE") {
                  newPaid = Math.max(0, prevPaid - (isIncoming ? amt : -amt));
                }
                return { ...p, paid: newPaid };
              })
            }))
          };
        });

        // Update detailed view state if it's the current viewing project
        setFullProject((prev: any) => {
          if (!prev || prev.id !== pId) return prev;
          const currentPayments = prev.projectPayments || [];
          
          if (payload.action === "CREATE") {
            if (currentPayments.some((p: any) => p.id === payment.id)) return prev;
            return {
              ...prev,
              paid: Number(prev.paid || 0) + (isIncoming ? amt : -amt),
              projectPayments: [payment, ...currentPayments]
            };
          } else if (payload.action === "DELETE") {
            return {
              ...prev,
              paid: Math.max(0, Number(prev.paid || 0) - (isIncoming ? amt : -amt)),
              projectPayments: currentPayments.filter((p: any) => p.id !== payment.id)
            };
          }
          return prev;
        });
      }
    });

    // 2. Contractor Work Logs listener
    const contractorLogsChannel = getResourceChannel("contractor-work-logs");
    contractorLogsChannel.on("broadcast", { event: "sync" }, ({ payload }: any) => {
      if (payload?.resource === "contractor-work-logs" && payload.data) {
        const log = payload.data;
        const pId = log.projectId;

        setFullProject((prev: any) => {
          if (!prev || prev.id !== pId) return prev;
          const currentLogs = prev.contractorWorkLogs || [];

          if (payload.action === "CREATE") {
            if (currentLogs.some((l: any) => l.id === log.id)) return prev;
            const contractorInfo = contractors.find((c) => c.id === log.contractorId);
            const populatedLog = {
              ...log,
              contractor: contractorInfo ? { name: contractorInfo.name } : null
            };
            return {
              ...prev,
              contractorWorkLogs: [populatedLog, ...currentLogs]
            };
          } else if (payload.action === "DELETE") {
            return {
              ...prev,
              contractorWorkLogs: currentLogs.filter((l: any) => l.id !== log.id)
            };
          }
          return prev;
        });
      }
    });

    // 3. Labour Attendance listener
    const attendanceChannel = getResourceChannel("labour-attendance");
    attendanceChannel.on("broadcast", { event: "sync" }, ({ payload }: any) => {
      if (payload?.resource === "labour-attendance" && payload.data) {
        const att = payload.data;
        const pId = att.projectId;

        setFullProject((prev: any) => {
          if (!prev || prev.id !== pId) return prev;
          const currentAttendance = prev.attendance || [];

          if (payload.action === "CREATE") {
            if (currentAttendance.some((a: any) => a.id === att.id)) return prev;
            return {
              ...prev,
              attendance: [att, ...currentAttendance]
            };
          } else if (payload.action === "DELETE") {
            return {
              ...prev,
              attendance: currentAttendance.filter((a: any) => a.id !== att.id)
            };
          }
          return prev;
        });
      }
    });

    // 4. Material Logs listener
    const materialLogsChannel = getResourceChannel("project-material-logs");
    materialLogsChannel.on("broadcast", { event: "sync" }, ({ payload }: any) => {
      if (payload?.resource === "project-material-logs" && payload.data) {
        const mat = payload.data;
        const pId = mat.projectId;

        setFullProject((prev: any) => {
          if (!prev || prev.id !== pId) return prev;
          const currentMaterials = prev.materialLogs || [];

          if (payload.action === "CREATE") {
            if (currentMaterials.some((m: any) => m.id === mat.id)) return prev;
            return {
              ...prev,
              materialLogs: mat.productId ? [mat, ...currentMaterials] : currentMaterials
            };
          } else if (payload.action === "DELETE") {
            return {
              ...prev,
              materialLogs: currentMaterials.filter((m: any) => m.id !== mat.id)
            };
          }
          return prev;
        });
      }
    });

    // 5. Projects list/details general channel listener
    const projectsChannel = getResourceChannel("projects");
    projectsChannel.on("broadcast", { event: "sync" }, ({ payload }: any) => {
      if (payload?.resource === "projects" && payload.data) {
        const proj = payload.data;
        if (payload.action === "UPDATE") {
          setFullProject((prev: any) => {
            if (!prev || prev.id !== proj.id) return prev;
            return {
              ...prev,
              ...proj
            };
          });
        } else if (payload.action === "DELETE") {
          setFullProject((prev: any) => {
            if (prev && prev.id === proj.id) {
              setViewingProject(null);
              setSearchParams({});
              return null;
            }
            return prev;
          });
        }
      }
    });

    // Subscribe to all channels
    paymentsChannel.subscribe();
    contractorLogsChannel.subscribe();
    attendanceChannel.subscribe();
    materialLogsChannel.subscribe();
    projectsChannel.subscribe();

    return () => {
      // Clean up subscriptions
    };
  }, [queryClient, contractors]);

  // List filtering logic

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
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      {!isCreating && !viewingProject && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display flex items-center gap-2">
              <FolderOpen className="h-7 w-7 text-primary" />
              Paints Projects
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="font-medium flex items-center gap-1.5 shadow-sm"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {(searchQuery || statusFilter || startDateFilter || endDateFilter) ? (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full font-medium">
                  !
                </span>
              ) : null}
            </Button>

            <Button onClick={() => setIsCreating(true)} className="font-medium flex items-center gap-1.5 shadow-sm">
              <Plus className="h-4.5 w-4.5" />
              Add Project
            </Button>
          </div>
        </div>
      )}

      {/* List View */}
      {!isCreating && !viewingProject && (
        <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-md">
          {showFilters && (
            <CardHeader className="p-5 pb-3 border-b border-border/60">
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
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">From:</span>
                    <Input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="h-10 w-full sm:w-36 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">To:</span>
                    <Input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="h-10 w-full sm:w-36 text-xs"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-10 w-full md:w-44 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          )}

          <div className="px-5 pt-3 flex justify-end">
            <div className="flex items-center border border-border/80 rounded-lg p-0.5 bg-muted/40">
              <Button
                type="button"
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs font-bold"
                onClick={() => setViewMode("cards")}
                title="Grid Cards View"
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Cards
              </Button>
              <Button
                type="button"
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs font-bold"
                onClick={() => setViewMode("table")}
                title="Table List View"
              >
                <List className="h-3.5 w-3.5 mr-1" /> Table
              </Button>
            </div>
          </div>
            <CardContent className="p-4 pt-2">
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
              ) : viewMode === "cards" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProjects.map((project) => {
                    const total = Number(project.totalAmount || project.agreedPrice || 0);
                    const paid = Number(project.paid || 0);
                    const due = Math.max(0, total - paid);

                    return (
                      <Card
                        key={project.id}
                        onClick={() => setViewingProject(project)}
                        className="group relative overflow-hidden cursor-pointer border border-border/80 bg-card hover:bg-slate-50/60 dark:hover:bg-zinc-900/60 hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between rounded-xl"
                      >
                        <CardContent className="p-4 space-y-3 flex flex-col justify-between h-full">
                          {/* Title & Status */}
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1 flex-1" title={project.name}>
                                {project.name}
                              </h4>
                              <Badge
                                variant="outline"
                                className={`${STATUS_STYLES[project.status] || "bg-muted text-muted-foreground"} text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border shrink-0`}
                              >
                                {project.status}
                              </Badge>
                            </div>

                            {/* Customer & Date */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 pt-0.5">
                              <span className="truncate text-[11px] font-medium flex items-center" title={project.customer?.name}>
                                <User className="h-3 w-3 mr-1 text-slate-400" />
                                {project.customer?.name || "No Customer"}
                              </span>
                              <span className="text-[11px] font-mono shrink-0 flex items-center">
                                <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                                {formatDate(project.projectDate)}
                              </span>
                            </div>

                            {/* Supervisor Status */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 pt-1 border-t border-slate-100 dark:border-zinc-900/40">
                              <span className="truncate text-[11px] font-medium flex items-center">
                                <UserCheck className="h-3 w-3 mr-1 text-slate-400" />
                                Supervisor: &nbsp;
                                {project.supervisor?.username ? (
                                  <span className="text-primary font-bold">{project.supervisor.username}</span>
                                ) : (
                                  <span className="text-red-500 font-semibold bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded border border-red-150">No Supervisor</span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* 3-Column Financial Pill with Simple Light Colors */}
                          <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                            <div className="flex flex-col p-1.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40">
                              <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-tight">Total</span>
                              <span className="text-xs font-bold text-blue-900 dark:text-blue-200 truncate mt-0.5">
                                ₹{fmt(total)}
                              </span>
                            </div>
                            <div className="flex flex-col p-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40">
                              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-tight">Paid</span>
                              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate mt-0.5">
                                ₹{fmt(paid)}
                              </span>
                            </div>
                            <div className={`flex flex-col p-1.5 rounded-lg border ${
                              due > 0
                                ? "bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/40"
                                : "bg-slate-50 dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/40"
                            }`}>
                              <span className={`text-[9px] font-bold uppercase tracking-tight ${due > 0 ? "text-rose-700 dark:text-rose-300" : "text-slate-500"}`}>Due</span>
                              <span className={`text-xs font-bold truncate mt-0.5 ${due > 0 ? "text-rose-900 dark:text-rose-200" : "text-slate-700 dark:text-slate-300"}`}>
                                ₹{fmt(due)}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-1 border-t border-border/40">
                            <span className="text-[11px] font-bold text-primary group-hover:underline">
                              View Project →
                            </span>

                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                onClick={() => downloadQuotationPDFHelper(project, products)}
                                title="Download Quotation PDF"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteProject(project.id)}
                                title="Delete Project"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project Name</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Deadline Date</TableHead>
                        <TableHead>Supervisor</TableHead>
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
                            {project.supervisor?.username ? (
                              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{project.supervisor.username}</span>
                            ) : (
                              <span className="text-xs font-semibold px-2 py-0.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full border border-red-100">No Supervisor</span>
                            )}
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
            supervisors={supervisors}
            onCancel={() => setIsCreating(false)}
            onCreateCustomer={customersData.createAsync}
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
            onSearchCustomers={(query) => customersData.forceServerSearch(query)}
            onSearchProducts={(query) => productsData.forceServerSearch(query)}
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
            supervisors={supervisors}
            setFullProject={setFullProject}
            updateAllCaches={projectsData.updateAllCaches}
            onCreateCustomer={customersData.createAsync}
            onBack={() => {
              setViewingProject(null);
              setSearchParams({}); // Clear query parameters
              projectsData.forceServerSearch(""); // Refresh cache list
            }}
            onRefresh={() => {
              fetchFullProjectDetails(viewingProject.id);
              queryClient.invalidateQueries({ queryKey: ["projects_infinite"] });
            }}
            onSearchCustomers={(query) => customersData.forceServerSearch(query)}
            onSearchProducts={(query) => productsData.forceServerSearch(query)}
          />
        )}
      </div>
    );
  }

/* ──────────────────────────────────────────────────────── */
/* ── CREATE PROJECT FORM COMPONENT ─────────────────────── */
/* ──────────────────────────────────────────────────────── */
interface CreateProjectFormProps {
  customers: Customer[];
  products: Product[];
  supervisors: any[];
  onCancel: () => void;
  onCreateCustomer: (data: Partial<Customer>) => Promise<any>;
  onSave: (payload: any) => Promise<void>;
  onSearchCustomers?: (query: string) => void;
  onSearchProducts?: (query: string) => void;
}

function CreateProjectForm({ customers, products, supervisors, onCancel, onCreateCustomer, onSave, onSearchCustomers, onSearchProducts }: CreateProjectFormProps) {
  // Form fields
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerDisplay, setCustomerDisplay] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [supervisorDisplay, setSupervisorDisplay] = useState("");
  const [projectDate, setProjectDate] = useState("");
  const [status, setStatus] = useState<any>("PENDING");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Selected products rows
  const [rows, setRows] = useState<PaintProductRow[]>([
    { productId: "", area: "", unit: "sq.ft", rate: "", _search: "" },
  ]);

  // Tax and Discount
  const [taxRate, setTaxRate] = useState<number | "">("");
  const [discount, setDiscount] = useState<number | "">("");
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [showAdvancedPricing, setShowAdvancedPricing] = useState(false);

  const [agreedPrice, setAgreedPrice] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => {
    return rows.reduce((sum, row) => sum + (Number(row.rate || 0) * Number(row.area || 0) || 0), 0);
  }, [rows]);

  const taxAmount = useMemo(() => (subtotal * Number(taxRate || 0)) / 100, [subtotal, taxRate]);

  const discountAmount = useMemo(() => {
    if (discountType === "percent") return (subtotal * Number(discount || 0)) / 100;
    return Number(discount || 0);
  }, [subtotal, discount, discountType]);

  const computedAgreedPrice = useMemo(() => {
    return Math.max(0, subtotal + taxAmount - discountAmount);
  }, [subtotal, taxAmount, discountAmount]);

  const finalPrice = agreedPrice !== "" ? Number(agreedPrice) : computedAgreedPrice;

  const handleAddRow = () => {
    setRows((prev) => [...prev, { productId: "", area: "", unit: "sq.ft", rate: "", _search: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      setRows([{ productId: "", area: "", unit: "sq.ft", rate: "", _search: "" }]);
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
          row.rate = coverage && coverage > 0 ? parseFloat((Number(prod.price) / coverage).toFixed(2)) : 0;
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

    const filteredRows = rows.filter((r) => r.productId && Number(r.area) > 0);

    setSaving(true);
    try {
      const cust = customers.find((c) => c.id === customerId);
      const payload = {
        name,
        customerId,
        supervisorId: supervisorId || null,
        _customerName: cust?.name,
        _supervisorName: supervisors.find((s) => s.id === supervisorId)?.username || null,
        projectDate: projectDate ? new Date(projectDate).toISOString() : null,
        status,
        totalAmount: subtotal,
        tax: Number(taxRate || 0),
        discount: Number(discount || 0),
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
    const filteredRows = rows.filter((r) => r.productId && Number(r.area) > 0);
    if (filteredRows.length === 0) {
      alert("Please add product selections to generate quotation.");
      return;
    }

    const productsForPDF = filteredRows.map((r) => {
      const prod = products.find((p) => p.id === r.productId);
      return {
        productName: prod?.name || "Paint Product",
        brandName: prod?.brand?.name,
        area: Number(r.area || 0),
        unit: r.unit,
        rate: Number(r.rate || 0),
        total: Number(r.rate || 0) * Number(r.area || 0),
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
        tax: Number(taxRate || 0),
        taxAmount,
        discount: Number(discount || 0),
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
                    Project / Site Name <span className="text-red-500 font-bold ml-0.5">*</span>
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground block">Customer <span className="text-red-500 font-bold ml-0.5">*</span></label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800"
                      onClick={() => setIsCustomerModalOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <SearchableSelect
                    value={customerId}
                    displayValue={customerDisplay}
                    options={customers
                      .filter((c) => !customerDisplay || c.name.toLowerCase().includes(customerDisplay.toLowerCase()))
                      .slice(0, 10)
                      .map((c) => ({ id: c.id, label: c.name }))}
                    placeholder="Select customer"
                    onSearchChange={setCustomerDisplay}
                    onSelect={(id, label) => { setCustomerId(id); setCustomerDisplay(label); }}
                    onClear={() => { setCustomerId(""); setCustomerDisplay(""); }}
                    onEnter={(val) => onSearchCustomers?.(val)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground block">Supervisor</label>
                  <SearchableSelect
                    value={supervisorId}
                    displayValue={supervisorDisplay}
                    options={supervisors
                      .filter((s) => !supervisorDisplay || s.username.toLowerCase().includes(supervisorDisplay.toLowerCase()))
                      .slice(0, 10)
                      .map((s) => ({ id: s.id, label: s.username }))}
                    placeholder="Select supervisor"
                    onSearchChange={setSupervisorDisplay}
                    onSelect={(id, label) => { setSupervisorId(id); setSupervisorDisplay(label); }}
                    onClear={() => { setSupervisorId(""); setSupervisorDisplay(""); }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground block">Deadline Date</label>
                  <Input
                    type="date"
                    value={projectDate}
                    onChange={(e) => setProjectDate(e.target.value)}
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
                       <SearchableSelect
                        value={row.productId}
                        displayValue={row._search !== undefined ? row._search : (products.find((p) => p.id === row.productId)?.name || "")}
                        options={products
                          .filter((p) => {
                            const display = row._search !== undefined ? row._search : "";
                            return !display || p.name.toLowerCase().includes(display.toLowerCase());
                          })
                          .slice(0, 10)
                          .map((p) => ({ id: p.id, label: p.name }))}
                        placeholder="Choose product"
                        onSearchChange={(query) => handleRowChange(idx, "_search", query)}
                        onSelect={(id, label) => {
                          handleRowChange(idx, "productId", id);
                          handleRowChange(idx, "_search", label);
                        }}
                        onClear={() => {
                          handleRowChange(idx, "productId", "");
                          handleRowChange(idx, "_search", "");
                        }}
                        onEnter={(val) => onSearchProducts?.(val)}
                        className="flex-1"
                      />
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
                        ₹{fmt(Number(row.rate || 0) * Number(row.area || 0))}
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
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground block">Discount</label>
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        min="0"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))}
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
                {Number(taxRate || 0) > 0 && (
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

      {/* Create customer modal */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <MasterForm
            resource="customers"
            onSubmit={async (formData) => {
              try {
                const newCustomer = await onCreateCustomer(formData);
                if (newCustomer && newCustomer.id) {
                  setCustomerId(newCustomer.id);
                  setCustomerDisplay(newCustomer.name);
                  toast({
                    title: "Customer Added",
                    description: `${newCustomer.name} has been added successfully.`,
                  });
                }
              } catch (err: any) {
                toast({
                  title: "Failed to Add Customer",
                  description: err.message || "Something went wrong.",
                  variant: "destructive",
                });
              } finally {
                setIsCustomerModalOpen(false);
              }
            }}
            onCancel={() => setIsCustomerModalOpen(false)}
            editing={false}
          />
        </DialogContent>
      </Dialog>
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
  supervisors: any[];
  setFullProject: React.Dispatch<React.SetStateAction<any | null>>;
  updateAllCaches: (updatedItem: any) => void;
  onCreateCustomer: (data: Partial<Customer>) => Promise<any>;
  onBack: () => void;
  onRefresh: () => void;
  onSearchCustomers?: (query: string) => void;
  onSearchProducts?: (query: string) => void;
}

function ProjectDetailView({
  project,
  fullProject,
  loadingDetails,
  products,
  customers,
  supervisors,
  setFullProject,
  updateAllCaches,
  onCreateCustomer,
  onBack,
  onRefresh,
  onSearchCustomers,
  onSearchProducts,
}: ProjectDetailViewProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(() => {
    if (urlTab && ["overview", "areastatus", "products", "quotation", "payments", "profitloss"].includes(urlTab)) {
      return urlTab;
    }
    return "overview";
  });

  useEffect(() => {
    if (urlTab && ["overview", "areastatus", "products", "quotation", "payments", "profitloss"].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams((prev) => {
      prev.set("tab", val);
      return prev;
    }, { replace: true });
  };

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
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl max-w-full">
          <TabsTrigger value="overview" className="rounded-lg text-xs font-bold py-1.5 px-3">
            Overview / Edit
          </TabsTrigger>
          <TabsTrigger value="areastatus" className="rounded-lg text-xs font-bold py-1.5 px-3">
            Area Status
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-lg text-xs font-bold py-1.5 px-3">
            Selected Products
          </TabsTrigger>
          <TabsTrigger value="quotation" className="rounded-lg text-xs font-bold py-1.5 px-3">
            Quotation
          </TabsTrigger>
          {user?.role === "ADMIN" && (
            <TabsTrigger value="payments" className="rounded-lg text-xs font-bold py-1.5 px-3">
              Customer Payments
            </TabsTrigger>
          )}
          <TabsTrigger value="profitloss" className="rounded-lg text-xs font-bold py-1.5 px-3">
            Profit / Loss
          </TabsTrigger>
          <TabsTrigger value="materialrequests" className="rounded-lg text-xs font-bold py-1.5 px-3">
            Material Requests
          </TabsTrigger>
        </TabsList>

         {/* TAB 1: CONSOLIDATED OVERVIEW & SPEC DETAILS */}
        <TabsContent value="overview">
          <OverviewEditTab
            fullProject={fullProject}
            setFullProject={setFullProject}
            updateAllCaches={updateAllCaches}
            customers={customers}
            supervisors={supervisors}
            onCreateCustomer={onCreateCustomer}
            onSearchCustomers={onSearchCustomers}
          />
        </TabsContent>

        {/* TAB 1.5: ROOM AREA STATUS PROGRESS STEPPER */}
        <TabsContent value="areastatus">
          <AreaStatusTab projectId={fullProject.id} />
        </TabsContent>

        {/* TAB 2: PRODUCT CONTRACT SELECTIONS */}
        <TabsContent value="products">
          <SelectedProductsTab
            fullProject={fullProject}
            setFullProject={setFullProject}
            updateAllCaches={updateAllCaches}
            products={products}
            onSearchProducts={onSearchProducts}
          />
        </TabsContent>

        {/* TAB 3: TAX, DISCOUNT & QUOTATION SUMMARY */}
        <TabsContent value="quotation">
          <QuotationTab
            fullProject={fullProject}
            setFullProject={setFullProject}
            updateAllCaches={updateAllCaches}
          />
        </TabsContent>

        {/* TAB 4: PROFIT & LOSS CALCULATOR */}
        <TabsContent value="profitloss">
          <ProfitLossTab fullProject={fullProject} />
        </TabsContent>

        {/* TAB 4.5: MATERIAL REQUESTS LOG */}
        <TabsContent value="materialrequests">
          <MaterialRequestsTab projectId={fullProject.id} />
        </TabsContent>

        {user?.role === "ADMIN" && (
          <TabsContent value="payments">
            <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
              <CustomerPaymentsTab
                fullProject={fullProject}
                setFullProject={setFullProject}
                updateAllCaches={updateAllCaches}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: OVERVIEW & PRODUCT EDITOR ─────────────── */
/* ──────────────────────────────────────────────────────── */
interface OverviewEditTabProps {
  fullProject: any;
  setFullProject: React.Dispatch<React.SetStateAction<any | null>>;
  updateAllCaches: (updatedItem: any) => void;
  customers: Customer[];
  supervisors: any[];
  onCreateCustomer: (data: Partial<Customer>) => Promise<any>;
  onSearchCustomers?: (query: string) => void;
}

function OverviewEditTab({ fullProject, setFullProject, updateAllCaches, customers, supervisors, onCreateCustomer, onSearchCustomers }: OverviewEditTabProps) {
  const { user } = useAuth();
  const [name, setName] = useState(fullProject.name);
  const [customerId, setCustomerId] = useState(fullProject.customerId || "");
  const [customerDisplay, setCustomerDisplay] = useState(
    () => customers.find((c) => c.id === fullProject.customerId)?.name || ""
  );
  const [supervisorId, setSupervisorId] = useState(fullProject.supervisorId || "");
  const [supervisorDisplay, setSupervisorDisplay] = useState(
    () => supervisors.find((s) => s.id === fullProject.supervisorId)?.username || ""
  );
  const [projectDate, setProjectDate] = useState(() => {
    return fullProject.projectDate ? new Date(fullProject.projectDate).toISOString().split("T")[0] : "";
  });
  const [status, setStatus] = useState<any>(fullProject.status);
  const [saving, setSaving] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const todaysProgress = useMemo(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const todayStr = new Date(now.getTime() - tzOffset).toISOString().split("T")[0];
    
    const attendanceToday = (fullProject.attendance || []).filter((att: any) => {
      if (!att.date) return false;
      const attDateStr = new Date(att.date).toISOString().split("T")[0];
      return attDateStr === todayStr;
    });
    
    const workToday = (fullProject.contractorWorkLogs || []).filter((log: any) => {
      if (!log.date) return false;
      const logDateStr = new Date(log.date).toISOString().split("T")[0];
      return logDateStr === todayStr;
    }).reduce((sum: number, log: any) => sum + Number(log.sqFt || 0), 0);

    const materialsToday = (fullProject.materialLogs || []).filter((log: any) => {
      if (!log.date) return false;
      const logDateStr = new Date(log.date).toISOString().split("T")[0];
      return logDateStr === todayStr;
    });

    return {
      attendanceCount: attendanceToday.length,
      workSqFt: workToday,
      materialsCount: materialsToday.length
    };
  }, [fullProject]);

  useEffect(() => {
    setName(fullProject.name);
    setCustomerId(fullProject.customerId || "");
    setCustomerDisplay(customers.find((c) => c.id === fullProject.customerId)?.name || "");
    setSupervisorId(fullProject.supervisorId || "");
    setSupervisorDisplay(supervisors.find((s) => s.id === fullProject.supervisorId)?.username || "");
    setProjectDate(fullProject.projectDate ? new Date(fullProject.projectDate).toISOString().split("T")[0] : "");
    setStatus(fullProject.status);
  }, [fullProject, customers, supervisors]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const cust = customers.find((c) => c.id === customerId);
      const payload = {
        name,
        customerId,
        supervisorId: supervisorId || null,
        _customerName: cust?.name,
        _supervisorName: supervisors.find((s) => s.id === supervisorId)?.username || null,
        projectDate: projectDate ? new Date(projectDate).toISOString() : null,
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
      setFullProject((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          name,
          customerId,
          supervisorId: supervisorId || null,
          customer: cust ? { id: cust.id, name: cust.name, phonenumber: cust.phonenumber || null, email: cust.email || null, address: cust.address || null } : null,
          supervisor: supervisorId ? { id: supervisorId, username: supervisors.find((s) => s.id === supervisorId)?.username } : null,
          projectDate: projectDate ? new Date(projectDate) : null,
          status,
        };
      });
      // Optimistically update list cache for status changes
      updateAllCaches({ id: fullProject.id, name, status, customerId, supervisorId } as any);
      toast({
        title: "Project Details Saved",
        description: "General project information has been updated.",
      });
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
      {/* Today's Site Activity / Progress */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-900 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Today's Site Activity & Progress
              </h3>
              <p className="text-[11px] text-muted-foreground">Real-time summary of operations logged today</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-350 bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-800 uppercase tracking-wider font-mono">
            {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Labor Force today */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary dark:text-slate-400 uppercase tracking-wider">Labour Attendance</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {todaysProgress.attendanceCount > 0 ? (
                  `${todaysProgress.attendanceCount} Present`
                ) : (
                  <span className="text-muted-foreground font-medium text-sm">Not Marked</span>
                )}
              </p>
            </div>
          </div>

          {/* Contractor sq.ft logged today */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Ruler className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary dark:text-slate-400 uppercase tracking-wider">Contractor Work</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {todaysProgress.workSqFt > 0 ? (
                  `${todaysProgress.workSqFt} sq.ft completed`
                ) : (
                  <span className="text-muted-foreground font-medium text-sm">No work logged</span>
                )}
              </p>
            </div>
          </div>

          {/* Material Logged today */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary dark:text-slate-400 uppercase tracking-wider">Materials Used</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {todaysProgress.materialsCount > 0 ? (
                  `${todaysProgress.materialsCount} Items dispatched`
                ) : (
                  <span className="text-muted-foreground font-medium text-sm">None recorded</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Payments Overview Section */}
      {user?.role === "ADMIN" && (
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
          <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-zinc-900 pb-2 mb-3">
            <div className="flex items-center gap-2 text-primary">
              <DollarSign className="h-5 w-5" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Payments Overview
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                label: "Total Project Value",
                value: fmt(Number(fullProject.agreedPrice || fullProject.totalAmount || 0)),
                accent: "bg-blue-500",
              },
              {
                label: "Payment Received",
                value: fmt(Number(fullProject.paid || 0)),
                accent: "bg-emerald-500",
              },
              {
                label: "Due",
                value: fmt(Math.max(0, Number(fullProject.agreedPrice || fullProject.totalAmount) - Number(fullProject.paid || 0))),
                accent: "bg-rose-500",
              },
            ].map(({ label, value, accent }) => (
              <div key={label} className="flex items-center border border-border rounded-lg p-3 bg-muted/10">
                <div className={`w-1 h-8 rounded-full mr-3 ${accent}`} />
                <p className="text-xs font-semibold text-muted-foreground flex-1">{label}</p>
                <p className="text-sm font-bold text-foreground">₹{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Labour Payment Section */}
      {user?.role === "ADMIN" && (
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
          <LabourPaymentsTab fullProject={fullProject} />
        </div>
      )}

      {/* 3. Tasks Section */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tasks</h3>
        </div>
        <TasksPage projectId={fullProject.id} />
      </div>

      {/* Contractor Work Ledger Section */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
        <ContractorWorkLedgerTab
          projectId={fullProject.id}
          contractorWorkLogs={fullProject.contractorWorkLogs || []}
          setFullProject={setFullProject}
        />
      </div>

      {/* 4. Labour Attendance Section */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
        <LabourCrewTab attendance={fullProject.attendance || []} />
      </div>

      {/* 5. Material Used Section */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
        <MaterialUsedTab
          projectId={fullProject.id}
          projectProducts={fullProject.projectProducts || []}
          materialLogs={fullProject.materialLogs || []}
        />
      </div>

      {/* 6. Measurements Section */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
        <MeasurementsTab projectProducts={fullProject.projectProducts || []} />
      </div>

      {/* 7. General Details (others remaining) */}
      <form onSubmit={handleUpdate} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
          <div className="space-y-1 md:col-span-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Project / Site Name *
            </span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Customer *
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800"
                onClick={() => setIsCustomerModalOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <SearchableSelect
              value={customerId}
              displayValue={customerDisplay}
              options={customers
                .filter((c) => !customerDisplay || c.name.toLowerCase().includes(customerDisplay.toLowerCase()))
                .slice(0, 10)
                .map((c) => ({ id: c.id, label: c.name }))}
              placeholder="Select customer"
              onSearchChange={setCustomerDisplay}
              onSelect={(id, label) => { setCustomerId(id); setCustomerDisplay(label); }}
              onClear={() => { setCustomerId(""); setCustomerDisplay(""); }}
              onEnter={(val) => onSearchCustomers?.(val)}
              required
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Supervisor
            </span>
            <SearchableSelect
              value={supervisorId}
              displayValue={supervisorDisplay}
              options={supervisors
                .filter((s) => !supervisorDisplay || s.username.toLowerCase().includes(supervisorDisplay.toLowerCase()))
                .slice(0, 10)
                .map((s) => ({ id: s.id, label: s.username }))}
              placeholder="Select supervisor"
              onSearchChange={setSupervisorDisplay}
              onSelect={(id, label) => { setSupervisorId(id); setSupervisorDisplay(label); }}
              onClear={() => { setSupervisorId(""); setSupervisorDisplay(""); }}
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Deadline Date
            </span>
            <Input type="date" value={projectDate} onChange={(e) => setProjectDate(e.target.value)} />
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

      {/* Create customer modal */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <MasterForm
            resource="customers"
            onSubmit={async (formData) => {
              try {
                const newCustomer = await onCreateCustomer(formData);
                if (newCustomer && newCustomer.id) {
                  setCustomerId(newCustomer.id);
                  setCustomerDisplay(newCustomer.name);
                  toast({
                    title: "Customer Added",
                    description: `${newCustomer.name} has been added successfully.`,
                  });
                }
              } catch (err: any) {
                toast({
                  title: "Failed to Add Customer",
                  description: err.message || "Something went wrong.",
                  variant: "destructive",
                });
              } finally {
                setIsCustomerModalOpen(false);
              }
            }}
            onCancel={() => setIsCustomerModalOpen(false)}
            editing={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: SELECTED PRODUCTS ────────────────────── */
/* ──────────────────────────────────────────────────────── */
interface SelectedProductsTabProps {
  fullProject: any;
  setFullProject: React.Dispatch<React.SetStateAction<any | null>>;
  updateAllCaches: (updatedItem: any) => void;
  products: Product[];
  onSearchProducts?: (query: string) => void;
}

function SelectedProductsTab({ fullProject, setFullProject, updateAllCaches, products, onSearchProducts }: SelectedProductsTabProps) {
  const [rows, setRows] = useState<PaintProductRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const checkIfDirty = (currentRows: PaintProductRow[]) => {
    if (currentRows.some(r => r.productId === "")) return true;

    const original = fullProject.projectProducts || [];
    if (currentRows.length !== original.length) return true;

    for (const r of currentRows) {
      const origRow = original.find((o: any) => o.productId === r.productId);
      if (!origRow) return true;
      if (Number(origRow.area) !== Number(r.area)) return true;
      if (origRow.unit !== r.unit) return true;
      if (Number(origRow.rate) !== Number(r.rate)) return true;
    }
    return false;
  };

  useEffect(() => {
    if (fullProject.projectProducts) {
      setRows(
        fullProject.projectProducts.map((pp: any) => {
          const prodName = products.find((p) => p.id === pp.productId)?.name || "";
          return {
            productId: pp.productId,
            area: Number(pp.area),
            unit: pp.unit as any,
            rate: Number(Number(pp.rate).toFixed(2)),
            litresUsed: pp.litresUsed != null ? Number(pp.litresUsed) : null,
            _search: prodName,
          };
        })
      );
      setIsDirty(false);
    }
  }, [fullProject.projectProducts, products]);

  const handleAddRow = () => {
    const updated = [...rows, { productId: "", area: "", unit: "sq.ft", rate: "", _search: "" }];
    setRows(updated);
    setIsDirty(checkIfDirty(updated));
  };

  const handleRemoveRow = async (index: number) => {
    let updatedRows: PaintProductRow[] = [];
    if (rows.length === 1) {
      updatedRows = [{ productId: "", area: "", unit: "sq.ft", rate: "", _search: "" }];
    } else {
      updatedRows = rows.filter((_, i) => i !== index);
    }
    
    setRows(updatedRows);
    setIsDirty(checkIfDirty(updatedRows));

    const rowToDelete = rows[index];
    if (rowToDelete && rowToDelete.productId) {
      const filteredRows = updatedRows.filter((r) => r.productId && Number(r.area) > 0);
      setSaving(true);
      try {
        const newSubtotal = filteredRows.reduce((sum, r) => sum + (Number(r.rate || 0) * Number(r.area || 0)), 0);
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

        const updatedProjectProducts = filteredRows.map((r, idx2) => {
          const prod = products.find((p) => p.id === r.productId);
          return {
            id: `temp-${idx2}-${Date.now()}`,
            projectId: fullProject.id,
            productId: r.productId,
            area: Number(r.area),
            unit: r.unit,
            rate: Number(r.rate),
            litresUsed: r.litresUsed,
            product: prod ? {
              id: prod.id,
              name: prod.name,
              category: prod.category,
              price: prod.price,
              coverageSqFt: prod.coverageSqFt,
              coverageRnFt: prod.coverageRnFt,
              size: prod.size,
              brand: prod.brand
            } : undefined
          };
        });

        setFullProject((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalAmount: newSubtotal,
            agreedPrice: Number(fullProject.agreedPrice || newSubtotal),
            projectProducts: updatedProjectProducts,
          };
        });

        updateAllCaches({
          id: fullProject.id,
          totalAmount: newSubtotal,
          agreedPrice: Number(fullProject.agreedPrice || newSubtotal),
        });

        toast({
          title: "Product Deleted",
          description: "The product selection was deleted instantly.",
        });
      } catch (err: any) {
        toast({
          title: "Delete Failed",
          description: err.message || "An error occurred.",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
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
            row.rate = Number((Number(prod.price) / coverage).toFixed(2));
          } else {
            row.rate = "";
          }
        } else {
          row.rate = "";
        }
      }

      updated[index] = row;
      setIsDirty(checkIfDirty(updated));
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const filteredRows = rows.filter((r) => r.productId && Number(r.area) > 0);

    setSaving(true);
    try {
      const newSubtotal = filteredRows.reduce((sum, r) => sum + (Number(r.rate || 0) * Number(r.area || 0)), 0);
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

      const updatedProjectProducts = filteredRows.map((r, index) => {
        const prod = products.find((p) => p.id === r.productId);
        return {
          id: `temp-${index}-${Date.now()}`,
          projectId: fullProject.id,
          productId: r.productId,
          area: Number(r.area),
          unit: r.unit,
          rate: Number(r.rate),
          litresUsed: r.litresUsed,
          product: prod ? {
            id: prod.id,
            name: prod.name,
            category: prod.category,
            price: prod.price,
            coverageSqFt: prod.coverageSqFt,
            coverageRnFt: prod.coverageRnFt,
            size: prod.size,
            brand: prod.brand
          } : undefined
        };
      });

      setFullProject((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          totalAmount: newSubtotal,
          agreedPrice: Number(fullProject.agreedPrice || newSubtotal),
          projectProducts: updatedProjectProducts,
        };
      });

      updateAllCaches({
        id: fullProject.id,
        totalAmount: newSubtotal,
        agreedPrice: Number(fullProject.agreedPrice || newSubtotal),
      });

      setIsDirty(false);

      toast({
        title: "Selected Products Saved",
        description: "Contract product selections have been successfully updated.",
      });
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
      <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft overflow-visible">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex flex-row items-center justify-between overflow-visible">
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
        <CardContent className="p-0 overflow-visible">
          <div className="overflow-visible">
            <table className="w-full caption-bottom text-sm overflow-visible">
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
              <TableBody className="overflow-visible">
                {rows.map((row, idx) => (
                  <TableRow key={idx} className="overflow-visible">
                    <TableCell className="p-3 overflow-visible">
                       <SearchableSelect
                        value={row.productId}
                        displayValue={row._search !== undefined ? row._search : (products.find((p) => p.id === row.productId)?.name || "")}
                        options={products
                          .filter((p) => {
                            const display = row._search !== undefined ? row._search : "";
                            return !display || p.name.toLowerCase().includes(display.toLowerCase());
                          })
                          .slice(0, 10)
                          .map((p) => ({ id: p.id, label: p.name }))}
                        placeholder="Choose Product"
                        onSearchChange={(query) => handleRowChange(idx, "_search", query)}
                        onSelect={(id, label) => {
                          handleRowChange(idx, "productId", id);
                          handleRowChange(idx, "_search", label);
                        }}
                        onClear={() => {
                          handleRowChange(idx, "productId", "");
                          handleRowChange(idx, "_search", "");
                        }}
                        onEnter={(val) => onSearchProducts?.(val)}
                      />
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
                        value={row.rate !== "" && row.rate !== undefined ? row.rate : ""}
                        onChange={(e) => handleRowChange(idx, "rate", e.target.value)}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (!isNaN(val) && e.target.value !== "") {
                            handleRowChange(idx, "rate", Number(val.toFixed(2)));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="p-3 text-right font-semibold">
                      ₹{fmt(Number(row.rate || 0) * Number(row.area || 0))}
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
            </table>
          </div>
        </CardContent>
      </Card>
      {isDirty && (
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-900">
          <Button type="submit" disabled={saving} className="font-bold">
            {saving ? "Saving Products..." : "Save Products"}
          </Button>
        </div>
      )}
    </form>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: QUOTATION ────────────────────────────── */
/* ──────────────────────────────────────────────────────── */
interface QuotationTabProps {
  fullProject: any;
  setFullProject: React.Dispatch<React.SetStateAction<any | null>>;
  updateAllCaches: (updatedItem: any) => void;
}

function QuotationTab({ fullProject, setFullProject, updateAllCaches }: QuotationTabProps) {
  const [taxRate, setTaxRate] = useState<number | "">(
    fullProject.tax ? Number(fullProject.tax) : ""
  );
  const [discount, setDiscount] = useState<number | "">(
    fullProject.discount ? Number(fullProject.discount) : ""
  );
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
    return (subtotal * Number(taxRate || 0)) / 100;
  }, [subtotal, taxRate]);

  const discountAmount = useMemo(() => {
    if (discountType === "percent") {
      return (subtotal * Number(discount || 0)) / 100;
    }
    return Number(discount || 0);
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
        tax: Number(taxRate || 0),
        discount: Number(discount || 0),
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
      setFullProject((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tax: Number(taxRate || 0),
          discount: Number(discount || 0),
          discountType,
          agreedPrice: finalPrice,
        };
      });
      updateAllCaches({
        id: fullProject.id,
        agreedPrice: finalPrice,
      });
      toast({
        title: "Quotation Settings Saved",
        description: "Tax, discounts, and agreed price updated successfully.",
      });
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
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Discount Value</span>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))}
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
  materialLogs: any[];
}

function MaterialUsedTab({ projectId, projectProducts, materialLogs }: MaterialUsedTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Material Usage</h3>
        </div>
        <Button asChild size="sm" className="font-bold">
          <Link to="/material-usage">
            <Plus className="h-4 w-4 mr-1.5" />
            Log Materials
          </Link>
        </Button>
      </div>

      <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Litres Logged</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectProducts.map((pp) => {
              // Calculate logged quantity from project materialLogs matching productId
              const loggedProducts = materialLogs.filter((log: any) => log.productId === pp.productId);
              const packSizeL = getProductSizeInLitres(pp.product?.size);
              const litresNum = loggedProducts.reduce((sum: number, log: any) => sum + Number(log.quantity || 0), 0) * packSizeL;

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
                  <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                    {fmt(litresNum)} L
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
    const map: Record<string, { name: string; paymentPerDay: number; daysValueSum: number; phone: string }> = {};

    attendance.forEach((att) => {
      const labourId = att.labourId;
      const lName = att.labour?.name || "Unknown Crew";
      const paymentRate = Number(att.labour?.paymentPerDay || 0);
      const phoneNum = att.labour?.phonenumber || "—";
      const val = Number(att.workDayValue ?? 1.0);
      
      const parsedDate = new Date(att.date);
      if (isNaN(parsedDate.getTime())) return;

      if (!map[labourId]) {
        map[labourId] = {
          name: lName,
          paymentPerDay: paymentRate,
          daysValueSum: 0,
          phone: phoneNum,
        };
      }
      map[labourId].daysValueSum += val;
    });

    return Object.entries(map).map(([id, item]) => ({
      id,
      name: item.name,
      paymentPerDay: item.paymentPerDay,
      daysPresentCount: item.daysValueSum,
      totalWages: item.daysValueSum * item.paymentPerDay,
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
/* ── TAB CONTENT: CUSTOMER PAYMENTS ────────────────────── */
/* ──────────────────────────────────────────────────────── */
interface CustomerPaymentsTabProps {
  fullProject: any;
  setFullProject: React.Dispatch<React.SetStateAction<any | null>>;
  updateAllCaches: (updatedItem: any) => void;
}

function CustomerPaymentsTab({ fullProject, setFullProject, updateAllCaches }: CustomerPaymentsTabProps) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive payment amount.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        projectId: fullProject.id,
        amount: numericAmount,
        type: "INCOMING" as const,
        paymentMode,
        paymentDate: new Date(paymentDate).toISOString(),
        remarks: remarks.trim() || null,
      };

      const res = await apiRequest.create<any>("project-payments", payload);

      // Update local fullProject state
      setFullProject((prev: any) => {
        if (!prev) return prev;
        const newPayments = [res, ...(prev.projectPayments || [])];
        const newPaid = Number(prev.paid || 0) + Number(res.amount || 0);
        return {
          ...prev,
          paid: newPaid,
          projectPayments: newPayments
        };
      });

      // Update projects list cache
      updateAllCaches({
        id: fullProject.id,
        paid: Number(fullProject.paid || 0) + Number(res.amount || 0)
      });

      toast({
        title: "Payment Recorded",
        description: `Recorded incoming payment of ₹${numericAmount.toLocaleString("en-IN")}.`,
      });
      
      // Reset form
      setAmount("");
      setRemarks("");
      setPaymentMode("CASH");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setIsModalOpen(false);
    } catch (err: any) {
      toast({
        title: "Recording Failed",
        description: err.message || "Could not record payment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this payment record?")) return;

    try {
      const targetPayment = (fullProject.projectPayments || []).find((p: any) => p.id === id);
      const subAmount = targetPayment ? Number(targetPayment.amount || 0) : 0;

      await apiRequest.delete("project-payments", id);

      // Update local fullProject state
      setFullProject((prev: any) => {
        if (!prev) return prev;
        const newPayments = (prev.projectPayments || []).filter((p: any) => p.id !== id);
        const newPaid = Math.max(0, Number(prev.paid || 0) - subAmount);
        return {
          ...prev,
          paid: newPaid,
          projectPayments: newPayments
        };
      });

      // Update projects list cache
      updateAllCaches({
        id: fullProject.id,
        paid: Math.max(0, Number(fullProject.paid || 0) - subAmount)
      });

      toast({
        title: "Payment Deleted",
        description: "Project payment record deleted successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.message || "Could not delete payment.",
        variant: "destructive",
      });
    }
  };

  const dueBalance = Math.max(0, Number(fullProject.agreedPrice || fullProject.totalAmount) - Number(fullProject.paid || 0));
  const paymentsList = fullProject.projectPayments || [];

  return (
    <div className="space-y-4">
      {/* Financial Summary Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Customer Payments</h3>
        <Button size="sm" className="font-bold h-8" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Record Payment
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 border border-border/60 bg-muted/20 rounded-xl p-4">
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Agreed Contract Price</span>
          <p className="text-sm font-extrabold text-foreground">₹{fmt(fullProject.agreedPrice || fullProject.totalAmount)}</p>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Received</span>
          <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">₹{fmt(fullProject.paid || 0)}</p>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Due Outstanding</span>
          <p className={`text-sm font-extrabold ${dueBalance > 0 ? "text-rose-600" : "text-emerald-650"}`}>₹{fmt(dueBalance)}</p>
        </div>
      </div>

      <div className="w-full">
        {/* Payments Ledger Table */}
        <Card className="border border-border/80 bg-card rounded-xl overflow-hidden shadow-sm-soft">
          <h4 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider p-4 border-b border-border/80 flex items-center gap-1.5 bg-muted/20">
            <ClipboardList className="h-4 w-4 text-emerald-500" />
            Project Payment History ({paymentsList.length})
          </h4>

          {paymentsList.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-12">
              No payments recorded for this project yet.
            </p>
          ) : (
            <div className="w-full overflow-x-auto no-scrollbar">
              <Table className="text-xs min-w-max">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="h-9 px-3">Date</TableHead>
                    <TableHead className="h-9 px-3 text-right">Amount</TableHead>
                    <TableHead className="h-9 px-3 text-center">Mode</TableHead>
                    <TableHead className="h-9 px-3">Remarks</TableHead>
                    <TableHead className="h-9 px-3 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsList.map((payment: any) => (
                    <TableRow key={payment.id} className="hover:bg-muted/20">
                      <TableCell className="p-3">
                        {new Date(payment.paymentDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="p-3 text-right font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        ₹{fmt(payment.amount)}
                      </TableCell>
                      <TableCell className="p-3 text-center font-bold">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                          {payment.paymentMode || "CASH"}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-3 max-w-[150px] truncate text-muted-foreground">
                        {payment.remarks || "—"}
                      </TableCell>
                      <TableCell className="p-3 text-center">
                        <button
                          onClick={() => handleDeletePayment(payment.id)}
                          className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Record Payment Dialog Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Record New Payment
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Amount (₹) *</label>
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="number"
                  min="1"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 h-9 font-bold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="CASH">CASH</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">CHEQUE</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Payment Date</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-9 text-xs px-2"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Remarks / Reference</label>
              <Input
                placeholder="Optional remarks or transaction ID"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-9 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-9 text-xs font-bold shadow"
              >
                {submitting ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: LABOUR PAYMENTS ───────────────────────── */
/* ──────────────────────────────────────────────────────── */
interface LabourPaymentsTabProps {
  fullProject: any;
}

function LabourPaymentsTab({ fullProject }: LabourPaymentsTabProps) {
  return (
    <Card className="border-0 shadow-none p-0 space-y-4 bg-transparent">
      <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-zinc-900 pb-2">
        <div className="flex items-center gap-2 text-primary">
          <Hammer className="h-5 w-5" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Labour Payments
          </h3>
        </div>
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
    const materialLogs = fullProject.materialLogs ?? [];

    return projectProducts.reduce((sum: number, pp: any) => {
      const priceLitre = Number(pp.product?.price || 0);

      // Find the logged litres used for this product in this project
      const loggedProducts = materialLogs.filter((log: any) => log.productId === pp.productId);
      const totalLoggedQuantity = loggedProducts.reduce((s: number, log: any) => s + Number(log.quantity || 0), 0);

      if (totalLoggedQuantity > 0) {
        const packSizeL = getProductSizeInLitres(pp.product?.size);
        return sum + (totalLoggedQuantity * packSizeL) * priceLitre;
      }

      // Fallback: area * rate (which is rate * area = total row price)
      return sum + Number(pp.rate) * Number(pp.area);
    }, 0);
  }, [fullProject.projectProducts, fullProject.materialLogs]);

  // Compute Labour Cost from attendance ledger
  const labourCost = useMemo(() => {
    const attendance = fullProject.attendance ?? [];
    const map: Record<string, { paymentPerDay: number; daysValueSum: number }> = {};

    attendance.forEach((att: any) => {
      const labourId = att.labourId;
      const paymentRate = Number(att.labour?.paymentPerDay || 0);
      const val = Number(att.workDayValue ?? 1.0);
      
      const parsedDate = new Date(att.date);
      if (isNaN(parsedDate.getTime())) return;

      if (!map[labourId]) {
        map[labourId] = { paymentPerDay: paymentRate, daysValueSum: 0 };
      }
      map[labourId].daysValueSum += val;
    });

    return Object.values(map).reduce((sum, item) => sum + item.daysValueSum * item.paymentPerDay, 0);
  }, [fullProject.attendance]);

  // Compute Contractor Cost from work logs
  const contractorCost = useMemo(() => {
    const contractorWorkLogs = fullProject.contractorWorkLogs ?? [];
    return contractorWorkLogs.reduce((sum: number, log: any) => {
      const rate = Number(log.pricePerSqFt ?? 0);
      return sum + Number(log.sqFt || 0) * rate;
    }, 0);
  }, [fullProject.contractorWorkLogs]);

  const totalCost = productCost + labourCost + contractorCost;
  const profitLoss = agreedPrice - totalCost;
  const isProfit = profitLoss >= 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Profit & Loss</h3>
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
            <div className="flex justify-between">
              <span>Contractor Charges:</span>
              <span className="font-bold">₹{fmt(contractorCost)}</span>
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
/* ── TAB CONTENT: CONTRACTOR WORK LEDGER ────────────────── */
/* ──────────────────────────────────────────────────────── */
interface ContractorWorkLedgerTabProps {
  projectId: string;
  contractorWorkLogs: ContractorWorkLog[];
  setFullProject: React.Dispatch<React.SetStateAction<any | null>>;
}

function ContractorWorkLedgerTab({ projectId, contractorWorkLogs, setFullProject }: ContractorWorkLedgerTabProps) {
  const { data: contractorsRaw } = useMasterData<Contractor>("contractors");
  const allContractors = useMemo(() => Array.isArray(contractorsRaw) ? contractorsRaw : [], [contractorsRaw]);

  const [isOpen, setIsOpen] = useState(contractorWorkLogs.length > 0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (contractorWorkLogs.length > 0) {
      setIsOpen(true);
    }
  }, [contractorWorkLogs.length]);

  // Form states
  const [selectedContractorId, setSelectedContractorId] = useState("");
  const [contractorSearch, setContractorSearch] = useState("");
  const [sqFt, setSqFt] = useState("");
  const [pricePerSqFt, setPricePerSqFt] = useState("");
  const [material, setMaterial] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset form states when modal is closed
  useEffect(() => {
    if (!isModalOpen) {
      setSelectedContractorId("");
      setContractorSearch("");
      setSqFt("");
      setPricePerSqFt("");
      setMaterial("");
      setDate(new Date().toISOString().split("T")[0]);
      setRemarks("");
    }
  }, [isModalOpen]);

  const matchedContractor = allContractors.find(c => c.id === selectedContractorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractorId) {
      toast({
        title: "Required field",
        description: "Please choose a contractor.",
        variant: "destructive",
      });
      return;
    }
    const valSqFt = Number(sqFt);
    if (isNaN(valSqFt) || valSqFt <= 0) {
      toast({
        title: "Invalid Sq.Ft value",
        description: "Please enter a valid positive number for sq.ft.",
        variant: "destructive",
      });
      return;
    }
    const valPrice = Number(pricePerSqFt);
    if (isNaN(valPrice) || valPrice < 0) {
      toast({
        title: "Invalid Price value",
        description: "Please enter a valid price per sq.ft.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest.create<any>("contractor-work-logs", {
        projectId,
        contractorId: selectedContractorId,
        sqFt: valSqFt,
        pricePerSqFt: valPrice,
        material: material.trim() || null,
        date: new Date(date).toISOString(),
        remarks: remarks || null,
      });

      const populatedLog = {
        ...res,
        contractor: matchedContractor ? { name: matchedContractor.name } : null
      };

      setFullProject((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          contractorWorkLogs: [populatedLog, ...(prev.contractorWorkLogs || [])]
        };
      });

      toast({
        title: "Work log recorded",
        description: `Logged ${valSqFt} sq.ft of work.`,
      });

      setSqFt("");
      setPricePerSqFt("");
      setMaterial("");
      setRemarks("");
      setIsModalOpen(false);
    } catch (err: any) {
      toast({
        title: "Failed to record work log",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (window.confirm("Are you sure you want to remove this contractor work log?")) {
      try {
        await apiRequest.delete("contractor-work-logs", logId);

        setFullProject((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            contractorWorkLogs: (prev.contractorWorkLogs || []).filter((log: any) => log.id !== logId)
          };
        });

        toast({
          title: "Work log removed",
          description: "Contractor work logs updated successfully.",
        });
      } catch (err: any) {
        toast({
          title: "Delete failed",
          description: err.message,
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between select-none">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            Contractor Work Ledger
            {contractorWorkLogs.length === 0 && (
              <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-200/40 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                No logs (Minimized)
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Log and track contractor work done in sq.ft.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" className="font-bold h-8" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Log Work
          </Button>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all"
          >
            <ChevronDown className={`h-5 w-5 transform transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="pt-4 border-t border-slate-100 dark:border-zinc-900 animate-fade-in">
          {/* Logs Table */}
          <Card className="w-full border border-slate-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden">
            {contractorWorkLogs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground italic text-sm">
                No contractor work logs recorded yet for this project.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Contractor Name</TableHead>
                    <TableHead>Work (Sq.Ft)</TableHead>
                    <TableHead>Rate / Sq.Ft</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-center w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractorWorkLogs.map((log) => {
                    const rate = Number(log.pricePerSqFt ?? 0);
                    const subtotal = Number(log.sqFt || 0) * rate;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-semibold text-xs text-slate-600 dark:text-slate-400">
                          {new Date(log.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold">{log.contractor?.name || "Unknown"}</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {log.material && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-200 bg-blue-50 text-blue-600 font-extrabold rounded">
                                {log.material}
                              </Badge>
                            )}
                            {log.remarks && <span className="text-[10px] text-slate-400 font-medium">{log.remarks}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{Number(log.sqFt).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-sm">₹{rate.toFixed(2)}</TableCell>
                        <TableCell className="font-bold text-right">₹{fmt(subtotal)}</TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log.id)}
                            className="text-slate-400 hover:text-rose-600 p-2.5 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Log Work Dialog Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-visible">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Log Contractor Work Done
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2 overflow-visible">
            <div className="space-y-1.5 relative overflow-visible">
              <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Choose Contractor *</label>
              <SearchableSelect
                value={selectedContractorId}
                displayValue={matchedContractor?.name || ""}
                options={allContractors
                  .filter((c) => !contractorSearch || c.name.toLowerCase().includes(contractorSearch.toLowerCase()))
                  .slice(0, 10)
                  .map((c) => ({ id: c.id, label: c.name }))}
                placeholder="Search contractor..."
                onSearchChange={setContractorSearch}
                onSelect={(id) => {
                  setSelectedContractorId(id);
                }}
                onClear={() => {
                  setSelectedContractorId("");
                  setContractorSearch("");
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Material Used</label>
              <Input
                type="text"
                placeholder="e.g. Putty, Primer, 1st Coat paint"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Work (Sq.Ft) *</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="0.00"
                  value={sqFt}
                  onChange={(e) => setSqFt(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Rate / Sq.Ft *</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  min="0.00"
                  placeholder="0.00"
                  value={pricePerSqFt}
                  onChange={(e) => setPricePerSqFt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Log Date *</label>
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Remarks / Notes</label>
              <Input
                placeholder="Optional notes e.g. base coat master bedroom"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-9 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-9 text-xs font-bold shadow"
              >
                {submitting ? "Saving Log..." : "Log Work"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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

/* ──────────────────────────────────────────────────────── */
/* ── TAB CONTENT: AREA STATUS PROGRESS ──────────────────── */
/* ──────────────────────────────────────────────────────── */
interface AreaStatusTabProps {
  projectId: string;
}

function AreaStatusTab({ projectId }: AreaStatusTabProps) {
  const [mappings, setMappings] = useState<ProjectAreaColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);

  // Modal dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [areaSearch, setAreaSearch] = useState("");
  const [selectedColorId, setSelectedColorId] = useState("");
  const [colorSearch, setColorSearch] = useState("");
  const [description, setDescription] = useState("");
  const [savingMapping, setSavingMapping] = useState(false);

  // Queries for areas & colors
  const areasQuery = useMasterData<Area>("areas");
  const colorsQuery = useMasterData<Color>("colors");

  const areas = Array.isArray(areasQuery.data) ? areasQuery.data : [];
  const colors = Array.isArray(colorsQuery.data) ? colorsQuery.data : [];

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const results = await apiRequest.fetchAll<ProjectAreaColor>("project-area-colors", {
        projectId,
      });
      setMappings(Array.isArray(results) ? results : []);
    } catch (err: any) {
      toast({
        title: "Failed to fetch mappings",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, [projectId]);

  const handleUpdateStage = async (mappingId: string, stage: string) => {
    setUpdatingStageId(mappingId);
    try {
      await apiRequest.update("project-area-colors", mappingId, { stage });
      setMappings((prev) =>
        prev.map((m) => (m.id === mappingId ? { ...m, stage } : m))
      );
      toast({
        title: "Status Updated",
        description: `Successfully updated room stage to: ${stage}.`,
      });
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Could not update status.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStageId(null);
    }
  };

  const handleCreateArea = async (name: string) => {
    if (!name.trim()) return;
    try {
      const created = await apiRequest.create<Area>("areas", { name: name.trim() });
      setSelectedAreaId(created.id);
      setAreaSearch(created.name);
      toast({ title: "Area created", description: `Created global area "${created.name}".` });
      areasQuery.forceServerSearch(""); // refresh master data
    } catch (err: any) {
      toast({ title: "Failed to create area", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateColor = async (name: string) => {
    if (!name.trim()) return;
    try {
      const created = await apiRequest.create<Color>("colors", { name: name.trim() });
      setSelectedColorId(created.id);
      setColorSearch(created.name);
      toast({ title: "Color created", description: `Created global color "${created.name}".` });
      colorsQuery.forceServerSearch(""); // refresh master data
    } catch (err: any) {
      toast({ title: "Failed to create color", description: err.message, variant: "destructive" });
    }
  };

  const handleOpenAddModal = () => {
    setEditingMappingId(null);
    setSelectedAreaId("");
    setAreaSearch("");
    setSelectedColorId("");
    setColorSearch("");
    setDescription("");
    setDialogOpen(true);
  };

  const handleOpenEditModal = (m: ProjectAreaColor) => {
    setEditingMappingId(m.id);
    setSelectedAreaId(m.areaId);
    setAreaSearch(m.area?.name || "");
    setSelectedColorId(m.colorId);
    setColorSearch(m.color?.shade ? `${m.color.name} (${m.color.shade})` : m.color?.name || "");
    setDescription(m.description || "");
    setDialogOpen(true);
  };

  const handleSaveMapping = async () => {
    if (!selectedAreaId) {
      toast({ title: "Area required", description: "Please select or create an area.", variant: "destructive" });
      return;
    }
    if (!selectedColorId) {
      toast({ title: "Color required", description: "Please select or create a paint color.", variant: "destructive" });
      return;
    }

    setSavingMapping(true);
    try {
      const payload = {
        projectId,
        areaId: selectedAreaId,
        colorId: selectedColorId,
        description: description.trim() || null,
      };

      if (editingMappingId) {
        await apiRequest.update("project-area-colors", editingMappingId, payload);
        toast({ title: "Mapping Updated", description: "Successfully updated room configuration." });
      } else {
        // Check duplicate area configuration for new additions
        const isDuplicate = mappings.some((m) => m.areaId === selectedAreaId);
        if (isDuplicate) {
          toast({
            title: "Already Configured",
            description: "This room/area already has progress tracking configured. Edit the existing record instead.",
            variant: "destructive",
          });
          setSavingMapping(false);
          return;
        }

        await apiRequest.create("project-area-colors", {
          ...payload,
          stage: "Putty",
        });
        toast({ title: "Mapping Created", description: "Successfully added room area and color." });
      }
      setDialogOpen(false);
      fetchMappings(); // Refresh mapping records
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string, areaName: string) => {
    if (!window.confirm(`Are you sure you want to remove the area "${areaName}" progress mapping from this project?`)) {
      return;
    }
    try {
      await apiRequest.delete("project-area-colors", mappingId);
      setMappings((prev) => prev.filter((m) => m.id !== mappingId));
      toast({ title: "Mapping Removed", description: `Removed room "${areaName}" mapping.` });
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.message || "Could not delete mapping.",
        variant: "destructive",
      });
    }
  };

  const STAGES = ["Putty", "Primer", "1st Coat", "2nd Coat"];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Room Areas Status Tracking</h3>
          <p className="text-xs text-muted-foreground">Manage room area color plans and track step-by-step coating status</p>
        </div>
        <Button onClick={handleOpenAddModal} size="sm" className="font-bold flex items-center gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Add Room Area
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-950 rounded-xl border">
          <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
          <span className="text-xs text-muted-foreground">Loading room status records...</span>
        </div>
      ) : mappings.length === 0 ? (
        <Card className="border border-slate-200 dark:border-zinc-800/80 shadow-sm rounded-xl">
          <CardContent className="p-10 text-center flex flex-col items-center justify-center space-y-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center">
              <Paintbrush className="h-5 w-5 text-slate-400" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-700 dark:text-slate-350 text-sm">
                No Room Areas Configured
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm">
                There are no areas assigned to this site yet. Click "Add Room Area" above to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {mappings.map((mapping) => {
            const currentStageIndex = STAGES.indexOf(mapping.stage || "Putty");
            return (
              <Card key={mapping.id} className="border border-slate-200/80 dark:border-zinc-800/80 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-white dark:bg-zinc-950">
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left info */}
                  <div className="space-y-2 lg:max-w-md flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-slate-50 dark:bg-zinc-900 text-primary">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
                          {mapping.area?.name || "Room Area"}
                        </h4>
                      </div>
                      
                      {/* Action buttons (Edit/Delete) */}
                      <div className="flex items-center gap-1.5 lg:hidden">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-slate-400 hover:text-slate-655 hover:bg-slate-50 dark:hover:bg-zinc-900"
                          onClick={() => handleOpenEditModal(mapping)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          onClick={() => handleDeleteMapping(mapping.id, mapping.area?.name || "this area")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-slate-300 flex items-center gap-1 border border-slate-200/50 dark:border-zinc-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {mapping.color?.name || "No Paint Selected"}
                      </Badge>
                      {mapping.color?.shade && (
                        <span className="text-[10px] font-semibold text-muted-foreground font-mono bg-slate-50 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-slate-200/40">
                          Shade: {mapping.color.shade}
                        </span>
                      )}
                    </div>

                    {mapping.description && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400 italic">
                        “{mapping.description}”
                      </p>
                    )}
                  </div>

                  {/* Right Progress Stepper */}
                  <div className="flex-1 max-w-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Room Progress Stepper
                      </span>
                      <Badge className="bg-blue-650 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="h-3 w-3" />
                        Current: {mapping.stage || "Putty"}
                      </Badge>
                    </div>

                    <div className="relative pt-4 pb-2">
                      {/* Line Background */}
                      <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-100 dark:bg-zinc-900 -translate-y-1/2 rounded-full" />
                      
                      {/* Active Line Progress */}
                      <div
                        className="absolute top-1/2 left-4 h-0.5 bg-blue-600 -translate-y-1/2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(Math.max(0, currentStageIndex) / (STAGES.length - 1)) * 95}%`,
                        }}
                      />

                      {/* Stepper Buttons */}
                      <div className="relative flex justify-between">
                        {STAGES.map((s, idx) => {
                          const isCompleted = idx < currentStageIndex;
                          const isActive = idx === currentStageIndex;
                          return (
                            <button
                              key={s}
                              onClick={() => handleUpdateStage(mapping.id, s)}
                              disabled={updatingStageId === mapping.id}
                              className="flex flex-col items-center group focus:outline-none"
                            >
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center border font-bold text-xs shadow-inner transition-all duration-300 ${
                                  isActive
                                    ? "bg-blue-600 text-white border-blue-700 scale-110 shadow-md"
                                    : isCompleted
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900"
                                    : "bg-white text-slate-400 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 hover:border-slate-400"
                                }`}
                              >
                                {idx + 1}
                              </div>
                              <span
                                className={`text-[10px] font-bold mt-1.5 transition-colors ${
                                  isActive
                                    ? "text-blue-600 dark:text-blue-400 font-extrabold"
                                    : isCompleted
                                    ? "text-emerald-650 dark:text-emerald-500"
                                    : "text-slate-400 group-hover:text-slate-600"
                                }`}
                              >
                                {s}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Desktop Action Buttons */}
                  <div className="hidden lg:flex flex-col gap-1.5 pl-4 border-l border-slate-100 dark:border-zinc-900">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-xs font-semibold text-slate-500 hover:text-slate-655 hover:bg-slate-50 dark:hover:bg-zinc-900 justify-start"
                      onClick={() => handleOpenEditModal(mapping)}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 justify-start"
                      onClick={() => handleDeleteMapping(mapping.id, mapping.area?.name || "this area")}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Mapping Dialog Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md overflow-visible rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold tracking-tight">
              {editingMappingId ? "Edit Area Painting Scheme" : "Add Room Area & Color Scheme"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-3 overflow-visible">
            {/* Select Area */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                Select Room Area *
              </span>
              <SearchableSelect
                value={selectedAreaId}
                displayValue={areaSearch}
                options={areas
                  .filter((a) => !areaSearch || a.name.toLowerCase().includes(areaSearch.toLowerCase()))
                  .slice(0, 10)
                  .map((a) => ({ id: a.id, label: a.name }))}
                placeholder="Search or type room area name..."
                onSearchChange={setAreaSearch}
                onSelect={(id, label) => {
                  setSelectedAreaId(id);
                  setAreaSearch(label);
                }}
                onClear={() => {
                  setSelectedAreaId("");
                  setAreaSearch("");
                }}
              />
              {areaSearch.trim() && !areas.some((a) => a.name.toLowerCase() === areaSearch.toLowerCase().trim()) && (
                <button
                  type="button"
                  onClick={() => handleCreateArea(areaSearch)}
                  className="mt-1 text-xs text-primary font-bold flex items-center gap-1 hover:underline text-left focus:outline-none"
                >
                  <Plus className="h-3.5 w-3.5 mr-0.5" /> Create global area: "{areaSearch}"
                </button>
              )}
            </div>

            {/* Select Color */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                Select Paint Color *
              </span>
              <SearchableSelect
                value={selectedColorId}
                displayValue={colorSearch}
                options={colors
                  .filter((c) => !colorSearch || c.name.toLowerCase().includes(colorSearch.toLowerCase()) || (c.shade && c.shade.toLowerCase().includes(colorSearch.toLowerCase())))
                  .slice(0, 10)
                  .map((c) => ({ id: c.id, label: c.shade ? `${c.name} (${c.shade})` : c.name }))}
                placeholder="Search paint colors by name or shade..."
                onSearchChange={setColorSearch}
                onSelect={(id, label) => {
                  setSelectedColorId(id);
                  setColorSearch(label);
                }}
                onClear={() => {
                  setSelectedColorId("");
                  setColorSearch("");
                }}
              />
              {colorSearch.trim() && !colors.some((c) => c.name.toLowerCase() === colorSearch.toLowerCase().trim()) && (
                <button
                  type="button"
                  onClick={() => handleCreateColor(colorSearch)}
                  className="mt-1 text-xs text-primary font-bold flex items-center gap-1 hover:underline text-left focus:outline-none"
                >
                  <Plus className="h-3.5 w-3.5 mr-0.5" /> Create global color: "{colorSearch}"
                </button>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                Description / Remarks (Optional)
              </span>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="E.g., accent wall coloring, first floor bathroom..."
                className="rounded-xl border-slate-200 dark:border-zinc-800 text-sm font-semibold"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-zinc-900 mt-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setDialogOpen(false)} 
                className="font-bold text-xs"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveMapping} 
                disabled={savingMapping} 
                size="sm" 
                className="font-bold text-xs"
              >
                {savingMapping ? "Saving Configuration..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MaterialRequestsTabProps {
  projectId: string;
}

function MaterialRequestsTab({ projectId }: MaterialRequestsTabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { data: requestsRaw, isLoading, update, remove } = useMasterData<LowMaterial>("low-materials");

  const projectRequests = useMemo(() => {
    const list = Array.isArray(requestsRaw) ? requestsRaw : [];
    return list.filter((r) => r.projectId === projectId);
  }, [requestsRaw, projectId]);

  const handleApprove = (req: LowMaterial) => {
    update({
      id: req.id,
      data: { approved: true } as any
    });
    toast({ title: "Request Approved", description: "Office approval recorded." });
  };

  const handleDeliver = (req: LowMaterial) => {
    update({
      id: req.id,
      data: { delivered: true } as any
    });
    toast({ title: "Request Delivered", description: "Material marked as delivered." });
  };

  const handleDelete = (req: LowMaterial) => {
    if (!window.confirm(`Are you sure you want to delete this material request for "${req.material}"?`)) return;
    remove(req.id);
    toast({ title: "Request Deleted", description: "Material request deleted successfully." });
  };

  return (
    <div className="space-y-4 bg-white dark:bg-zinc-950 p-5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm-soft">
      <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-900">
        <div>
          <h3 className="text-sm font-extrabold uppercase text-slate-700 dark:text-zinc-300 flex items-center gap-2">
            <ClipboardList className="h-4.5 w-4.5 text-primary" />
            Project Material Requests Log
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Full history of material requests, office approvals, and delivery status for this project.
          </p>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900">
            <TableRow>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Material</TableHead>
              <TableHead className="text-xs">Quantity</TableHead>
              <TableHead className="text-xs">Approved by Office</TableHead>
              <TableHead className="text-xs">Delivered</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  <span className="text-xs text-muted-foreground mt-2 block">Loading requests...</span>
                </TableCell>
              </TableRow>
            ) : projectRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs italic">
                  No material requests found for this project.
                </TableCell>
              </TableRow>
            ) : (
              projectRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-mono text-xs">{formatDate(req.date)}</TableCell>
                  <TableCell className="font-semibold text-xs text-indigo-650 dark:text-indigo-400">{req.material}</TableCell>
                  <TableCell className="font-medium text-xs">{req.quantity}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
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
                          className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-55 font-bold px-2"
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
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
                          className="h-6 text-[10px] text-blue-650 hover:text-blue-750 hover:bg-blue-50 font-bold px-2"
                        >
                          Mark Delivered
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(req)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-55 dark:hover:bg-rose-950/20 rounded-lg"
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
  );
}

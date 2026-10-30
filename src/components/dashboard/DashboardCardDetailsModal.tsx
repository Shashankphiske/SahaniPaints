import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  FolderOpen,
  TrendingUp,
  IndianRupee,
  Clock,
  Search,
  Download,
  Calendar,
  ExternalLink,
  ChevronRight,
  Loader2,
  X,
  Phone,
  Layers,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { apiRequest } from "../../lib/api";

export type DashboardCardType =
  | "running-projects"
  | "total-value"
  | "revenue-received"
  | "revenue-due";

interface DashboardCardDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCardType: DashboardCardType;
  startDate?: string;
  endDate?: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-300",
  ACTIVE: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-300",
  GOODS_PENDING: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-300",
  GOODS_COMPLETE: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-300",
  TAILOR_PENDING: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-300",
  TAILOR_COMPLETE: "bg-pink-500/10 text-pink-700 border-pink-500/20 dark:bg-pink-500/20 dark:text-pink-300",
  COMPLETED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300",
  DEFAULTER: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  GOODS_PENDING: "Goods Pending",
  GOODS_COMPLETE: "Goods Complete",
  TAILOR_PENDING: "Tailor Pending",
  TAILOR_COMPLETE: "Tailor Complete",
  COMPLETED: "Completed",
  DEFAULTER: "Defaulter",
};

const MODE_STYLES: Record<string, string> = {
  CASH: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300",
  ONLINE: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-300",
  UPI: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-300",
  CHEQUE: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-300",
  BANK_TRANSFER: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20 dark:bg-cyan-500/20 dark:text-cyan-300",
};

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function DashboardCardDetailsModal({
  isOpen,
  onClose,
  initialCardType,
  startDate,
  endDate,
}: DashboardCardDetailsModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardCardType>(initialCardType);
  const [allTime, setAllTime] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"default" | "val-desc" | "val-asc" | "due-desc" | "date-desc">("default");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync tab when initialCardType changes
  React.useEffect(() => {
    setActiveTab(initialCardType);
    setSearchQuery("");
    setStatusFilter("ALL");
    setModeFilter("ALL");
    setSortBy("default");
  }, [initialCardType, isOpen]);

  // Fetch card details
  const { data, isLoading, isError, refetch } = useQuery<{
    cardType: string;
    summary: any;
    items: any[];
  }>({
    queryKey: ["dashboard-card-details", activeTab, allTime ? "all" : `${startDate}_${endDate}`],
    queryFn: async () => {
      const params: Record<string, any> = {
        cardType: activeTab,
      };
      if (allTime) {
        params.allTime = true;
      } else {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await apiRequest.fetchAll<any>("reports/card-details", params);
      return res as any;
    },
    enabled: isOpen,
    staleTime: 60 * 1000,
  });

  const rawItems = useMemo(() => data?.items || [], [data]);
  const summary = useMemo(() => data?.summary || {}, [data]);

  // Handle phone copy
  const handleCopyPhone = (phone: string, id: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered & Sorted items
  const displayItems = useMemo(() => {
    let list = [...rawItems];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const nameMatch = item.name?.toLowerCase().includes(q);
        const projectNameMatch = item.projectName?.toLowerCase().includes(q);
        const customerMatch = item.customerName?.toLowerCase().includes(q);
        const phoneMatch = item.customerPhone?.toLowerCase().includes(q);
        const supervisorMatch = item.supervisorName?.toLowerCase().includes(q);
        const remarksMatch = item.remarks?.toLowerCase().includes(q);
        return (
          nameMatch ||
          projectNameMatch ||
          customerMatch ||
          phoneMatch ||
          supervisorMatch ||
          remarksMatch
        );
      });
    }

    // Status filter
    if (statusFilter !== "ALL") {
      list = list.filter((item) => (item.status || item.projectStatus) === statusFilter);
    }

    // Payment Mode filter
    if (modeFilter !== "ALL") {
      list = list.filter((item) => item.paymentMode === modeFilter);
    }

    // Sorting
    if (sortBy === "val-desc") {
      list.sort((a, b) => Number(b.valuation ?? b.amount ?? 0) - Number(a.valuation ?? a.amount ?? 0));
    } else if (sortBy === "val-asc") {
      list.sort((a, b) => Number(a.valuation ?? a.amount ?? 0) - Number(b.valuation ?? b.amount ?? 0));
    } else if (sortBy === "due-desc") {
      list.sort((a, b) => Number(b.due ?? 0) - Number(a.due ?? 0));
    } else if (sortBy === "date-desc") {
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    return list;
  }, [rawItems, searchQuery, statusFilter, modeFilter, sortBy]);

  // CSV Export
  const handleExportCSV = () => {
    if (displayItems.length === 0) return;

    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (activeTab === "running-projects" || activeTab === "total-value") {
      headers = ["Project Name", "Customer", "Phone", "Status", "Valuation (₹)", "Paid (₹)", "Due (₹)", "Progress (%)", "Project Date", "Supervisor"];
      rows = displayItems.map((p) => [
        p.name ?? "",
        p.customerName ?? "",
        p.customerPhone ?? "",
        p.status ?? "",
        p.valuation ?? 0,
        p.paid ?? 0,
        p.due ?? 0,
        p.progress ?? 0,
        formatDate(p.projectDate || p.createdAt),
        p.supervisorName ?? "",
      ]);
    } else if (activeTab === "revenue-received") {
      headers = ["Date & Time", "Project Name", "Customer", "Phone", "Amount (₹)", "Payment Mode", "Payment Type", "Remarks"];
      rows = displayItems.map((p) => [
        formatDateTime(p.paymentDate || p.createdAt),
        p.projectName ?? "",
        p.customerName ?? "",
        p.customerPhone ?? "",
        p.amount ?? 0,
        p.paymentMode ?? "",
        p.type ?? "",
        p.remarks ?? "",
      ]);
    } else if (activeTab === "revenue-due") {
      headers = ["Project Name", "Customer", "Phone", "Status", "Valuation (₹)", "Paid (₹)", "Outstanding Due (₹)", "Due (%)", "Supervisor"];
      rows = displayItems.map((p) => [
        p.name ?? "",
        p.customerName ?? "",
        p.customerPhone ?? "",
        p.status ?? "",
        p.valuation ?? 0,
        p.paid ?? 0,
        p.due ?? 0,
        `${p.duePercent ?? 0}%`,
        p.supervisorName ?? "",
      ]);
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeTab}_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Navigate to project details
  const handleOpenProject = (projectId: string) => {
    onClose();
    navigate(`/projects?projectId=${projectId}`);
  };

  // Card meta info
  const tabConfigs = [
    {
      type: "running-projects" as const,
      label: "Running Projects",
      icon: FolderOpen,
      color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
      activeBg: "bg-blue-600 text-white shadow-sm shadow-blue-500/25",
    },
    {
      type: "total-value" as const,
      label: "Projects Valuation",
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      activeBg: "bg-emerald-600 text-white shadow-sm shadow-emerald-500/25",
    },
    {
      type: "revenue-received" as const,
      label: "Revenue Received",
      icon: IndianRupee,
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      activeBg: "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25",
    },
    {
      type: "revenue-due" as const,
      label: "Revenue Due",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
      activeBg: "bg-amber-600 text-white shadow-sm shadow-amber-500/25",
    },
  ];

  const currentTabConfig = tabConfigs.find((t) => t.type === activeTab) || tabConfigs[0];
  const CurrentIcon = currentTabConfig.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[96vw] h-[92vh] max-h-[92vh] p-0 flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Header Bar */}
        <div className="px-6 py-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${currentTabConfig.color} shadow-sm shrink-0`}>
              <CurrentIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg sm:text-xl font-bold font-display text-foreground">
                  {activeTab === "running-projects" && "Running Projects Overview"}
                  {activeTab === "total-value" && "Total Projects Valuation"}
                  {activeTab === "revenue-received" && "Revenue Received & Transactions"}
                  {activeTab === "revenue-due" && "Outstanding Revenue Due"}
                </DialogTitle>
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border-primary/20">
                  {displayItems.length} {displayItems.length === 1 ? "Record" : "Records"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span>
                  {allTime
                    ? "Showing all-time records"
                    : `Filtered: ${formatDate(startDate)} to ${formatDate(endDate)}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* All-time toggle */}
            <Button
              size="sm"
              variant={allTime ? "default" : "outline"}
              onClick={() => setAllTime((prev) => !prev)}
              className="text-xs h-8 px-3 rounded-lg font-medium transition-all"
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              {allTime ? "All Time (Active)" : "View All Time"}
            </Button>

            {/* Export CSV button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              disabled={displayItems.length === 0}
              className="text-xs h-8 px-3 rounded-lg font-medium hover:bg-muted transition-all"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Tab Switching Bar */}
        <div className="px-6 pt-3 pb-1 border-b border-border bg-card flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          {tabConfigs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.type;
            return (
              <button
                key={tab.type}
                onClick={() => {
                  setActiveTab(tab.type);
                  setStatusFilter("ALL");
                  setModeFilter("ALL");
                  setSearchQuery("");
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? tab.activeBg
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* KPI Summary Cards Strip */}
        <div className="px-6 py-3 border-b border-border/60 bg-muted/10 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          {activeTab === "running-projects" && (
            <>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Running Count</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">{summary.totalCount ?? 0}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Valuation</p>
                <p className="text-lg font-bold text-foreground mt-0.5">₹{fmt(summary.totalValuation ?? 0)}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Collected Revenue</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">₹{fmt(summary.totalPaid ?? 0)}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Outstanding Due</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">₹{fmt(summary.totalDue ?? 0)}</p>
              </div>
            </>
          )}

          {activeTab === "total-value" && (
            <>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Project Valuation</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">₹{fmt(summary.totalValuation ?? 0)}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Projects</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{summary.totalCount ?? 0}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Average Project Value</p>
                <p className="text-lg font-bold text-foreground mt-0.5">₹{fmt(summary.avgValuation ?? 0)}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Highest Project Value</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">₹{fmt(summary.highestValuation ?? 0)}</p>
              </div>
            </>
          )}

          {activeTab === "revenue-received" && (
            <>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Collections</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">₹{fmt(summary.totalAmount ?? 0)}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Transactions</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{summary.totalCount ?? 0}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Average Transaction</p>
                <p className="text-lg font-bold text-foreground mt-0.5">₹{fmt(summary.avgAmount ?? 0)}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Modes Breakdown</p>
                <div className="flex items-center gap-1.5 mt-1 overflow-x-auto no-scrollbar">
                  {(summary.modes || []).slice(0, 3).map((m: any) => (
                    <span key={m.mode} className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-muted text-muted-foreground">
                      {m.mode}: {m.count}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "revenue-due" && (
            <>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Outstanding Due</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">₹{fmt(summary.totalDue ?? 0)}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Projects with Due</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{summary.totalDueProjects ?? 0}</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Overall Due Ratio</p>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">{summary.overallDuePercent ?? 0}%</p>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-3 shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Value of Due Projects</p>
                <p className="text-lg font-bold text-foreground mt-0.5">₹{fmt(summary.totalValuation ?? 0)}</p>
              </div>
            </>
          )}
        </div>

        {/* Toolbar: Search, Filter & Sort */}
        <div className="px-6 py-3 border-b border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                activeTab === "revenue-received"
                  ? "Search by project, customer, mode, remarks..."
                  : "Search by project name, customer, phone, supervisor..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 text-xs h-9 rounded-xl border-border bg-background"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status chips if project view */}
            {activeTab !== "revenue-received" && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center">
                  <Filter className="h-3 w-3 mr-1" />
                  Status:
                </span>
                {["ALL", "ACTIVE", "PENDING", "GOODS_PENDING", "GOODS_COMPLETE"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      statusFilter === st
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {st === "ALL" ? "All Statuses" : STATUS_LABELS[st] || st}
                  </button>
                ))}
              </div>
            )}

            {/* Mode chips if revenue received */}
            {activeTab === "revenue-received" && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center">
                  <Filter className="h-3 w-3 mr-1" />
                  Mode:
                </span>
                {["ALL", "CASH", "ONLINE", "CHEQUE", "BANK_TRANSFER"].map((md) => (
                  <button
                    key={md}
                    onClick={() => setModeFilter(md)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      modeFilter === md
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {md}
                  </button>
                ))}
              </div>
            )}

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="text-xs h-8 px-2.5 rounded-lg border border-border bg-background text-foreground font-medium cursor-pointer"
            >
              <option value="default">Sort: Default</option>
              <option value="val-desc">Amount: High to Low</option>
              <option value="val-asc">Amount: Low to High</option>
              {activeTab === "revenue-due" && <option value="due-desc">Due: Highest First</option>}
              <option value="date-desc">Date: Newest First</option>
            </select>
          </div>
        </div>

        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-semibold text-muted-foreground">Loading details…</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <AlertCircle className="h-10 w-10 text-destructive/80" />
              <div>
                <p className="text-base font-bold text-foreground">Failed to load detailed report data</p>
                <p className="text-xs text-muted-foreground mt-0.5">Please check your network and try again</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs mt-2">
                Retry
              </Button>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
              <Layers className="h-10 w-10 text-muted-foreground/40 mb-1" />
              <p className="text-sm font-bold text-foreground">No matching records found</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {searchQuery || statusFilter !== "ALL" || modeFilter !== "ALL"
                  ? "Try resetting search query or status filter to view all records."
                  : "No data recorded for this date range. Try toggling 'View All Time'."}
              </p>
              {(searchQuery || statusFilter !== "ALL" || modeFilter !== "ALL") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setModeFilter("ALL");
                  }}
                  className="text-xs mt-2"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border/80 overflow-hidden shadow-xs bg-card">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    {/* Columns based on active tab */}
                    {activeTab === "revenue-received" ? (
                      <>
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Project</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Mode</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Amount Received</th>
                        <th className="py-3 px-4">Remarks</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </>
                    ) : (
                      <>
                        <th className="py-3 px-4">Project Name</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Valuation</th>
                        <th className="py-3 px-4 text-right">Paid</th>
                        <th className="py-3 px-4 text-right">Due</th>
                        <th className="py-3 px-4">Progress / Stage</th>
                        <th className="py-3 px-4">Project Date</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {displayItems.map((item: any) => {
                    if (activeTab === "revenue-received") {
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-muted/30 transition-colors group"
                        >
                          <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                            {formatDateTime(item.paymentDate || item.createdAt)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              onClick={() => item.projectId && handleOpenProject(item.projectId)}
                              className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                            >
                              {item.projectName}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">{item.customerName}</div>
                            {item.customerPhone && (
                              <button
                                onClick={() => handleCopyPhone(item.customerPhone, item.id)}
                                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer mt-0.5"
                              >
                                <Phone className="h-2.5 w-2.5" />
                                <span>{item.customerPhone}</span>
                                {copiedId === item.id ? (
                                  <Check className="h-2.5 w-2.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-2.5 w-2.5 opacity-50" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                                MODE_STYLES[item.paymentMode] || "bg-muted text-muted-foreground"
                              }`}
                            >
                              {item.paymentMode || "CASH"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {item.type || "INCOMING"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                            ₹{fmt(item.amount)}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground max-w-xs truncate" title={item.remarks}>
                            {item.remarks || "—"}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {item.projectId ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenProject(item.projectId)}
                                className="h-7 text-xs px-2.5 text-primary hover:bg-primary/10 rounded-lg font-semibold"
                              >
                                View Project
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    }

                    // Project Rows (Running Projects, Total Value, Revenue Due)
                    const statusKey = item.status || "PENDING";
                    const statusClass =
                      STATUS_STYLES[statusKey] || "bg-muted text-muted-foreground border-border";
                    const isDueHighlighted = activeTab === "revenue-due" || Number(item.due) > 0;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        <td className="py-3 px-4 font-semibold text-foreground">
                          <span
                            onClick={() => handleOpenProject(item.id)}
                            className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1 font-bold text-sm"
                          >
                            {item.name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          {item.supervisorName && item.supervisorName !== "—" && (
                            <span className="text-[10px] text-muted-foreground block font-normal">
                              Supervisor: {item.supervisorName}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-foreground">{item.customerName}</div>
                          {item.customerPhone && (
                            <button
                              onClick={() => handleCopyPhone(item.customerPhone, item.id)}
                              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer mt-0.5"
                            >
                              <Phone className="h-2.5 w-2.5" />
                              <span>{item.customerPhone}</span>
                              {copiedId === item.id ? (
                                <Check className="h-2.5 w-2.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-2.5 w-2.5 opacity-50" />
                              )}
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusClass}`}
                          >
                            {STATUS_LABELS[statusKey] || statusKey}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-foreground font-mono">
                          ₹{fmt(item.valuation)}
                          {item.agreedPrice != null &&
                            item.totalAmount > 0 &&
                            Number(item.agreedPrice) < Number(item.totalAmount) && (
                              <span className="block text-[10px] line-through text-muted-foreground font-normal">
                                ₹{fmt(item.totalAmount)}
                              </span>
                            )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                          ₹{fmt(item.paid)}
                        </td>

                        <td
                          className={`py-3 px-4 text-right whitespace-nowrap font-bold font-mono ${
                            isDueHighlighted && Number(item.due) > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          ₹{fmt(item.due)}
                          {item.duePercent !== undefined && Number(item.due) > 0 && (
                            <span className="block text-[10px] font-semibold opacity-80">
                              ({item.duePercent}% due)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="w-28 space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                              <span>Progress</span>
                              <span>{item.progress ?? 0}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.max(0, item.progress ?? 0))}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {formatDate(item.projectDate || item.createdAt)}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenProject(item.id)}
                            className="h-7 text-xs px-2.5 text-primary hover:bg-primary/10 rounded-lg font-semibold"
                          >
                            Open Project
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Bar */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-foreground">{displayItems.length}</strong> of{" "}
              <strong className="text-foreground">{rawItems.length}</strong> entries
            </span>
            {searchQuery && <span>(filtered by "{searchQuery}")</span>}
          </div>

          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground">
              Total Valuation in view: ₹
              {fmt(
                displayItems.reduce(
                  (sum, item) => sum + Number(item.valuation ?? item.amount ?? 0),
                  0
                )
              )}
            </span>
            <Button size="sm" variant="outline" onClick={onClose} className="text-xs h-7 px-3 rounded-lg">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

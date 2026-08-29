import { useState, useEffect, useMemo, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { useMasterData } from "@/hooks/use-master-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { ActivityLog, User } from "@/types/master";
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Download,
  User as UserIcon,
  Calendar,
  Layers,
  Clock,
  ShieldAlert,
  Info,
  CheckCircle2,
  FileText,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActionBadge(action: string) {
  const act = action.toUpperCase();
  if (act === "CREATE") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50";
  }
  if (act === "UPDATE") {
    return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/50";
  }
  if (act === "DELETE") {
    return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/50";
  }
  if (act === "LOGIN" || act === "AUTH") {
    return "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/50";
  }
  return "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300 border-slate-200 dark:border-zinc-700";
}

export default function ActivityLogsPage() {
  const { toast } = useToast();
  const { data: usersRaw } = useMasterData<User>("users");
  const users = useMemo(() => (Array.isArray(usersRaw) ? usersRaw : []), [usersRaw]);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("ALL");
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [selectedEntity, setSelectedEntity] = useState("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "WEEK">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Selected Log for detail modal
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let startDateStr: string | undefined;
      const now = new Date();
      if (dateFilter === "TODAY") {
        startDateStr = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      } else if (dateFilter === "WEEK") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDateStr = weekAgo.toISOString();
      }

      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedUser !== "ALL") params.append("userId", selectedUser);
      if (selectedAction !== "ALL") params.append("action", selectedAction);
      if (selectedEntity !== "ALL") params.append("entity", selectedEntity);
      if (startDateStr) params.append("startDate", startDateStr);
      params.append("page", String(currentPage));
      params.append("limit", String(pageSize));

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const res = await apiRequest.execute<{ data: ActivityLog[]; total: number }>(
        `/activity-logs${queryStr}`
      );

      if (res && Array.isArray(res.data)) {
        setLogs(res.data);
        setTotalLogs(res.total || 0);
      } else if (Array.isArray(res)) {
        setLogs(res as any);
        setTotalLogs((res as any).length);
      } else {
        setLogs([]);
        setTotalLogs(0);
      }
    } catch (err: any) {
      toast({
        title: "Failed to fetch activity logs",
        description: err.message || "Please check backend connection",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedUser, selectedAction, selectedEntity, dateFilter, currentPage, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Derived Entity List for Filter
  const availableEntities = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.entity) set.add(l.entity);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Dynamic Statistics
  const todayCount = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return logs.filter((l) => l.createdAt && l.createdAt.startsWith(todayStr)).length;
  }, [logs]);

  const uniqueUsersCount = useMemo(() => {
    const set = new Set(logs.map((l) => l.userId || l.userName).filter(Boolean));
    return set.size;
  }, [logs]);

  const exportCSV = () => {
    if (logs.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    const headers = ["Timestamp", "User", "Role", "Action", "Entity", "Details", "IP Address"];
    const rows = logs.map((l) => [
      `"${new Date(l.createdAt).toLocaleString("en-IN")}"`,
      `"${l.userName || (l.user ? l.user.username : "System")}"`,
      `"${l.userRole || (l.user ? l.user.role : "USER")}"`,
      `"${l.action}"`,
      `"${l.entity}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.ipAddress || "—"}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `activity_logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Exported CSV", description: `Exported ${logs.length} activity log entries.` });
  };

  const totalPages = Math.ceil(totalLogs / pageSize) || 1;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                System Activity & Audit Logs
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Monitor user actions, system modifications, and real-time operational audit trails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="h-9 gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="h-9 gap-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-sm dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-slate-100 dark:border-zinc-700"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Records</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">{totalLogs}</p>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-xl">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions Today</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{todayCount}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Users</p>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{uniqueUsersCount}</p>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-xl">
              <UserIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scope</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">Admin Audit Trail</p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 rounded-xl">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Control Bar */}
      <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search user, entity, action, or details..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Filter by User */}
            <div>
              <select
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 px-3 rounded-md text-xs font-semibold border border-slate-200 dark:border-zinc-800 bg-background text-foreground"
              >
                <option value="ALL">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Action */}
            <div>
              <select
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 px-3 rounded-md text-xs font-semibold border border-slate-200 dark:border-zinc-800 bg-background text-foreground"
              >
                <option value="ALL">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="LOGIN">LOGIN</option>
              </select>
            </div>

            {/* Filter by Date */}
            <div>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full h-9 px-3 rounded-md text-xs font-semibold border border-slate-200 dark:border-zinc-800 bg-background text-foreground"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="WEEK">Last 7 Days</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table Card */}
      <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
              <span>Fetching activity log records...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground italic flex flex-col items-center justify-center gap-2">
              <FileText className="h-8 w-8 text-slate-300 dark:text-zinc-700" />
              <span className="font-semibold text-slate-600 dark:text-slate-400">No activity logs recorded yet.</span>
              <span>Modifications across projects, attendance, payments, and masters will appear here automatically.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-5 py-3">Details</th>
                    <th className="px-4 py-3 text-right">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {logs.map((log) => {
                    const uName = log.userName || (log.user ? log.user.username : "System");
                    const uRole = log.userRole || (log.user ? log.user.role : "USER");

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatRelativeTime(log.createdAt)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(log.createdAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                              {uName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{uName}</div>
                              <div className="text-[10px] font-semibold text-slate-400 tracking-tight">{uRole}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getActionBadge(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {log.entity}
                        </td>

                        <td className="px-5 py-3.5 max-w-md text-xs text-slate-600 dark:text-slate-400 font-medium truncate">
                          {log.details}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs font-mono text-slate-400">
                          {log.ipAddress || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {currentPage} of {totalPages} ({totalLogs} items)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-2.5"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Modal */}
      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" />
              <span>Activity Log Details</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Full record summary for selected audit entry.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">User</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {selectedLog.userName || (selectedLog.user ? selectedLog.user.username : "System")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Role</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {selectedLog.userRole || (selectedLog.user ? selectedLog.user.role : "USER")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Action</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Entity</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedLog.entity}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Details</span>
                <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs break-all leading-relaxed">
                  {selectedLog.details}
                </div>
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span>Date: {new Date(selectedLog.createdAt).toLocaleString("en-IN")}</span>
                <span>IP: {selectedLog.ipAddress || "—"}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

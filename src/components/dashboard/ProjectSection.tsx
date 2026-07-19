import { useState, useMemo } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { FolderOpen, Calendar, User, IndianRupee, Loader2, Search, ExternalLink } from "lucide-react";
import type { Project } from "../../types/master";

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

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

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

export function ProjectSection() {
  const { data, isLoading } = useMasterData<Project>("projects");
  const [viewItem, setViewItem] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const runningProjects = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list.filter((p) => {
      // Exclude COMPLETED, DEFAULTER and CANCELLED projects
      if (p.status === "COMPLETED" || p.status === "DEFAULTER" || (p.status as string) === "CANCELLED") {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchCustomer = p.customer?.name?.toLowerCase().includes(q);
        const matchRef = (p as any).projectReference?.toLowerCase().includes(q);
        return matchName || matchCustomer || matchRef;
      }
      return true;
    });
  }, [data, searchQuery]);

  const totalActiveCount = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list.filter((p) => p.status !== "COMPLETED" && p.status !== "DEFAULTER" && (p.status as string) !== "CANCELLED").length;
  }, [data]);

  return (
    <div className="space-y-3.5 border rounded-xl border-border/80 bg-card p-4 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground tracking-tight">
                Running Projects
              </h3>
              <Badge variant="secondary" className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {runningProjects.length}{totalActiveCount !== runningProjects.length ? ` / ${totalActiveCount}` : ""} Active
              </Badge>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search paint projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-muted/30 focus-visible:bg-background border-border/60"
            />
          </div>
        </div>
      </div>

      {/* Projects List Container */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : runningProjects.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs bg-muted/20 rounded-lg border border-dashed border-border/60">
          {searchQuery ? "No matching paint projects found." : "No running paint projects at the moment."}
        </div>
      ) : (
        <div className="max-h-[500px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {runningProjects.map((project) => {
              const total = Number(project.totalAmount ?? 0);
              const paid = Number(project.paid ?? 0);
              const due = total - paid;
              
              return (
                <Card
                  key={project.id}
                  onClick={() => setViewItem(project)}
                  className="group relative overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 border border-border/70 bg-card hover:bg-slate-50/50 dark:hover:bg-slate-900/50 flex flex-col justify-between"
                >
                  <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-2.5">
                    {/* Top Row: Title + Status */}
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <h4 className="font-bold text-sm text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors flex-1" title={project.name}>
                          {project.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase font-bold shrink-0 px-1.5 py-0 rounded-md border ${
                            STATUS_STYLES[project.status] || "bg-muted text-muted-foreground"
                          }`}
                        >
                          {STATUS_LABELS[project.status] || project.status}
                        </Badge>
                      </div>

                      {/* Info Row: Customer & Date */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                        <div className="flex items-center gap-1 min-w-0 truncate" title={project.customer?.name}>
                          <User className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          <span className="truncate text-[11px] font-medium">{project.customer?.name ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80 shrink-0">
                          <Calendar className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          <span>{formatDate(project.projectDate)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary Pill with Simple Light Colors */}
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

                    {/* Bottom Link indicator */}
                    <div className="flex items-center justify-end text-[11px] font-medium text-primary/80 group-hover:text-primary transition-colors pt-0.5">
                      <span>View details</span>
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Read-Only Details Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Project Details</DialogTitle>
          </DialogHeader>

          {viewItem && (
            <div className="space-y-4 text-sm">
              <div className="space-y-3">
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Project Name</p>
                  <p className="font-semibold text-foreground break-words">{viewItem.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Customer</p>
                  <p className="font-semibold text-foreground">{viewItem.customer?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Status</p>
                  <span
                    className={`inline-block text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                      STATUS_STYLES[viewItem.status] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {STATUS_LABELS[viewItem.status] || viewItem.status}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Project Date</span>
                  <span className="font-semibold text-foreground">{formatDate(viewItem.projectDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Total Cost</span>
                  <span className="font-semibold text-foreground flex items-center">
                    <IndianRupee className="h-3.5 w-3.5 shrink-0 mr-0.5" />
                    {fmt(Number(viewItem.totalAmount ?? 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Amount Paid</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                    <IndianRupee className="h-3.5 w-3.5 shrink-0 mr-0.5" />
                    {fmt(Number(viewItem.paid ?? 0))}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2 font-bold">
                  <span className="text-muted-foreground">Due Balance</span>
                  <span className={`flex items-center ${(Number(viewItem.totalAmount ?? 0) - Number(viewItem.paid ?? 0)) > 0 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                    <IndianRupee className="h-3.5 w-3.5 shrink-0 mr-0.5" />
                    {fmt(Number(viewItem.totalAmount ?? 0) - Number(viewItem.paid ?? 0))}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button onClick={() => setViewItem(null)} size="sm">
                  Close Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

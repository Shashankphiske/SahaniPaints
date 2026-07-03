import { useState, useMemo } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { FolderOpen, Calendar, User, IndianRupee, Loader2 } from "lucide-react";
import type { Project } from "../../types/master";

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

  const runningProjects = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    // Exclude COMPLETED, DEFAULTER and CANCELLED projects
    return list.filter(
      (p) => p.status !== "COMPLETED" && p.status !== "DEFAULTER" && (p.status as string) !== "CANCELLED"
    );
  }, [data]);

  return (
    <div className="space-y-4 border rounded-xl border-border bg-card p-5 shadow-sm-soft">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold font-display text-foreground flex items-center gap-2 select-none">
          <FolderOpen className="h-5 w-5 text-primary shrink-0 animate-pulse" />
          Running Projects
        </h3>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">
          {runningProjects.length} Active
        </Badge>
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : runningProjects.length === 0 ? (
        <p className="text-muted-foreground text-sm font-semibold py-2">No running paint projects at the moment.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {runningProjects.map((project) => {
            const total = Number(project.totalAmount ?? 0);
            const paid = Number(project.paid ?? 0);
            const due = total - paid;
            
            return (
              <Card
                key={project.id}
                onClick={() => setViewItem(project)}
                className="relative overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-200 border border-border"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  {/* Title and Top info */}
                  <div className="space-y-2.5">
                    <div className="flex flex-col items-start gap-1">
                      <h4 className="font-bold text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors text-sm">
                        {project.name}
                      </h4>
                      <span
                        className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          STATUS_STYLES[project.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {STATUS_LABELS[project.status] || project.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                        <span className="truncate font-semibold">{project.customer?.name ?? "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                        <span>{formatDate(project.projectDate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    {/* Financial details */}
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Total
                        </span>
                        <span className="text-xs font-bold text-foreground mt-0.5 flex items-center justify-center">
                          <IndianRupee className="h-3 w-3 shrink-0" />
                          {fmt(total)}
                        </span>
                      </div>
                      <div className="flex flex-col border-x border-border">
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Paid
                        </span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center justify-center">
                          <IndianRupee className="h-3 w-3 shrink-0" />
                          {fmt(paid)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Due
                        </span>
                        <span className={`text-xs font-bold mt-0.5 flex items-center justify-center ${due > 0 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                          <IndianRupee className="h-3 w-3 shrink-0" />
                          {fmt(due)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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

import { useReportData,type ReportFilter } from "../../hooks/use-reports";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Loader2, FolderOpen, IndianRupee, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
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

export function ProjectsReportTab({ filter }: { filter?: ReportFilter }) {
  const { data, isLoading, isError } = useReportData("projects", filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground font-medium">Generating Projects Report…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-10 text-destructive text-sm bg-destructive/5 rounded-xl border border-destructive/20">
        Failed to load projects report data.
      </div>
    );
  }

  const summary = data.summary || {};
  const statusBreakdown = data.statusBreakdown || [];
  const topProjects = data.topProjects || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Projects</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{summary.totalProjects ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Project Valuation</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">₹{fmt(summary.totalValue ?? 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Collected Revenue</p>
              <p className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">₹{fmt(summary.totalPaid ?? 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Outstanding Due</p>
              <p className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-0.5">₹{fmt(summary.totalDue ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Valuation Projects Table */}
      <div className="border rounded-xl border-border/80 bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Top Valuation Projects
          </h3>
          <span className="text-xs text-muted-foreground font-medium">Top {topProjects.length} items</span>
        </div>

        <div className="overflow-x-auto border border-border/60 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/60">
              <tr>
                <th className="px-3.5 py-2.5">Project Name</th>
                <th className="px-3.5 py-2.5">Customer</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5 text-right">Total Value</th>
                <th className="px-3.5 py-2.5 text-right">Project Cost</th>
                <th className="px-3.5 py-2.5 text-right">Paid</th>
                <th className="px-3.5 py-2.5 text-right">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {topProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-muted-foreground">No projects found.</td>
                </tr>
              ) : (
                topProjects.map((p: any) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3.5 py-2.5 font-semibold text-foreground">{p.name}</td>
                    <td className="px-3.5 py-2.5 text-muted-foreground">{p.customerName}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${STATUS_STYLES[p.status] || "bg-muted"}`}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-foreground">₹{fmt(p.totalAmount)}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-rose-600 dark:text-rose-400">₹{fmt(p.projectCost)}</td>
                    <td className="px-3.5 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">₹{fmt(p.paid)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-semibold ${p.due > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}`}>
                      ₹{fmt(p.due)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

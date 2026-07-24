import { useReportData,type ReportFilter } from "../../hooks/use-reports";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Loader2, Users, FolderCheck, IndianRupee, Percent } from "lucide-react";

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function InteriorsReportTab({ filter }: { filter?: ReportFilter }) {
  const { data, isLoading, isError } = useReportData("interiors", filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground font-medium">Generating Interiors Report…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-10 text-destructive text-sm bg-destructive/5 rounded-xl border border-destructive/20">
        Failed to load interiors report data.
      </div>
    );
  }

  const summary = data.summary || {};
  const designerBreakdown = data.designerBreakdown || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Designers</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{summary.totalDesigners ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <FolderCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Assigned Projects</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{summary.totalAssignedProjects ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Designer Contract Value</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">₹{fmt(summary.totalContractValue ?? 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Commission Payable</p>
              <p className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-0.5">₹{fmt(summary.totalCommissionsPayable ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Designer Performance & Commission Table */}
      <div className="border rounded-xl border-border/80 bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Designer Performance & Commission Breakdown
          </h3>
          <span className="text-xs text-muted-foreground font-medium">{designerBreakdown.length} designers</span>
        </div>

        <div className="overflow-x-auto border border-border/60 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/60">
              <tr>
                <th className="px-3.5 py-2.5">Designer Name</th>
                <th className="px-3.5 py-2.5">Contact Info</th>
                <th className="px-3.5 py-2.5 text-center">Commission Rate</th>
                <th className="px-3.5 py-2.5 text-center">Projects</th>
                <th className="px-3.5 py-2.5 text-right">Contract Value</th>
                <th className="px-3.5 py-2.5 text-right">Earned Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {designerBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-muted-foreground">No interior designers found.</td>
                </tr>
              ) : (
                designerBreakdown.map((d: any) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3.5 py-2.5 font-semibold text-foreground">{d.name}</td>
                    <td className="px-3.5 py-2.5 text-muted-foreground">
                      <div>{d.phone}</div>
                      <div className="text-[10px] opacity-75">{d.email}</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-700 border-amber-500/20">
                        {d.commissionFeePercentage}%
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-semibold text-foreground">{d.projectCount}</td>
                    <td className="px-3.5 py-2.5 text-right font-semibold text-foreground">₹{fmt(d.totalValue)}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400">₹{fmt(d.earnedCommission)}</td>
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

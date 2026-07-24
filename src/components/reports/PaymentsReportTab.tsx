import { useReportData,type ReportFilter } from "../../hooks/use-reports";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Loader2, IndianRupee, CreditCard, Receipt } from "lucide-react";

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function PaymentsReportTab({ filter }: { filter?: ReportFilter }) {
  const { data, isLoading, isError } = useReportData("payments", filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground font-medium">Generating Payments Report…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-10 text-destructive text-sm bg-destructive/5 rounded-xl border border-destructive/20">
        Failed to load payments report data.
      </div>
    );
  }

  const summary = data.summary || {};
  const modeBreakdown = data.modeBreakdown || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Collections</p>
              <p className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">₹{fmt(summary.totalAmount ?? 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Payment Transactions</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{summary.totalCount ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Modes Breakdown */}
      <div className="border rounded-xl border-border/80 bg-card p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          Collections by Payment Mode
        </h3>

        {modeBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No payment mode data found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {modeBreakdown.map((m: any) => {
              const pct = summary.totalAmount > 0 ? Math.round((m.totalAmount / summary.totalAmount) * 100) : 0;
              return (
                <div key={m.mode} className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border-primary/20">
                      {m.mode || "CASH"}
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">{m.count} txns</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{fmt(m.totalAmount)}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(5, pct))}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

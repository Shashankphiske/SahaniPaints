import { useReportData, type ReportFilter } from "../../hooks/use-reports";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Loader2, Package, Layers, Sparkles, Tags } from "lucide-react";

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function ProductsReportTab({ filter }: { filter?: ReportFilter }) {
  const { data, isLoading, isError } = useReportData("products", filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground font-medium">Generating Products Report…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-10 text-destructive text-sm bg-destructive/5 rounded-xl border border-destructive/20">
        Failed to load products report data.
      </div>
    );
  }

  const summary = data.summary || {};
  const categoryBreakdown = data.categoryBreakdown || [];
  const topProducts = data.topProducts || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Catalogued Products</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{summary.totalCataloguedProducts ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Deployed Products Count</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{summary.totalDeployedItems ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <Tags className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Product Categories</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{categoryBreakdown.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <div className="border rounded-xl border-border/80 bg-card p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Product Category Breakdown
        </h3>

        {categoryBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No category data found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {categoryBreakdown.map((c: any) => (
              <div key={c.category} className="p-3 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between">
                <div>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 border-purple-500/20">
                    {c.category}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Master catalogued items</p>
                </div>
                <span className="text-lg font-bold text-foreground">{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Deployed Products Table */}
      <div className="border rounded-xl border-border/80 bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Top Deployed Products across Projects
          </h3>
          <span className="text-xs text-muted-foreground font-medium">Top {topProducts.length} items</span>
        </div>

        <div className="overflow-x-auto border border-border/60 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/60">
              <tr>
                <th className="px-3.5 py-2.5">Product Name</th>
                <th className="px-3.5 py-2.5">Type</th>
                <th className="px-3.5 py-2.5">Category</th>
                <th className="px-3.5 py-2.5 text-center">Projects Used</th>
                <th className="px-3.5 py-2.5 text-center">Total Quantity</th>
                <th className="px-3.5 py-2.5 text-right">Value Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-muted-foreground">No product usage data found.</td>
                </tr>
              ) : (
                topProducts.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3.5 py-2.5 font-semibold text-foreground">{p.name}</td>
                    <td className="px-3.5 py-2.5 text-muted-foreground">{p.type}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-muted text-muted-foreground">
                        {p.category}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-semibold text-foreground">{p.count}</td>
                    <td className="px-3.5 py-2.5 text-center font-semibold text-foreground">{p.totalQty}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-teal-600 dark:text-teal-400">₹{fmt(p.totalValue)}</td>
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

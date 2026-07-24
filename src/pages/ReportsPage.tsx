import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  FolderOpen,
  CreditCard,
  Users,
  Package,
  CalendarDays,
  RotateCcw,
} from "lucide-react";
import { ProjectsReportTab } from "@/components/reports/ProjectsReportTab";
import { PaymentsReportTab } from "@/components/reports/PaymentsReportTab";
import { InteriorsReportTab } from "@/components/reports/InteriorsReportTab";
import { ProductsReportTab } from "@/components/reports/ProductsReportTab";
import type { ReportFilter } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<string>("projects");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [filter, setFilter] = useState<ReportFilter>({});
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const { toast } = useToast();

  const handleApplyFilter = () => {
    setFilter({ startDate, endDate });
    toast({
      title: "Filters Applied",
      description: "Report data updated for selected date range.",
    });
  };

  const handleResetFilter = () => {
    setStartDate("");
    setEndDate("");
    setFilter({});
    toast({
      title: "Filters Reset",
      description: "Showing all-time reporting data.",
    });
  };

  const applyPreset = (preset: "month" | "quarter" | "year") => {
    const now = new Date();
    let start: Date;
    const end = now;

    if (preset === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === "quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
    }

    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    setStartDate(startStr);
    setEndDate(endStr);
    setFilter({ startDate: startStr, endDate: endStr });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Reports & Business Intelligence
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilter((prev) => !prev)}
              className="h-8 text-xs flex items-center gap-1.5"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {showFilter ? "Hide Date Filter" : "Filter Date Range"}
            </Button>
          </div>
        </div>

        {/* Date Filter Panel */}
        {showFilter && (
          <div className="bg-muted/30 border border-border/80 rounded-xl p-4 space-y-3 animate-fade-in">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs w-40 bg-background"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs w-40 bg-background"
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={handleApplyFilter}>
                  Apply
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleResetFilter}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Reset
                </Button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <span className="font-medium">Quick Presets:</span>
              <button
                onClick={() => applyPreset("month")}
                className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                This Month
              </button>
              <button
                onClick={() => applyPreset("quarter")}
                className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                This Quarter
              </button>
              <button
                onClick={() => applyPreset("year")}
                className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                This Year
              </button>
            </div>
          </div>
        )}

        {/* Main Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/40 p-1 border border-border/60 rounded-xl grid grid-cols-2 md:grid-cols-4 w-full max-w-2xl h-auto">
            <TabsTrigger value="projects" className="py-2 text-xs font-semibold flex items-center gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FolderOpen className="h-3.5 w-3.5" /> Projects
            </TabsTrigger>
            <TabsTrigger value="payments" className="py-2 text-xs font-semibold flex items-center gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CreditCard className="h-3.5 w-3.5" /> Payments
            </TabsTrigger>
            <TabsTrigger value="interiors" className="py-2 text-xs font-semibold flex items-center gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Users className="h-3.5 w-3.5" /> Interiors
            </TabsTrigger>
            <TabsTrigger value="products" className="py-2 text-xs font-semibold flex items-center gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Package className="h-3.5 w-3.5" /> Products
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-0 focus-visible:outline-none">
            <ProjectsReportTab filter={filter} />
          </TabsContent>

          <TabsContent value="payments" className="mt-0 focus-visible:outline-none">
            <PaymentsReportTab filter={filter} />
          </TabsContent>

          <TabsContent value="interiors" className="mt-0 focus-visible:outline-none">
            <InteriorsReportTab filter={filter} />
          </TabsContent>

          <TabsContent value="products" className="mt-0 focus-visible:outline-none">
            <ProductsReportTab filter={filter} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

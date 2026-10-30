import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { InquirySection } from "../components/dashboard/InquirySection";
import { TaskSection } from "../components/dashboard/TaskSection";
import { ProjectSection } from "../components/dashboard/ProjectSection";
import { LowMaterialsSection } from "../components/dashboard/LowMaterialsSection";
import { CashFlowWidget } from "../components/dashboard/CashFlowWidget";
import { CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Loader2, TrendingUp, FolderOpen, IndianRupee, CalendarDays, Clock, ExternalLink } from "lucide-react";
import { apiRequest } from "../lib/api";
import { DashboardCardDetailsModal, type DashboardCardType } from "../components/dashboard/DashboardCardDetailsModal";

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function ReportCard({
  title,
  value,
  icon: Icon,
  color,
  onClick,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="bg-card border border-border rounded-xl p-5 flex items-start justify-between gap-4 shadow-sm-soft flex-1 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-primary/50 group relative overflow-hidden select-none focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <div className="flex items-start gap-3.5">
        <div className={`p-2.5 rounded-lg shrink-0 ${color} transition-transform duration-200 group-hover:scale-105`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-xl font-bold font-display mt-0.5 text-foreground group-hover:text-primary transition-colors">
            {value}
          </p>
        </div>
      </div>
      <div className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">
        <ExternalLink className="h-4 w-4" />
      </div>
    </div>
  );
}

interface ReportData {
  totalPayments: number;
  totalRevenue: number;
  totalDue?: number;
  totalProjects: number;
}

function ReportsSection() {
  const { initialStart, initialEnd } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    // April 1st
    const start = now.getMonth() >= 3
      ? new Date(currentYear, 3, 1)
      : new Date(currentYear - 1, 3, 1);
    // March 31st
    const end = now.getMonth() >= 3
      ? new Date(currentYear + 1, 2, 31)
      : new Date(currentYear, 2, 31);

    const toLocalISO = (d: Date) => {
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - (offset * 60 * 1000));
      return local.toISOString().split("T")[0];
    };

    return {
      initialStart: toLocalISO(start),
      initialEnd: toLocalISO(end),
    };
  }, []);

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [showFilter, setShowFilter] = useState(false);

  const [modalCardType, setModalCardType] = useState<DashboardCardType | null>(null);

  const fetchReports = async (start?: string, end?: string) => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (start) params.startDate = start;
      if (end) params.endDate = end;

      const res: any = await apiRequest.fetchAll("reports", params);
      const data = res?.[0] || null;
      setReport(data);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(startDate, endDate);
  }, []);

  const handleApply = () => {
    fetchReports(startDate, endDate);
  };

  const handleReset = () => {
    setStartDate(initialStart);
    setEndDate(initialEnd);
    fetchReports(initialStart, initialEnd);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider select-none">
          Performance Analytics
        </p>

        <button
          onClick={() => setShowFilter((p) => !p)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition duration-200"
        >
          <CalendarDays className="h-4 w-4" />
          {showFilter ? "Hide Date Filter" : "Filter By Date"}
        </button>
      </div>

      {/* Date Filter Panel */}
      {showFilter && (
        <div className="flex flex-wrap items-end gap-3 bg-muted/20 border border-border rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-1 w-full sm:w-auto">
            <span className="text-xs font-semibold text-muted-foreground">Start Date</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm w-full sm:w-44"
            />
          </div>

          <div className="space-y-1 w-full sm:w-auto">
            <span className="text-xs font-semibold text-muted-foreground">End Date</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm w-full sm:w-44"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </div>
      )}

      {/* Reports KPI Metrics Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : report ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportCard
            title="Running Projects"
            value={String(report.totalProjects ?? 0)}
            icon={FolderOpen}
            color="bg-blue-100 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-200/50"
            onClick={() => setModalCardType("running-projects")}
          />

          <ReportCard
            title="Total Projects Value"
            value={`₹${fmt(report.totalRevenue ?? 0)}`}
            icon={TrendingUp}
            color="bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50"
            onClick={() => setModalCardType("total-value")}
          />

          <ReportCard
            title="Total Revenue Received"
            value={`₹${fmt(report.totalPayments ?? 0)}`}
            icon={IndianRupee}
            color="bg-indigo-100 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50"
            onClick={() => setModalCardType("revenue-received")}
          />

          <ReportCard
            title="Total Revenue Due"
            value={`₹${fmt(report.totalDue ?? Math.max(0, (report.totalRevenue ?? 0) - (report.totalPayments ?? 0)))}`}
            icon={Clock}
            color="bg-amber-100 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200/50"
            onClick={() => setModalCardType("revenue-due")}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground font-semibold">No analytics data recorded for this date range.</p>
      )}

      {/* Detailed Data Popup Modal */}
      {modalCardType && (
        <DashboardCardDetailsModal
          isOpen={!!modalCardType}
          onClose={() => setModalCardType(null)}
          initialCardType={modalCardType}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  );
}

export default function Index() {
  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <CardTitle className="text-2xl font-bold font-display select-none">Paints Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground">Welcome to your Paints overview panel</p>
        </div>
        <ReportsSection />
        <CashFlowWidget />
        <LowMaterialsSection />
        <ProjectSection />
        <TaskSection />
        <InquirySection />
      </div>
    </DashboardLayout>
  );
}

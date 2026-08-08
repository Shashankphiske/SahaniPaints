import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, IndianRupee, Clock, ArrowUpRight, ArrowDownRight, Coins } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useMasterData } from "../../hooks/use-master-data";
import type { Project, ProjectPayment, ContractorPayment, LabourPayment } from "../../types/master";

const fmt = (num: any) => {
  const val = Number(num);
  if (isNaN(val)) return "0.00";
  return val.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const isDateInWeek = (dateStr: string | Date | null | undefined, start: Date, end: Date) => {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    return date >= start && date <= end;
  } catch {
    return false;
  }
};

const formatWeekRangeLabel = (start: Date, end: Date) => {
  const options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  const yearOptions: Intl.DateTimeFormatOptions = { year: "numeric" };
  return `${start.toLocaleDateString("en-GB", options)} - ${end.toLocaleDateString("en-GB", options)} (${start.toLocaleDateString("en-GB", yearOptions)})`;
};

export function CashFlowWidget() {
  const { data: projectPaymentsRaw } = useMasterData<ProjectPayment>("payments");
  const { data: contractorPaymentsRaw } = useMasterData<ContractorPayment>("contractor-payments");
  const { data: labourPaymentsRaw } = useMasterData<LabourPayment>("labour-payments");
  const { data: projectsRaw } = useMasterData<Project>("projects");

  const [referenceDate, setReferenceDate] = useState(() => new Date());

  const projectPayments = useMemo(() => (Array.isArray(projectPaymentsRaw) ? projectPaymentsRaw : []), [projectPaymentsRaw]);
  const contractorPayments = useMemo(() => (Array.isArray(contractorPaymentsRaw) ? contractorPaymentsRaw : []), [contractorPaymentsRaw]);
  const labourPayments = useMemo(() => (Array.isArray(labourPaymentsRaw) ? labourPaymentsRaw : []), [labourPaymentsRaw]);
  const projects = useMemo(() => (Array.isArray(projectsRaw) ? projectsRaw : []), [projectsRaw]);

  // Compute start (Monday) and end (Sunday) of the selected week relative to referenceDate
  const weekRange = useMemo(() => {
    const currentDay = referenceDate.getDay();
    // 0 is Sunday, 1 is Monday...
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    const start = new Date(referenceDate);
    start.setDate(referenceDate.getDate() - distanceToMonday);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  }, [referenceDate]);

  const handleCurrentWeek = () => {
    setReferenceDate(new Date());
  };

  // 1. Incoming this week
  const incomingThisWeek = useMemo(() => {
    return projectPayments
      .filter((p) => isDateInWeek(p.paymentDate, weekRange.start, weekRange.end))
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  }, [projectPayments, weekRange]);

  // 2. Outgoing this week (Contractors + Labours)
  const outgoingThisWeek = useMemo(() => {
    const contractorSum = contractorPayments
      .filter((p) => isDateInWeek(p.paymentDate, weekRange.start, weekRange.end))
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    
    const labourSum = labourPayments
      .filter((p) => isDateInWeek(p.paymentDate, weekRange.start, weekRange.end))
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
      
    return contractorSum + labourSum;
  }, [contractorPayments, labourPayments, weekRange]);

  // 3. Net Cash Flow
  const netCashFlow = useMemo(() => incomingThisWeek - outgoingThisWeek, [incomingThisWeek, outgoingThisWeek]);

  // 4. Upcoming payments (Project Dues)
  const projectDues = useMemo(() => {
    return projects
      .filter((p) => p.status !== "COMPLETED")
      .map((p) => {
        const total = Number(p.agreedPrice || p.totalAmount || 0);
        const paid = Number(p.paid || 0);
        const due = Math.max(0, total - paid);
        return {
          ...p,
          total,
          paid,
          due,
        };
      })
      .filter((p) => p.due > 0)
      .sort((a, b) => b.due - a.due);
  }, [projects]);

  const totalOutstandingDue = useMemo(() => {
    return projectDues.reduce((sum, p) => sum + p.due, 0);
  }, [projectDues]);

  // Format referenceDate safely for HTML5 date input value
  const dateInputValue = useMemo(() => {
    try {
      return referenceDate.toISOString().split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }, [referenceDate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Cash Flow Widget Box */}
      <div className="lg:col-span-2 space-y-4 border rounded-xl border-border/80 bg-card p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-border/40 gap-3">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-indigo-500" />
            <h3 className="text-base font-bold text-foreground tracking-tight select-none">Weekly Cash Flow Overview</h3>
          </div>

          {/* Calendar Selector Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Choose Date:</span>
              <Input
                type="date"
                className="h-8 text-xs font-bold w-36 py-1 px-2 border-border/60 bg-background"
                value={dateInputValue}
                onChange={(e) => {
                  if (e.target.value) {
                    setReferenceDate(new Date(e.target.value));
                  }
                }}
              />
            </div>
            
            <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1.5 rounded-lg select-none">
              Week: {formatWeekRangeLabel(weekRange.start, weekRange.end)}
            </span>
            
            <Button
              variant="ghost"
              className="h-8 text-[10px] font-bold uppercase tracking-wider px-2 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 rounded-lg border border-transparent hover:border-indigo-100"
              onClick={handleCurrentWeek}
            >
              This Week
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Incoming */}
          <Card className="border border-emerald-500/10 bg-emerald-50/10 dark:bg-emerald-950/5 overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-2 relative">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Incoming</span>
                <span className="p-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-baseline gap-0.5">
                  <IndianRupee className="h-4 w-4 text-emerald-600 self-center" />
                  <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
                    {fmt(incomingThisWeek)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">From customer site payments</p>
              </div>
            </CardContent>
          </Card>

          {/* Outgoing */}
          <Card className="border border-rose-500/10 bg-rose-50/10 dark:bg-rose-950/5 overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-2 relative">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Outgoing</span>
                <span className="p-1 rounded bg-rose-100 dark:bg-rose-950 text-rose-600">
                  <ArrowDownRight className="h-4 w-4" />
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-baseline gap-0.5">
                  <IndianRupee className="h-4 w-4 text-rose-600 self-center" />
                  <span className="text-xl font-extrabold text-rose-700 dark:text-rose-400">
                    {fmt(outgoingThisWeek)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Contractor & labour charges</p>
              </div>
            </CardContent>
          </Card>

          {/* Net Cash */}
          <Card className={`border overflow-hidden hover:shadow-md transition-shadow ${
            netCashFlow >= 0 
              ? "border-sky-500/10 bg-sky-50/10 dark:bg-sky-950/5" 
              : "border-amber-500/10 bg-amber-50/10 dark:bg-amber-950/5"
          }`}>
            <CardContent className="p-4 space-y-2 relative">
              <div className="flex justify-between items-center">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  netCashFlow >= 0 ? "text-sky-600" : "text-amber-600"
                }`}>Net Cash Flow</span>
                <span className={`p-1 rounded ${
                  netCashFlow >= 0 
                    ? "bg-sky-100 dark:bg-sky-950 text-sky-600" 
                    : "bg-amber-100 dark:bg-amber-950 text-amber-600"
                }`}>
                  {netCashFlow >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-baseline gap-0.5">
                  <IndianRupee className={`h-4 w-4 self-center ${netCashFlow >= 0 ? "text-sky-600" : "text-amber-600"}`} />
                  <span className={`text-xl font-extrabold ${
                    netCashFlow >= 0 ? "text-sky-700 dark:text-sky-400" : "text-amber-700 dark:text-amber-400"
                  }`}>
                    {netCashFlow >= 0 ? "+" : ""}{fmt(netCashFlow)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Selected week variance</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dues Widget Box */}
      <div className="space-y-4 border rounded-xl border-border/80 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between pb-2.5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-rose-500" />
            <h3 className="text-base font-bold text-foreground tracking-tight select-none">Upcoming Dues</h3>
          </div>
          <div className="flex items-baseline gap-0.5 text-rose-600 dark:text-rose-400">
            <IndianRupee className="h-3 w-3 self-center" />
            <span className="text-sm font-extrabold">{fmt(totalOutstandingDue)}</span>
          </div>
        </div>

        {/* Dues List */}
        <div className="max-h-[145px] overflow-y-auto pr-1 space-y-2">
          {projectDues.length === 0 ? (
            <p className="text-muted-foreground text-xs italic py-6 text-center">No outstanding project dues.</p>
          ) : (
            projectDues.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 pr-2">
                  <h4 className="text-xs font-bold text-foreground truncate" title={project.name}>
                    {project.name}
                  </h4>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {project.customer?.name || "No Customer"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block">
                    ₹{fmt(project.due)}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    of ₹{fmt(project.total)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

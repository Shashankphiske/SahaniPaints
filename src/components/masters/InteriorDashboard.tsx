import { useMemo } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import type { Interior, Project } from "../../types/master";
import { X, Award, Briefcase, IndianRupee, Percent } from "lucide-react";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

const fmt = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  ACTIVE: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  COMPLETED: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  DEFAULTER: "bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

interface InteriorDashboardProps {
  interior: Interior;
  onClose: () => void;
}

export default function InteriorDashboard({ interior, onClose }: InteriorDashboardProps) {
  const { data: projectData, isLoading } = useMasterData<Project>(
    "projects",
    true,
    { interiorId: interior.id }
  );

  const projects = useMemo(
    () => (Array.isArray(projectData) ? projectData : []),
    [projectData]
  );

  const stats = useMemo(() => {
    const totalValue = projects.reduce(
      (sum, p) => sum + (Number(p.totalAmount) || 0),
      0
    );
    const completed = projects.filter((p) => p.status === "COMPLETED").length;
    const active = projects.filter((p) => p.status === "ACTIVE").length;

    const commissionRate = Number(interior.commissionFeePercentage) || 0;
    const earnedCommission = (totalValue * commissionRate) / 100;

    return { totalValue, completed, active, commissionRate, earnedCommission };
  }, [projects, interior]);

  const columns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        key: "name",
        header: "Project",
        render: (p) => <span className="font-semibold text-foreground">{p.name ?? "—"}</span>,
      },
      {
        key: "customerName",
        header: "Customer",
        render: (p) => (p as any).customer?.name ?? "—",
      },
      {
        key: "status",
        header: "Status",
        render: (p) => (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              STATUS_STYLES[p.status] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {p.status}
          </span>
        ),
      },
      {
        key: "totalAmount",
        header: "Value",
        render: (p) => fmt(Number(p.totalAmount) || 0),
      },
      {
        key: "projectDate",
        header: "Date",
        render: (p) =>
          p.projectDate
            ? new Date(p.projectDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "—",
      },
    ],
    []
  );

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/60">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              {interior.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {interior.email || "No email"} • {interior.phonenumber || "No phone"}
            </p>
          </div>
        </DialogHeader>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
          <Card className="border border-border/80 shadow-sm bg-card">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Projects</p>
                <p className="text-lg font-bold text-foreground">{projects.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-sm bg-card">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <IndianRupee className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Contract Volume</p>
                <p className="text-lg font-bold text-foreground">{fmt(stats.totalValue)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-sm bg-card">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Percent className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Commission Rate</p>
                <p className="text-lg font-bold text-foreground">{stats.commissionRate}%</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-sm bg-card">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <IndianRupee className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Commission Earned</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{fmt(stats.earnedCommission)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Projects Ledger */}
        <div className="space-y-2 mt-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Assigned Projects Ledger
          </h3>
          <div className="border border-border/60 rounded-lg overflow-hidden">
            <DataTable
              columns={columns}
              data={projects}
              isLoading={isLoading}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import type { User, Project } from "../../types/master";
import { X } from "lucide-react";
import { MasterForm } from "./MasterForm";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";

const fmt = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const Stat = ({ title, value }: { title: string; value: string | number }) => (
  <div className="border border-border p-4 rounded-xl bg-card shadow-sm-soft">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
    <p className="font-display font-bold text-2xl mt-1 text-foreground">{value}</p>
  </div>
);

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
  DEFAULTER: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  CANCELLED: "bg-slate-100 text-slate-600 dark:bg-slate-900/20 dark:text-slate-455",
};

export default function SalesAssociateDashboard({
  associate,
  onBack,
  handleSave,
}: {
  associate: User;
  onBack: () => void;
  handleSave: (data: any) => void;
}) {
  const { data: projectData, isLoading } = useMasterData<Project>(
    "projects",
    true,
    { creatorId: associate.id }
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

    return { totalValue, completed, active };
  }, [projects]);

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
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
              STATUS_STYLES[p.status] ?? "bg-slate-100 text-slate-600"
            }`}
          >
            {p.status}
          </span>
        ),
      },
      {
        key: "totalAmount",
        header: "Amount",
        render: (p) => fmt(Number(p.totalAmount) || 0),
      },
      {
        key: "projectDate",
        header: "Date",
        render: (p) =>
          p.projectDate
            ? new Date(p.projectDate).toLocaleDateString("en-IN", {
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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">{associate.username}</h1>
          <p className="text-sm text-muted-foreground">{associate.email} • Sales Associate</p>
        </div>
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-muted border border-border text-muted-foreground transition duration-200"
        >
          <X size={18} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat title="Total Projects" value={projects.length} />
        <Stat title="Total Value" value={fmt(stats.totalValue)} />
        <Stat title="Active" value={stats.active} />
        <Stat title="Completed" value={stats.completed} />
      </div>

      {/* Projects list */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm-soft space-y-4">
        <h2 className="text-lg font-bold font-display text-foreground">Projects Ledger</h2>
        <DataTable
          columns={columns}
          data={projects}
          isLoading={isLoading}
        />
      </div>

      {/* Edit form */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm-soft space-y-4">
        <h2 className="text-lg font-bold font-display text-foreground">Sales Associate Details</h2>
        <MasterForm
          resource="sales-associates"
          initialData={associate}
          editing={true}
          onSubmit={handleSave}
          onCancel={onBack}
        />
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import type { Customer, Project } from "../../types/master";
import { X } from "lucide-react";
import { MasterForm } from "./MasterForm";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";

const fmt = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const Stat = ({ title, value }: { title: string; value: string }) => (
  <div className="border border-border p-4 rounded-xl bg-card shadow-sm-soft">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
    <p className="font-display font-bold text-2xl mt-1 text-foreground">{value}</p>
  </div>
);

export default function CustomerDashboard({
  customer,
  onBack,
  handleSave,
  customerId,
}: {
  customer?: Customer;
  onBack: () => void;
  handleSave?: any;
  customerId?: string;
}) {
  // Fetch projects related to the customer
  const { data: projectData, isLoading: isProjectsLoading } = useMasterData<Project>(
    "projects",
    customer ? true : customerId ? true : false,
    { customerId: customerId ? customerId : customer?.id }
  );

  // Fetch customer details if only customerId was passed
  const { data: customerData, isLoading: isCustomerLoading, update: updateCustomer } = useMasterData<Customer>(
    "customers",
    customerId ? true : false,
    { id: customerId }
  );

  const projects = useMemo(
    () => (Array.isArray(projectData) ? projectData : []),
    [projectData]
  );

  const handleCustomerSave = (formData: any) => {
    const idToUpdate = customerId || customer?.id;
    if (idToUpdate) {
      updateCustomer({ id: idToUpdate, data: formData });
    }
  };

  const stats = useMemo(() => {
    let total = 0;
    let received = 0;
    projects.forEach((p) => {
      total += Number(p.totalAmount) || 0;
      received += Number(p.paid) || 0;
    });
    return {
      total,
      received,
      due: total - received,
    };
  }, [projects]);

  const columns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        key: "name",
        header: "Project",
        render: (p) => <span className="font-semibold text-foreground">{p.name ?? "—"}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (p) => (
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase">
            {p.status ?? "—"}
          </span>
        ),
      },
      {
        key: "totalAmount",
        header: "Amount",
        render: (p) => fmt(Number(p.totalAmount) || 0),
      },
      {
        key: "paid",
        header: "Received",
        render: (p) => (
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {fmt(Number(p.paid) || 0)}
          </span>
        ),
      },
      {
        key: "due",
        header: "Due",
        render: (p) => {
          const due = (Number(p.totalAmount) || 0) - (Number(p.paid) || 0);
          return (
            <span className={`font-semibold ${due > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
              {fmt(due)}
            </span>
          );
        },
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

  const activeCustomer = customer || (customerData && customerData[0]);

  return (
    <div className="space-y-6">
      {(!customerId || !isCustomerLoading) && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">{activeCustomer?.name}</h1>
              <p className="text-sm text-muted-foreground">Detailed Client Ledger & Details</p>
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
            <Stat title="Total Projects" value={String(projects.length)} />
            <Stat title="Total Value" value={fmt(stats.total)} />
            <Stat title="Received" value={fmt(stats.received)} />
            <Stat title="Due Balance" value={fmt(stats.due)} />
          </div>

          {/* Projects List */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm-soft space-y-4">
            <h2 className="text-lg font-bold font-display text-foreground">Active Projects</h2>
            <DataTable
              columns={columns}
              data={projects}
              isLoading={isProjectsLoading}
            />
          </div>

          {/* Customer Profile Editing Form */}
          {activeCustomer && (
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm-soft space-y-4">
              <h2 className="text-lg font-bold font-display text-foreground">Customer Profile Information</h2>
              <MasterForm
                resource="customers"
                initialData={activeCustomer}
                editing={true}
                onSubmit={handleSave || handleCustomerSave}
                onCancel={onBack}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

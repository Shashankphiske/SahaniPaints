import { useState, useMemo } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import type { Labour, LabourAttendance, LabourPayment, Project } from "../../types/master";
import { ArrowLeft, Calendar, Coins, Landmark, Loader2, Plus, Trash2, User, Wrench } from "lucide-react";
import { MasterForm } from "./MasterForm";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { apiRequest } from "../../lib/api";
import { toast } from "../../hooks/use-toast";
import { SearchableSelect } from "../ui/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Pencil } from "lucide-react";

const StatCard = ({ title, value, icon: Icon, className = "" }: { title: string; value: string | number; icon: any; className?: string }) => (
  <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <p className={`text-2xl font-bold text-slate-900 dark:text-slate-50 ${className}`}>{value}</p>
    </div>
    <div className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl text-slate-600 dark:text-slate-300">
      <Icon size={20} />
    </div>
  </div>
);

export default function LabourDashboard({
  labour,
  onBack,
  handleSave,
}: {
  labour: Labour;
  onBack: () => void;
  handleSave: (data: any) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "payments" | "edit">("overview");

  // Fetch all attendance logs for this labour
  const {
    data: attendanceRaw,
    isLoading: attendanceLoading,
  } = useMasterData<LabourAttendance>("labour-attendance", true, { labourId: labour.id });

  // Fetch all payments logged for this labour
  const {
    data: paymentsRaw,
    isLoading: paymentsLoading,
    create: createPayment,
    remove: removePayment,
  } = useMasterData<LabourPayment>("labour-payments", true, { labourId: labour.id });

  // Fetch all projects for the dropdown selection
  const {
    data: projectsRaw,
  } = useMasterData<Project>("projects", true);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<"OUTGOING" | "INCOMING">("OUTGOING");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentProject, setPaymentProject] = useState("");
  const [paymentProjectDisplay, setPaymentProjectDisplay] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState<LabourPayment | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const attendanceList = useMemo(() => Array.isArray(attendanceRaw) ? attendanceRaw : [], [attendanceRaw]);
  const paymentsList = useMemo(() => Array.isArray(paymentsRaw) ? paymentsRaw : [], [paymentsRaw]);
  const projectsList = useMemo(() => Array.isArray(projectsRaw) ? projectsRaw : [], [projectsRaw]);

  // Unique sites/projects where this labour has attendance
  const uniqueSites = useMemo(() => {
    const sites = new Set<string>();
    attendanceList.forEach((a) => {
      if (a.project?.name) {
        sites.add(a.project.name);
      }
    });
    return Array.from(sites);
  }, [attendanceList]);

  // Calculations
  const rate = Number(labour.paymentPerDay || 0);
  const totalAttendanceDays = useMemo(() => {
    return attendanceList.reduce((sum, a) => sum + Number(a.workDayValue ?? 1.0), 0);
  }, [attendanceList]);
  const totalCharge = totalAttendanceDays * rate;

  const totalPaid = useMemo(() => {
    return paymentsList.reduce((sum, p) => {
      const amt = Number(p.amount || 0);
      return p.type === "INCOMING" ? sum - amt : sum + amt;
    }, 0);
  }, [paymentsList]);

  const balanceDue = totalCharge - totalPaid;

  const formatPrice = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid payment amount",
        description: "Please enter a positive payment amount.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingPayment(true);
    try {
      const payload = {
        labourId: labour.id,
        projectId: paymentProject || null,
        amount,
        type: paymentType,
        paymentDate: new Date(paymentDate).toISOString(),
        remarks: paymentRemarks || null,
      };

      if (editingPayment) {
        await apiRequest.update("labour-payments", editingPayment.id, payload as any);
        toast({
          title: "Payment updated",
          description: `Successfully updated payment record.`
        });
      } else {
        await createPayment(payload as any);
        toast({
          title: "Payment recorded",
          description: `Successfully logged payment of ${formatPrice(amount)}`,
        });
      }

      setPaymentAmount("");
      setPaymentRemarks("");
      setPaymentProject("");
      setPaymentProjectDisplay("");
      setPaymentType("OUTGOING");
      setIsPaymentModalOpen(false);
      setEditingPayment(null);
    } catch (err: any) {
      toast({
        title: "Failed to record payment",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePayment = (paymentId: string, amount: number) => {
    if (window.confirm(`Are you sure you want to remove this payment entry of ${formatPrice(amount)}?`)) {
      removePayment(paymentId);
      toast({
        title: "Payment entry removed",
        description: "The payment has been deleted successfully.",
      });
    }
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50/50 dark:bg-zinc-950/20 min-h-screen flex flex-col gap-6">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-sm">
            <ArrowLeft size={16} />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300">Labour Profile</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                labour.type === "MONTHLY"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/40"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450 border border-amber-200/40"
              }`}>
                {labour.type === "MONTHLY" ? "Monthly" : "Weekly"}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 truncate mt-0.5">{labour.name}</h1>
            {labour.phonenumber && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{labour.phonenumber}</p>
            )}
          </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/50 dark:border-zinc-800">
          {(["overview", "attendance", "payments", "edit"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? "bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-50 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* STATS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Daily Payment Rate" value={formatPrice(rate)} icon={Coins} />
            <StatCard title="Total Charge Generated" value={formatPrice(totalCharge)} icon={Landmark} />
            <StatCard title="Total Payments Done" value={formatPrice(totalPaid)} icon={Landmark} className="text-emerald-600 dark:text-emerald-400" />
            <StatCard
              title="Balance Due"
              value={formatPrice(balanceDue)}
              icon={Landmark}
              className={balanceDue > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-50"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* WORKED SITES */}
            <div className="lg:col-span-1 bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
                <Wrench size={18} className="text-primary" />
                <h2 className="text-lg font-bold">Active Sites</h2>
              </div>
              <div className="border-t pt-2 flex flex-col gap-2">
                {uniqueSites.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-4 text-center">No project history found.</p>
                ) : (
                  uniqueSites.map((site) => (
                    <div
                      key={site}
                      className="px-4 py-3 bg-slate-50 dark:bg-zinc-900/50 border rounded-xl font-semibold text-slate-800 dark:text-slate-200 text-sm"
                    >
                      {site}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* QUICK PREVIEWS */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
                    <Calendar size={18} className="text-primary" />
                    <h2 className="text-lg font-bold">Recent Attendance</h2>
                  </div>
                  <button onClick={() => setActiveTab("attendance")} className="text-xs font-semibold text-primary hover:underline">
                    View All ({totalAttendanceDays})
                  </button>
                </div>
                <div className="border-t pt-2 divide-y dark:divide-zinc-800">
                  {attendanceList.slice(0, 5).map((a) => (
                    <div key={a.id} className="py-2.5 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(a.date)}</span>
                      <span className="text-slate-500">{a.project?.name || "—"}</span>
                    </div>
                  ))}
                  {attendanceList.length === 0 && (
                    <p className="text-sm text-slate-400 italic py-6 text-center">No attendance logs logged yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
                    <Coins size={18} className="text-primary" />
                    <h2 className="text-lg font-bold">Recent Payments</h2>
                  </div>
                  <button onClick={() => setActiveTab("payments")} className="text-xs font-semibold text-primary hover:underline">
                    View All ({paymentsList.length})
                  </button>
                </div>
                <div className="border-t pt-2 divide-y dark:divide-zinc-800">
                  {paymentsList.slice(0, 5).map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-sm">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(p.paymentDate)}</span>
                        {p.remarks && <span className="text-xs text-slate-400 mt-0.5">{p.remarks}</span>}
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(Number(p.amount))}</span>
                    </div>
                  ))}
                  {paymentsList.length === 0 && (
                    <p className="text-sm text-slate-400 italic py-6 text-center">No payments logged yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === "attendance" && (
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
            <Calendar size={18} className="text-primary" />
            <h2 className="text-lg font-bold">Attendance Records Ledger</h2>
          </div>
          <div className="border-t pt-2">
            {attendanceLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : attendanceList.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-10 text-center">No attendance logs logged yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-900 border-b">
                      <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-400">Marked Date</th>
                      <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-400">Project Site</th>
                      <th className="p-4 font-semibold text-slate-600 dark:text-slate-400">Shift Type</th>
                      <th className="p-4 text-right font-semibold text-slate-600 dark:text-slate-400">Daily Payment Rate</th>
                      <th className="p-4 text-right font-semibold text-slate-600 dark:text-slate-400">Earned Wage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-zinc-800">
                    {attendanceList.map((a) => {
                      const val = Number(a.workDayValue ?? 1.0);
                      const earnedWage = rate * val;
                      const shiftLabel = a.workDayType === "NIGHT" ? "Night (0.5x)" : a.workDayType === "BOTH" ? "Both (1.5x)" : "Day (1.0x)";
                      return (
                        <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30">
                          <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{formatDate(a.date)}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-400">{a.project?.name || "—"}</td>
                          <td className="p-4 font-semibold text-slate-700 dark:text-slate-350">{shiftLabel}</td>
                          <td className="p-4 text-right font-semibold text-slate-600 dark:text-slate-400">{formatPrice(rate)}</td>
                          <td className="p-4 text-right font-bold text-slate-800 dark:text-slate-200">{formatPrice(earnedWage)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENTS TAB */}
      {activeTab === "payments" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Payout & Recovery Records</h3>
              <p className="text-xs text-slate-400">View payroll history for this worker.</p>
            </div>
            <Button
              onClick={() => {
                setEditingPayment(null);
                setPaymentAmount("");
                setPaymentRemarks("");
                setPaymentProject("");
                setPaymentType("OUTGOING");
                setPaymentDate(new Date().toISOString().split("T")[0]);
                setIsPaymentModalOpen(true);
              }}
              size="sm"
              className="font-bold text-xs"
            >
              <Plus size={14} className="mr-1" />
              Log Payout
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Payouts list */}
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
              {paymentsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : paymentsList.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-10 text-center">No payment entries logged yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-900 border-b">
                        <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-400">Payment Date</th>
                        <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-400">Project Site</th>
                        <th className="p-4 text-left font-semibold text-slate-600 dark:text-slate-400">Remarks</th>
                        <th className="p-4 text-right font-semibold text-slate-600 dark:text-slate-400">Amount</th>
                        <th className="p-4 text-center font-semibold text-slate-600 dark:text-slate-400 w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-zinc-800">
                      {paymentsList.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30">
                          <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{formatDate(p.paymentDate)}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-400">{p.project?.name || "Global / General"}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={p.remarks || ""}>
                            {p.remarks || "—"}
                          </td>
                          <td className={`p-4 text-right font-bold ${p.type === "INCOMING" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {p.type === "INCOMING" ? "+" : "-"}{formatPrice(Number(p.amount))}
                          </td>
                          <td className="p-4 text-center space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingPayment(p);
                                setPaymentAmount(p.amount.toString());
                                setPaymentRemarks(p.remarks || "");
                                setPaymentProject(p.projectId || "");
                                setPaymentProjectDisplay(projectsList.find((pr) => pr.id === p.projectId)?.name || "");
                                setPaymentType(p.type);
                                setPaymentDate(p.paymentDate.split("T")[0]);
                                setIsPaymentModalOpen(true);
                              }}
                              className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePayment(p.id, Number(p.amount))}
                              className="text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingPayment ? "Edit Labour Payout" : "Log New Payout"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPayment} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Date Paid *</label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Amount (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter amount paid"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Flow Type *</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="flex w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none"
                  >
                    <option value="OUTGOING">Outgoing Payment (Payout)</option>
                    <option value="INCOMING">Incoming Payment (Recovery/Return)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Associated Project (Site)</label>
                  <SearchableSelect
                    value={paymentProject}
                    displayValue={paymentProjectDisplay}
                    options={projectsList
                      .filter((p) => !paymentProjectDisplay || p.name.toLowerCase().includes(paymentProjectDisplay.toLowerCase()))
                      .slice(0, 10)
                      .map((p) => ({ id: p.id, label: p.name }))}
                    placeholder="Global (Not Site-Specific)"
                    allLabel="Global (Not Site-Specific)"
                    onSearchChange={setPaymentProjectDisplay}
                    onSelect={(id, label) => { setPaymentProject(id); setPaymentProjectDisplay(id ? label : ""); }}
                    onClear={() => { setPaymentProject(""); setPaymentProjectDisplay(""); }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Remarks / Reference</label>
                  <textarea
                    placeholder="Payment remarks (e.g. Cash, GPay, Advance...)"
                    value={paymentRemarks}
                    onChange={(e) => setPaymentRemarks(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button type="button" variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submittingPayment}>
                    {submittingPayment ? "Saving..." : (editingPayment ? "Save Changes" : "Log Payout")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* EDIT TAB */}
      {activeTab === "edit" && (
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
            <User size={18} className="text-primary" />
            <h2 className="text-lg font-bold">Edit Labourer details</h2>
          </div>
          <div className="border-t pt-4">
            <MasterForm
              resource="labours"
              initialData={labour}
              editing={true}
              onSubmit={handleSave}
              onCancel={onBack}
            />
          </div>
        </div>
      )}
    </div>
  );
}

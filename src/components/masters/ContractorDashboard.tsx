import { useState, useMemo, useEffect } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import type { Contractor, ContractorPayment, Project } from "../../types/master";
import { ArrowLeft, Calendar, Coins, Landmark, Loader2, Plus, Trash2, User, Briefcase } from "lucide-react";
import { MasterForm } from "./MasterForm";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { apiRequest } from "../../lib/api";
import { toast } from "../../hooks/use-toast";
import { supabase } from "@/lib/realtime";
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

export default function ContractorDashboard({
  contractor,
  onBack,
  handleSave,
}: {
  contractor: Contractor;
  onBack: () => void;
  handleSave: (data: any) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "payments" | "edit">("overview");

  // Fetch all payments logged for this contractor
  const [paymentsList, setPaymentsList] = useState<ContractorPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Fetch all projects for the dropdown selection
  const { data: projectsRaw } = useMasterData<Project>("projects", true);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<"OUTGOING" | "INCOMING">("OUTGOING");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentProject, setPaymentProject] = useState("");
  const [paymentProjectDisplay, setPaymentProjectDisplay] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ContractorPayment | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const projectsList = useMemo(() => Array.isArray(projectsRaw) ? projectsRaw : [], [projectsRaw]);

  const fetchPayments = async () => {
    setPaymentsLoading(true);
    try {
      const logs = await apiRequest.fetchAll<ContractorPayment>("contractor-payments", { contractorId: contractor.id });
      setPaymentsList(Array.isArray(logs) ? logs : []);
    } catch (err: any) {
      toast({
        title: "Error fetching payments",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();

    const channel = supabase
      .channel(`db-contractor-payments-${contractor.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contractor_payments", filter: `contractor_id=eq.${contractor.id}` },
        () => {
          fetchPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contractor.id]);

  const totalPaid = useMemo(() => {
    return paymentsList.reduce((sum, p) => {
      const amt = Number(p.amount || 0);
      return p.type === "INCOMING" ? sum - amt : sum + amt;
    }, 0);
  }, [paymentsList]);

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
        contractorId: contractor.id,
        projectId: paymentProject || null,
        amount,
        type: paymentType,
        paymentDate: new Date(paymentDate).toISOString(),
        remarks: paymentRemarks || null,
      };

      if (editingPayment) {
        await apiRequest.update("contractor-payments", editingPayment.id, payload as any);
        toast({
          title: "Payment updated",
          description: `Successfully updated payment record.`
        });
      } else {
        await apiRequest.create<ContractorPayment>("contractor-payments", payload as any);
        toast({
          title: "Payment recorded",
          description: `Successfully logged payout of ${formatPrice(amount)}`,
        });
      }

      setPaymentAmount("");
      setPaymentRemarks("");
      setPaymentProject("");
      setPaymentProjectDisplay("");
      setPaymentType("OUTGOING");
      setIsPaymentModalOpen(false);
      setEditingPayment(null);
      fetchPayments();
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

  const handleDeletePayment = async (paymentId: string, amount: number) => {
    if (window.confirm(`Are you sure you want to remove this payment entry of ${formatPrice(amount)}?`)) {
      try {
        await apiRequest.delete("contractor-payments", paymentId);
        toast({
          title: "Payment entry removed",
          description: "Contractor ledger updated successfully."
        });
        fetchPayments();
      } catch (err: any) {
        toast({
          title: "Delete failed",
          description: err.message,
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button and profile header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{contractor.name}</h2>
            <Badge variant="outline" className="bg-slate-50 dark:bg-zinc-900 text-slate-500 font-bold uppercase tracking-wider text-[9px] px-2 py-0">
              Contractor
            </Badge>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              contractor.type === "MONTHLY"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/40"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/40"
            }`}>
              {contractor.type === "MONTHLY" ? "Monthly" : "Weekly"}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Joined {formatDate(contractor.createdAt)}</p>
        </div>
      </div>

      {/* Tabs list */}
      <div className="border-b border-slate-200 dark:border-zinc-800 flex gap-4">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-2.5 text-sm font-bold border-b-2 transition-all duration-150 -mb-[2px] ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`pb-2.5 text-sm font-bold border-b-2 transition-all duration-150 -mb-[2px] ${
            activeTab === "payments"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          Payment History
        </button>
        <button
          onClick={() => setActiveTab("edit")}
          className={`pb-2.5 text-sm font-bold border-b-2 transition-all duration-150 -mb-[2px] ${
            activeTab === "edit"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          Edit Profile
        </button>
      </div>

      {/* TABS CONTENT */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard title="Total Payments Logged" value={formatPrice(totalPaid)} icon={Coins} className="text-emerald-600 dark:text-emerald-400" />
            <StatCard title="Total Associated Projects" value={Array.from(new Set(paymentsList.map(p => p.projectId).filter(Boolean))).length} icon={Briefcase} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Contact Information Card */}
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm md:col-span-1 space-y-4">
              <h3 className="text-xs font-extrabold uppercase text-slate-400 dark:text-zinc-650 tracking-wider flex items-center gap-1.5 select-none">
                <User size={13} />
                Contact Info
              </h3>
              <div className="space-y-3 pt-1">
                <div>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Phone Number</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{contractor.phonenumber ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Email Address</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{contractor.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Address</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{contractor.address ?? "—"}</p>
                </div>
              </div>
            </div>

            {/* Quick Summary list of last payments */}
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm md:col-span-2 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-extrabold uppercase text-slate-400 dark:text-zinc-650 tracking-wider flex items-center gap-1.5 select-none">
                  <Landmark size={13} />
                  Recent Payout Activities
                </h3>
                {paymentsList.length === 0 ? (
                  <div className="text-slate-400 text-xs italic font-medium pt-8 pb-4 text-center">
                    No payment logs recorded yet.
                  </div>
                ) : (
                  <div className="divide-y pt-2 max-h-56 overflow-y-auto space-y-2">
                    {paymentsList.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex justify-between items-center py-2.5 first:pt-0">
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-250 truncate">
                            {p.project?.name || "General Payout"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold">
                            {formatDate(p.paymentDate)} {p.remarks ? `| ${p.remarks}` : ""}
                          </p>
                        </div>
                        <span className={`text-xs font-extrabold ${p.type === "INCOMING" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {p.type === "INCOMING" ? "+" : "-"}{formatPrice(Number(p.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {paymentsList.length > 5 && (
                <button
                  onClick={() => setActiveTab("payments")}
                  className="w-full text-center text-xs font-bold text-primary hover:underline border-t pt-3"
                >
                  View All Transaction Records
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Payout & Recovery Records</h3>
              <p className="text-xs text-slate-400">View payroll history for this contractor.</p>
            </div>
            <Button
              onClick={() => {
                setEditingPayment(null);
                setPaymentAmount("");
                setPaymentRemarks("");
                setPaymentProject("");
                setPaymentProjectDisplay("");
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
            {/* Payments listing ledger */}
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-0 rounded-2xl shadow-sm overflow-hidden">
              {paymentsLoading ? (
                <div className="flex flex-col items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-xs font-medium text-slate-500">Loading payout records...</span>
                </div>
              ) : paymentsList.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-xs italic font-semibold">
                  No contractor payouts logged yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project / Site</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-24 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsList.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                          {p.project?.name || "General"}
                        </TableCell>
                        <TableCell className="font-medium text-muted-foreground text-xs">
                          {formatDate(p.paymentDate)}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {p.remarks || "—"}
                        </TableCell>
                        <TableCell className={`text-right font-extrabold ${p.type === "INCOMING" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {p.type === "INCOMING" ? "+" : "-"}{formatPrice(Number(p.amount))}
                        </TableCell>
                        <TableCell className="text-center space-x-1">
                          <button
                            type="button"
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
                            className="text-slate-400 hover:text-blue-600 p-2"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(p.id, Number(p.amount))}
                            className="text-slate-400 hover:text-rose-600 p-2.5 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingPayment ? "Edit Contractor Payout" : "Log Contractor Payout"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPayment} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Project Site (Optional)</label>
                  <SearchableSelect
                    value={paymentProject}
                    displayValue={paymentProjectDisplay}
                    options={projectsList
                      .filter((p) => !paymentProjectDisplay || p.name.toLowerCase().includes(paymentProjectDisplay.toLowerCase()))
                      .slice(0, 10)
                      .map((p) => ({ id: p.id, label: p.name }))}
                    placeholder="General payout (No specific site)"
                    allLabel="General payout (No specific site)"
                    onSearchChange={setPaymentProjectDisplay}
                    onSelect={(id, label) => { setPaymentProject(id); setPaymentProjectDisplay(id ? label : ""); }}
                    onClear={() => { setPaymentProject(""); setPaymentProjectDisplay(""); }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Payout Amount (₹) *</label>
                  <Input
                    type="number"
                    required
                    min="1"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Flow Type *</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="flex w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent px-3 py-2.5 text-sm font-semibold focus:outline-none"
                  >
                    <option value="OUTGOING">Outgoing (Payout)</option>
                    <option value="INCOMING">Incoming (Refund/Return)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Payout Date *</label>
                  <Input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Remarks / Notes</label>
                  <Input
                    placeholder="e.g. Stage 1 payment, bank transfer"
                    value={paymentRemarks}
                    onChange={(e) => setPaymentRemarks(e.target.value)}
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

      {activeTab === "edit" && (
        <Card className="border border-slate-200 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl max-w-xl">
          <CardHeader className="border-b bg-slate-50/50 dark:bg-zinc-900/10">
            <CardTitle className="text-xs font-extrabold tracking-wide uppercase text-slate-700 dark:text-zinc-300">
              Edit Contractor Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <MasterForm
              resource="contractors"
              initialData={contractor}
              onSubmit={(formData) => {
                handleSave(formData);
                toast({
                  title: "Profile saved",
                  description: "Contractor contact information has been updated."
                });
              }}
              onCancel={() => setActiveTab("overview")}
              editing={true}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

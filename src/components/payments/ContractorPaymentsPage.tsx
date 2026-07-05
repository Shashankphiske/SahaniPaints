import { useState, useEffect, useMemo } from "react";
import { useMasterData } from "@/hooks/use-master-data";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Coins,
  Loader2,
  Trash2,
  Plus,
  Briefcase,
  SlidersHorizontal,
  Search,
  Pencil
} from "lucide-react";
import type { Project, Contractor, ContractorPayment } from "@/types/master";
import { supabase } from "@/lib/realtime";

export default function ContractorPaymentsPage() {
  const { data: projectsRaw } = useMasterData<Project>("projects");
  const { data: contractorsRaw } = useMasterData<Contractor>("contractors");

  const { toast } = useToast();

  const projectsList = useMemo(() => Array.isArray(projectsRaw) ? projectsRaw : [], [projectsRaw]);
  const contractorsList = useMemo(() => Array.isArray(contractorsRaw) ? contractorsRaw : [], [contractorsRaw]);

  // Lists state
  const [contractorPayments, setContractorPayments] = useState<ContractorPayment[]>([]);
  const [loadingContractorPayments, setLoadingContractorPayments] = useState(false);

  // Modal / Dialog state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContractorPayment | null>(null);

  // Form state
  const [conContractorId, setConContractorId] = useState("");
  const [conProjectId, setConProjectId] = useState("");
  const [conAmount, setConAmount] = useState("");
  const [conType, setConType] = useState<"OUTGOING" | "INCOMING">("OUTGOING");
  const [conDate, setConDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [conRemarks, setConRemarks] = useState("");
  const [submittingCon, setSubmittingCon] = useState(false);

  // Search/Filters state
  const [filterSearch, setFilterSearch] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterContractorId, setFilterContractorId] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const fetchContractorPayments = async () => {
    setLoadingContractorPayments(true);
    try {
      const logs = await apiRequest.fetchAll<ContractorPayment>("contractor-payments");
      setContractorPayments(Array.isArray(logs) ? logs : []);
    } catch (err: any) {
      toast({
        title: "Error fetching contractor payments",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoadingContractorPayments(false);
    }
  };

  // Real-time synchronization subscriptions
  useEffect(() => {
    fetchContractorPayments();

    const conChannel = supabase
      .channel("db-contractor-payments-page-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contractor_payments" },
        () => {
          fetchContractorPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conChannel);
    };
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setConContractorId("");
    setConProjectId("");
    setConAmount("");
    setConType("OUTGOING");
    setConDate(new Date().toISOString().split("T")[0]);
    setConRemarks("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // Form handlers
  const handleAddContractorPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conContractorId) return;
    const amount = Number(conAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please specify a positive payment amount.",
        variant: "destructive"
      });
      return;
    }

    setSubmittingCon(true);
    try {
      const payload = {
        contractorId: conContractorId,
        projectId: conProjectId || null,
        amount,
        type: conType,
        paymentDate: new Date(conDate).toISOString(),
        remarks: conRemarks || null
      };

      if (editingItem) {
        await apiRequest.update("contractor-payments", editingItem.id, payload as any);
        toast({
          title: "Payment Updated",
          description: "Contractor payment record has been successfully updated."
        });
      } else {
        await apiRequest.create<ContractorPayment>("contractor-payments", payload as any);
        toast({
          title: "Payment Recorded",
          description: `Successfully logged Contractor Transaction of ₹${amount.toLocaleString("en-IN")}.`
        });
      }
      closeModal();
      fetchContractorPayments();
    } catch (err: any) {
      toast({
        title: "Record Payment Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSubmittingCon(false);
    }
  };

  const handleDeleteContractorPayment = async (id: string, amount: number) => {
    if (!confirm(`Are you sure you want to delete this payment record of ₹${amount.toLocaleString("en-IN")}?`)) return;

    try {
      await apiRequest.delete("contractor-payments", id);
      toast({
        title: "Payment deleted",
        description: "Successfully removed contractor payment record."
      });
      fetchContractorPayments();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  // Filtration logic
  const filteredContractorPayments = useMemo(() => {
    return contractorPayments.filter((p) => {
      if (filterContractorId && p.contractorId !== filterContractorId) return false;
      if (filterProjectId && p.projectId !== filterProjectId) return false;
      if (filterDate) {
        const start = new Date(filterDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filterDate);
        end.setHours(23, 59, 59, 999);
        const d = new Date(p.paymentDate);
        if (d < start || d > end) return false;
      }
      if (filterSearch.trim()) {
        const term = filterSearch.toLowerCase().trim();
        const remarksMatch = p.remarks?.toLowerCase().includes(term);
        if (!remarksMatch) return false;
      }
      return true;
    });
  }, [contractorPayments, filterContractorId, filterProjectId, filterDate, filterSearch]);

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const formatPrice = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex flex-col gap-1.5 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
              Contractor Payments Ledger
            </h2>
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage payroll wage payouts (outgoing) and refunds/returns (incoming) for all contractors.
          </p>
        </div>
        <Button onClick={openAddModal} className="font-bold text-xs">
          <Plus className="h-4 w-4 mr-1.5" />
          Log Transaction
        </Button>
      </div>

      {/* FILTER BAR FOR BOTH TABLES */}
      <Card className="border border-slate-200/60 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl">
        <CardHeader className="py-4 border-b border-slate-100 dark:border-zinc-900 flex flex-row items-center gap-2">
          <SlidersHorizontal size={14} className="text-primary" />
          <CardTitle className="text-xs font-extrabold uppercase text-slate-600 dark:text-zinc-400 tracking-wider">
            Ledger Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 flex flex-wrap gap-4 items-end">
          <div className="space-y-1 w-full sm:w-56">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase">Search Remarks</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filter comments or remarks..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="h-9 text-xs pl-8"
              />
            </div>
          </div>
          <div className="space-y-1 w-full sm:w-48">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase">Project Site</label>
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent px-3 text-xs font-semibold focus:outline-none"
            >
              <option value="">All Projects</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 w-full sm:w-48">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase">Contractor</label>
            <select
              value={filterContractorId}
              onChange={(e) => setFilterContractorId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent px-3 text-xs font-semibold focus:outline-none"
            >
              <option value="">All Contractors</option>
              {contractorsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 w-full sm:w-40">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase">Log Date</label>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterSearch("");
              setFilterProjectId("");
              setFilterContractorId("");
              setFilterDate("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground font-semibold h-9 ml-auto"
          >
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        {/* LEDGER LIST */}
        <Card className="border border-slate-200 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl">
          <CardHeader className="border-b bg-slate-50/50 dark:bg-zinc-900/10">
            <CardTitle className="text-xs font-extrabold tracking-wide uppercase text-slate-700 dark:text-zinc-300">
              Contractor Payouts & Receipts Log
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingContractorPayments ? (
              <div className="flex flex-col items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <span className="text-xs font-medium text-muted-foreground">Loading contractor logs...</span>
              </div>
            ) : filteredContractorPayments.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground text-xs italic font-medium">
                No logs match the specified filter parameters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contractor</TableHead>
                    <TableHead>Associated Site</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-24 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContractorPayments.map((p) => {
                    const contractorName = contractorsList.find((c) => c.id === p.contractorId)?.name || "Contractor";
                    const siteName = projectsList.find((pr) => pr.id === p.projectId)?.name || "General";
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                          {contractorName}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-500 text-xs">
                          {siteName}
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
                              setEditingItem(p);
                              setConContractorId(p.contractorId);
                              setConProjectId(p.projectId || "");
                              setConAmount(p.amount.toString());
                              setConType(p.type);
                              setConDate(p.paymentDate.split("T")[0]);
                              setConRemarks(p.remarks || "");
                              setIsModalOpen(true);
                            }}
                            className="text-slate-400 hover:text-blue-600 p-2 rounded-lg transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContractorPayment(p.id, Number(p.amount))}
                            className="text-slate-400 hover:text-rose-600 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DYNAMIC TRANSACTION POP-UP MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Contractor Payout" : "Log Contractor Transaction"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddContractorPayment} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Select Contractor *
              </label>
              <select
                value={conContractorId}
                onChange={(e) => setConContractorId(e.target.value)}
                required
                className="w-full h-10 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent px-3 text-sm font-semibold focus:outline-none"
              >
                <option value="">Choose contractor...</option>
                {contractorsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Associated Project (Optional)
              </label>
              <select
                value={conProjectId}
                onChange={(e) => setConProjectId(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent px-3 text-sm font-semibold focus:outline-none"
              >
                <option value="">General (No specific site)</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Transaction Type *
              </label>
              <select
                value={conType}
                onChange={(e) => setConType(e.target.value as any)}
                required
                className="w-full h-10 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent px-3 text-sm font-semibold focus:outline-none"
              >
                <option value="OUTGOING">Outgoing Payment (Payout to Contractor)</option>
                <option value="INCOMING">Incoming Payment (Refund from Contractor)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Amount (₹) *
              </label>
              <Input
                type="number"
                required
                min="1"
                placeholder="0.00"
                value={conAmount}
                onChange={(e) => setConAmount(e.target.value)}
                className="font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Payment Date *
              </label>
              <Input
                type="date"
                required
                value={conDate}
                onChange={(e) => setConDate(e.target.value)}
                className="font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Remarks / Notes
              </label>
              <Input
                placeholder="e.g. Phase 2 completion, cash refund"
                value={conRemarks}
                onChange={(e) => setConRemarks(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingCon}>
                {submittingCon ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  editingItem ? "Save Changes" : "Log Transaction"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

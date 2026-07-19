import { useState, useEffect, useMemo } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import { apiRequest } from "../../lib/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { SearchableSelect } from "../ui/SearchableSelect";
import {
  Coins,
  Loader2,
  Trash2,
  Plus,
  SlidersHorizontal,
  Search,
  Pencil,
  IndianRupee,
  Building,
  CreditCard,
  Calendar,
  FileText,
} from "lucide-react";
import type { Project, ProjectPayment } from "../../types/master";
import { supabase } from "../../lib/realtime";

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function PaymentsPage() {
  const { data: projectsRaw } = useMasterData<Project>("projects");
  const { toast } = useToast();

  const projectsList = useMemo(() => (Array.isArray(projectsRaw) ? projectsRaw : []), [projectsRaw]);

  // Project payments list state
  const [payments, setPayments] = useState<ProjectPayment[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog & Edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectPayment | null>(null);

  // Form state
  const [projectId, setProjectId] = useState("");
  const [projectDisplay, setProjectDisplay] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filters state
  const [filterSearch, setFilterSearch] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterProjectDisplay, setFilterProjectDisplay] = useState("");
  const [filterMode, setFilterMode] = useState("");

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const logs = await apiRequest.fetchAll<ProjectPayment>("project-payments");
      setPayments(Array.isArray(logs) ? logs : []);
    } catch (err: any) {
      toast({
        title: "Fetch Error",
        description: err.message || "Failed to load project payments.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();

    const channel = supabase
      .channel("db-project-payments-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_payments" }, () => {
        fetchPayments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setProjectId("");
    setProjectDisplay("");
    setAmount("");
    setPaymentMode("CASH");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setRemarks("");
    setIsModalOpen(true);
  };

  const openEditModal = (payment: ProjectPayment) => {
    setEditingItem(payment);
    setProjectId(payment.projectId);
    const matchedProject = projectsList.find((p) => p.id === payment.projectId);
    setProjectDisplay(matchedProject ? matchedProject.name : payment.project?.name || "");
    setAmount(String(payment.amount));
    setPaymentMode(payment.paymentMode || "CASH");
    setPaymentDate(payment.paymentDate ? new Date(payment.paymentDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
    setRemarks(payment.remarks || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      toast({ title: "Project Required", description: "Please select a project site.", variant: "destructive" });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid positive payment amount.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        projectId,
        amount: numericAmount,
        type: "INCOMING" as const,
        paymentMode,
        paymentDate: new Date(paymentDate).toISOString(),
        remarks: remarks.trim() || null,
      };

      if (editingItem) {
        const updated = await apiRequest.update<ProjectPayment>("project-payments", editingItem.id, payload);
        setPayments((prev) => prev.map((item) => (item.id === editingItem.id ? { ...item, ...updated } : item)));
        toast({ title: "Payment Updated", description: "Project payment record updated successfully." });
      } else {
        const created = await apiRequest.create<ProjectPayment>("project-payments", payload);
        const matchedProject = projectsList.find((p) => p.id === projectId);
        const completeRecord = {
          ...created,
          project: matchedProject ? { name: matchedProject.name } : created.project,
        };
        setPayments((prev) => [completeRecord, ...prev]);
        toast({ title: "Payment Recorded", description: `Recorded incoming payment of ₹${fmt(numericAmount)}.` });
      }

      setIsModalOpen(false);
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message || "Could not save payment.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this payment record?")) return;

    try {
      await apiRequest.delete("project-payments", id);
      setPayments((prev) => prev.filter((item) => item.id !== id));
      toast({ title: "Payment Deleted", description: "Project payment record deleted successfully." });
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message || "Could not delete payment.", variant: "destructive" });
    }
  };

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (filterProjectId && p.projectId !== filterProjectId) return false;
      if (filterMode && (p.paymentMode || "CASH") !== filterMode) return false;
      if (filterSearch.trim()) {
        const term = filterSearch.toLowerCase().trim();
        const projName = p.project?.name?.toLowerCase() || "";
        const rem = p.remarks?.toLowerCase() || "";
        if (!projName.includes(term) && !rem.includes(term)) return false;
      }
      return true;
    });
  }, [payments, filterProjectId, filterMode, filterSearch]);

  // Statistics
  const totalReceived = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  // Filter toggle state
  const [showFilterCard, setShowFilterCard] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            Project Payments Received
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showFilterCard ? "default" : "outline"}
            onClick={() => setShowFilterCard(!showFilterCard)}
            className="font-medium flex items-center gap-1.5 shadow-sm"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {(filterSearch || filterProjectId || filterMode) ? (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full font-medium">
                !
              </span>
            ) : null}
          </Button>

          <Button onClick={openCreateModal} className="font-medium flex items-center gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" /> Add Incoming Payment
          </Button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Revenue Collected</p>
              <p className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{fmt(totalReceived)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Payment Transactions</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                {filteredPayments.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Projects</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                {projectsList.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      {showFilterCard && (
        <Card className="border border-border/80 bg-card shadow-sm rounded-xl">
          <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-row items-center gap-2">
            <SlidersHorizontal size={14} className="text-primary" />
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Filter Payment Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="space-y-1 w-full sm:w-64">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Search Project / Remarks</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Type to search..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="pl-9 h-8 text-xs bg-background"
                />
              </div>
            </div>

            <div className="space-y-1 w-full sm:w-56">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Project Site</label>
              <SearchableSelect
                value={filterProjectId}
                displayValue={filterProjectDisplay}
                options={projectsList
                  .filter((p) => !filterProjectDisplay || p.name.toLowerCase().includes(filterProjectDisplay.toLowerCase()))
                  .slice(0, 10)
                  .map((p) => ({ id: p.id, label: p.name }))}
                placeholder="All Project Sites"
                allLabel="All Project Sites"
                onSearchChange={setFilterProjectDisplay}
                onSelect={(id, label) => {
                  setFilterProjectId(id);
                  setFilterProjectDisplay(id ? label : "");
                }}
                onClear={() => {
                  setFilterProjectId("");
                  setFilterProjectDisplay("");
                }}
                inputHeight="h-8"
                textSize="text-xs"
                className="bg-background"
              />
            </div>

            <div className="space-y-1 w-full sm:w-40">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Payment Mode</label>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">All Modes</option>
                <option value="CASH">Cash</option>
                <option value="ONLINE">Online / UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            {(filterSearch || filterProjectId || filterMode) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setFilterSearch("");
                  setFilterProjectId("");
                  setFilterProjectDisplay("");
                  setFilterMode("");
                }}
              >
                Reset Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Ledger Table */}
      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table className="text-xs">
            <TableHeader className="bg-muted/40 uppercase text-[10px] font-bold tracking-wider">
              <TableRow>
                <TableHead className="py-2.5">Date</TableHead>
                <TableHead className="py-2.5">Project Site</TableHead>
                <TableHead className="py-2.5">Payment Mode</TableHead>
                <TableHead className="py-2.5">Remarks / Details</TableHead>
                <TableHead className="py-2.5 text-right">Amount Received</TableHead>
                <TableHead className="py-2.5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading project payments...
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No incoming project payments recorded.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-muted-foreground">
                      {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {p.project?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                        {p.paymentMode || "CASH"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {p.remarks || "—"}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{fmt(p.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEditModal(p)}>
                          <Pencil size={13} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record / Edit Payment Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              {editingItem ? "Edit Incoming Project Payment" : "Record Incoming Project Payment"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Select Project Site <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <SearchableSelect
                value={projectId}
                displayValue={projectDisplay}
                options={projectsList
                  .filter((p) => !projectDisplay || p.name.toLowerCase().includes(projectDisplay.toLowerCase()))
                  .slice(0, 10)
                  .map((p) => ({ id: p.id, label: p.name }))}
                placeholder="Choose project site..."
                onSearchChange={setProjectDisplay}
                onSelect={(id, label) => {
                  setProjectId(id);
                  setProjectDisplay(label);
                }}
                onClear={() => {
                  setProjectId("");
                  setProjectDisplay("");
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Amount Received (₹) <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50000"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Payment Mode <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="CASH">Cash</option>
                  <option value="ONLINE">Online / UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Payment Date <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Remarks / Notes</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Advance installment, Milestone payment, etc."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editingItem ? "Update Payment" : "Save Payment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

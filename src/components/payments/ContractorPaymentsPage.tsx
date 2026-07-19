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
  Briefcase,
  Loader2,
  Trash2,
  Plus,
  SlidersHorizontal,
  Search,
  Pencil,
  IndianRupee,
  Building,
  Hammer,
  UserCheck,
  CreditCard,
  ArrowUpRight,
} from "lucide-react";
import type { Project, Contractor, Labour, ContractorPayment, LabourPayment } from "../../types/master";
import { supabase } from "../../lib/realtime";
import LabourDashboard from "../masters/LabourDashboard";
import ContractorDashboard from "../masters/ContractorDashboard";

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export interface CombinedCrewPayment {
  id: string;
  payeeType: "LABOUR" | "CONTRACTOR";
  payeeId: string;
  payeeName: string;
  projectId?: string | null;
  projectName?: string;
  amount: number;
  paymentMode?: string | null;
  paymentDate: string;
  remarks?: string | null;
  createdAt: string;
  raw: ContractorPayment | LabourPayment;
}

export default function ContractorPaymentsPage() {
  const { data: projectsRaw } = useMasterData<Project>("projects");
  const { data: contractorsRaw } = useMasterData<Contractor>("contractors");
  const { data: laboursRaw } = useMasterData<Labour>("labours");
  const { toast } = useToast();

  const projectsList = useMemo(() => (Array.isArray(projectsRaw) ? projectsRaw : []), [projectsRaw]);
  const contractorsList = useMemo(() => (Array.isArray(contractorsRaw) ? contractorsRaw : []), [contractorsRaw]);
  const laboursList = useMemo(() => (Array.isArray(laboursRaw) ? laboursRaw : []), [laboursRaw]);

  // Combined ledger state
  const [contractorPayments, setContractorPayments] = useState<ContractorPayment[]>([]);
  const [labourPayments, setLabourPayments] = useState<LabourPayment[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog & Edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CombinedCrewPayment | null>(null);

  // Form state
  const [payeeType, setPayeeType] = useState<"LABOUR" | "CONTRACTOR">("CONTRACTOR");
  const [payeeId, setPayeeId] = useState("");
  const [payeeDisplay, setPayeeDisplay] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectDisplay, setProjectDisplay] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [filterCategory, setFilterCategory] = useState<"ALL" | "LABOUR" | "CONTRACTOR">("ALL");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterProjectDisplay, setFilterProjectDisplay] = useState("");
  const [filterMode, setFilterMode] = useState("");

  const fetchAllCrewPayments = async () => {
    setLoading(true);
    try {
      const [cLogs, lLogs] = await Promise.all([
        apiRequest.fetchAll<ContractorPayment>("contractor-payments"),
        apiRequest.fetchAll<LabourPayment>("labour-payments"),
      ]);
      setContractorPayments(Array.isArray(cLogs) ? cLogs : []);
      setLabourPayments(Array.isArray(lLogs) ? lLogs : []);
    } catch (err: any) {
      toast({
        title: "Fetch Error",
        description: err.message || "Failed to load crew payments.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllCrewPayments();

    const channel1 = supabase
      .channel("db-contractor-payments-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "contractor_payments" }, () => {
        fetchAllCrewPayments();
      })
      .subscribe();

    const channel2 = supabase
      .channel("db-labour-payments-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "labour_payments" }, () => {
        fetchAllCrewPayments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, []);

  // Merge contractor and labour payments into single unified list
  const combinedPayments = useMemo<CombinedCrewPayment[]>(() => {
    const cList: CombinedCrewPayment[] = contractorPayments.map((cp) => {
      const matchedContractor = contractorsList.find((c) => c.id === cp.contractorId);
      return {
        id: cp.id,
        payeeType: "CONTRACTOR",
        payeeId: cp.contractorId,
        payeeName: matchedContractor ? matchedContractor.name : cp.contractor?.name || "Contractor",
        projectId: cp.projectId,
        projectName: cp.project?.name,
        amount: Number(cp.amount),
        paymentMode: cp.paymentMode || "CASH",
        paymentDate: cp.paymentDate,
        remarks: cp.remarks,
        createdAt: cp.createdAt,
        raw: cp,
      };
    });

    const lList: CombinedCrewPayment[] = labourPayments.map((lp) => {
      const matchedLabour = laboursList.find((l) => l.id === lp.labourId);
      return {
        id: lp.id,
        payeeType: "LABOUR",
        payeeId: lp.labourId,
        payeeName: matchedLabour ? matchedLabour.name : lp.labour?.name || "Worker",
        projectId: lp.projectId,
        projectName: lp.project?.name,
        amount: Number(lp.amount),
        paymentMode: lp.paymentMode || "CASH",
        paymentDate: lp.paymentDate,
        remarks: lp.remarks,
        createdAt: lp.createdAt,
        raw: lp,
      };
    });

    return [...cList, ...lList].sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );
  }, [contractorPayments, labourPayments, contractorsList, laboursList]);

  const openCreateModal = () => {
    setEditingItem(null);
    setPayeeType("CONTRACTOR");
    setPayeeId("");
    setPayeeDisplay("");
    setProjectId("");
    setProjectDisplay("");
    setAmount("");
    setPaymentMode("CASH");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setRemarks("");
    setIsModalOpen(true);
  };

  const openEditModal = (payment: CombinedCrewPayment) => {
    setEditingItem(payment);
    setPayeeType(payment.payeeType);
    setPayeeId(payment.payeeId);
    setPayeeDisplay(payment.payeeName);
    setProjectId(payment.projectId || "");
    setProjectDisplay(payment.projectName || "");
    setAmount(String(payment.amount));
    setPaymentMode(payment.paymentMode || "CASH");
    setPaymentDate(payment.paymentDate ? new Date(payment.paymentDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
    setRemarks(payment.remarks || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!payeeId) {
      toast({
        title: "Payee Required",
        description: `Please select a valid ${payeeType.toLowerCase()}.`,
        variant: "destructive",
      });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid outgoing payout amount.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      if (payeeType === "CONTRACTOR") {
        const payload = {
          contractorId: payeeId,
          projectId: projectId || null,
          amount: numericAmount,
          type: "OUTGOING" as const,
          paymentMode,
          paymentDate: new Date(paymentDate).toISOString(),
          remarks: remarks.trim() || null,
        };

        if (editingItem) {
          const updated = await apiRequest.update<ContractorPayment>("contractor-payments", editingItem.id, payload);
          setContractorPayments((prev) => prev.map((item) => (item.id === editingItem.id ? { ...item, ...updated } : item)));
          toast({ title: "Payout Updated", description: "Contractor payment record updated successfully." });
        } else {
          const created = await apiRequest.create<ContractorPayment>("contractor-payments", payload);
          setContractorPayments((prev) => [created, ...prev]);
          toast({ title: "Payout Recorded", description: `Recorded contractor payout of ₹${fmt(numericAmount)}.` });
        }
      } else {
        const payload = {
          labourId: payeeId,
          projectId: projectId || null,
          amount: numericAmount,
          type: "OUTGOING" as const,
          paymentMode,
          paymentDate: new Date(paymentDate).toISOString(),
          remarks: remarks.trim() || null,
        };

        if (editingItem) {
          const updated = await apiRequest.update<LabourPayment>("labour-payments", editingItem.id, payload);
          setLabourPayments((prev) => prev.map((item) => (item.id === editingItem.id ? { ...item, ...updated } : item)));
          toast({ title: "Payout Updated", description: "Labour wage payout record updated successfully." });
        } else {
          const created = await apiRequest.create<LabourPayment>("labour-payments", payload);
          setLabourPayments((prev) => [created, ...prev]);
          toast({ title: "Payout Recorded", description: `Recorded labour wage payout of ₹${fmt(numericAmount)}.` });
        }
      }

      setIsModalOpen(false);
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message || "Could not save payout record.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (payment: CombinedCrewPayment) => {
    if (!window.confirm(`Are you sure you want to delete this payout record for "${payment.payeeName}"?`)) return;

    try {
      if (payment.payeeType === "CONTRACTOR") {
        await apiRequest.delete("contractor-payments", payment.id);
        setContractorPayments((prev) => prev.filter((item) => item.id !== payment.id));
      } else {
        await apiRequest.delete("labour-payments", payment.id);
        setLabourPayments((prev) => prev.filter((item) => item.id !== payment.id));
      }
      toast({ title: "Payout Deleted", description: "Payment record deleted successfully." });
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message || "Could not delete payment record.", variant: "destructive" });
    }
  };

  // Filtered List
  const filteredPayments = useMemo(() => {
    return combinedPayments.filter((p) => {
      if (filterCategory !== "ALL" && p.payeeType !== filterCategory) return false;
      if (filterProjectId && p.projectId !== filterProjectId) return false;
      if (filterMode && (p.paymentMode || "CASH") !== filterMode) return false;
      if (filterSearch.trim()) {
        const term = filterSearch.toLowerCase().trim();
        const payee = p.payeeName.toLowerCase();
        const proj = p.projectName?.toLowerCase() || "";
        const rem = p.remarks?.toLowerCase() || "";
        if (!payee.includes(term) && !proj.includes(term) && !rem.includes(term)) return false;
      }
      return true;
    });
  }, [combinedPayments, filterCategory, filterProjectId, filterMode, filterSearch]);

  // Selected dashboard state
  const [selectedLabour, setSelectedLabour] = useState<Labour | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

  // Aggregates
  const totalOutgoing = useMemo(() => filteredPayments.reduce((s, p) => s + p.amount, 0), [filteredPayments]);
  const contractorTotal = useMemo(() => filteredPayments.filter((p) => p.payeeType === "CONTRACTOR").reduce((s, p) => s + p.amount, 0), [filteredPayments]);
  const labourTotal = useMemo(() => filteredPayments.filter((p) => p.payeeType === "LABOUR").reduce((s, p) => s + p.amount, 0), [filteredPayments]);

  if (selectedLabour) {
    return (
      <LabourDashboard
        labour={selectedLabour}
        onBack={() => setSelectedLabour(null)}
        handleSave={async (formData) => {
          await apiRequest.update("labours", selectedLabour.id, formData);
          setSelectedLabour((prev) => (prev ? { ...prev, ...formData } : null));
          toast({ title: "Labour updated successfully" });
        }}
      />
    );
  }

  if (selectedContractor) {
    return (
      <ContractorDashboard
        contractor={selectedContractor}
        onBack={() => setSelectedContractor(null)}
        handleSave={async (formData) => {
          await apiRequest.update("contractors", selectedContractor.id, formData);
          setSelectedContractor((prev) => (prev ? { ...prev, ...formData } : null));
          toast({ title: "Contractor updated successfully" });
        }}
      />
    );
  }

  // Filter toggle state
  const [showFilterCard, setShowFilterCard] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Crew & Vendor Outgoing Payments
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
            {(filterSearch || filterProjectId || filterMode || filterCategory !== "ALL") ? (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full font-medium">
                !
              </span>
            ) : null}
          </Button>

          <Button onClick={openCreateModal} className="font-medium flex items-center gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" /> Add Outgoing Payout
          </Button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Outgoing Expenses</p>
              <p className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-0.5">
                ₹{fmt(totalOutgoing)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Contractor Payouts</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                ₹{fmt(contractorTotal)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Hammer className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Labour Wages Paid</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                ₹{fmt(labourTotal)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Payout Count</p>
              <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                {filteredPayments.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      {showFilterCard && (
        <Card className="border border-border/80 bg-card shadow-sm rounded-xl">
          <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-primary" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Filter Outgoing Ledger
              </CardTitle>
            </div>

            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60">
              <button
                onClick={() => setFilterCategory("ALL")}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  filterCategory === "ALL" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Outgoing
              </button>
              <button
                onClick={() => setFilterCategory("CONTRACTOR")}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  filterCategory === "CONTRACTOR" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Contractors Only
              </button>
              <button
                onClick={() => setFilterCategory("LABOUR")}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  filterCategory === "LABOUR" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Labours Only
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="space-y-1 w-full sm:w-64">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Search Payee / Project / Remarks</label>
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

            {(filterSearch || filterProjectId || filterMode || filterCategory !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setFilterSearch("");
                  setFilterProjectId("");
                  setFilterProjectDisplay("");
                  setFilterMode("");
                  setFilterCategory("ALL");
                }}
              >
                Reset Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Outgoing Payouts Table */}
      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table className="text-xs">
            <TableHeader className="bg-muted/40 uppercase text-[10px] font-bold tracking-wider">
              <TableRow>
                <TableHead className="py-2.5">Date</TableHead>
                <TableHead className="py-2.5">Category</TableHead>
                <TableHead className="py-2.5">Payee Name</TableHead>
                <TableHead className="py-2.5">Project Site</TableHead>
                <TableHead className="py-2.5">Payment Mode</TableHead>
                <TableHead className="py-2.5">Remarks / Notes</TableHead>
                <TableHead className="py-2.5 text-right">Payout Amount</TableHead>
                <TableHead className="py-2.5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading outgoing payouts...
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No outgoing crew/vendor payouts recorded.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-muted-foreground">
                      {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 ${
                          p.payeeType === "CONTRACTOR"
                            ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                            : "bg-indigo-500/10 text-indigo-700 border-indigo-500/20"
                        }`}
                      >
                        {p.payeeType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => {
                          if (p.payeeType === "LABOUR") {
                            const found = laboursList.find((l) => l.id === p.payeeId);
                            setSelectedLabour(
                              found || {
                                id: p.payeeId,
                                name: p.payeeName,
                                paymentPerDay: 0,
                                phonenumber: null,
                                type: "WEEKLY",
                                createdAt: new Date(),
                              }
                            );
                          } else {
                            const found = contractorsList.find((c) => c.id === p.payeeId);
                            setSelectedContractor(
                              found || {
                                id: p.payeeId,
                                name: p.payeeName,
                                phonenumber: null,
                                email: null,
                                address: null,
                                type: "WEEKLY",
                                createdAt: new Date().toISOString(),
                              }
                            );
                          }
                        }}
                        className="font-bold text-primary hover:underline hover:text-primary/80 transition-colors text-left flex items-center gap-1 group cursor-pointer"
                        title={`Click to open ${p.payeeName}'s dashboard`}
                      >
                        <span>{p.payeeName}</span>
                        <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.projectName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5 bg-muted text-muted-foreground">
                        {p.paymentMode || "CASH"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{p.remarks || "—"}</TableCell>
                    <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400">
                      ₹{fmt(p.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEditModal(p)}>
                          <Pencil size={13} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(p)}>
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

      {/* Record / Edit Payout Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              {editingItem ? "Edit Outgoing Payout" : "Record Outgoing Payout"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Payee Category Toggle */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Payee Category *</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={payeeType === "CONTRACTOR" ? "default" : "outline"}
                  size="sm"
                  className="font-bold text-xs"
                  onClick={() => {
                    setPayeeType("CONTRACTOR");
                    setPayeeId("");
                    setPayeeDisplay("");
                  }}
                >
                  <Briefcase className="h-3.5 w-3.5 mr-1" /> Contractor
                </Button>
                <Button
                  type="button"
                  variant={payeeType === "LABOUR" ? "default" : "outline"}
                  size="sm"
                  className="font-bold text-xs"
                  onClick={() => {
                    setPayeeType("LABOUR");
                    setPayeeId("");
                    setPayeeDisplay("");
                  }}
                >
                  <Hammer className="h-3.5 w-3.5 mr-1" /> Labour / Worker
                </Button>
              </div>
            </div>

            {/* Select Payee */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Select {payeeType === "CONTRACTOR" ? "Contractor" : "Labour Worker"} <span className="text-red-500 font-bold ml-0.5">*</span>
              </label>
              <SearchableSelect
                value={payeeId}
                displayValue={payeeDisplay}
                options={(payeeType === "CONTRACTOR" ? contractorsList : laboursList)
                  .filter((item) => !payeeDisplay || item.name.toLowerCase().includes(payeeDisplay.toLowerCase()))
                  .slice(0, 10)
                  .map((item) => ({ id: item.id, label: item.name }))}
                placeholder={payeeType === "CONTRACTOR" ? "Choose contractor..." : "Choose labour worker..."}
                onSearchChange={setPayeeDisplay}
                onSelect={(id, label) => {
                  setPayeeId(id);
                  setPayeeDisplay(label);
                }}
                onClear={() => {
                  setPayeeId("");
                  setPayeeDisplay("");
                }}
              />
            </div>

            {/* Select Optional Project Site */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Project Site (Optional)</label>
              <SearchableSelect
                value={projectId}
                displayValue={projectDisplay}
                options={projectsList
                  .filter((p) => !projectDisplay || p.name.toLowerCase().includes(projectDisplay.toLowerCase()))
                  .slice(0, 10)
                  .map((p) => ({ id: p.id, label: p.name }))}
                placeholder="Choose project site..."
                allLabel="No Project (Optional)"
                onSearchChange={setProjectDisplay}
                onSelect={(id, label) => {
                  setProjectId(id);
                  setProjectDisplay(id ? label : "");
                }}
                onClear={() => {
                  setProjectId("");
                  setProjectDisplay("");
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Amount Paid (₹) <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 15000"
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
                placeholder="Weekly wage payout, Site contract advance, final settlement, etc."
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
                {editingItem ? "Update Payout" : "Save Outgoing Payout"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
